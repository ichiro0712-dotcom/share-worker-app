import type { AdvisorTool } from '../types'
import { getDraftBySession } from '../../persistence/report-drafts'
import {
  getLatestVersion,
  createReportVersion,
  buildDraftSnapshot,
  isLockedByOther,
} from '../../persistence/report-versions'
import { generateWithGemini, isGeminiAvailable } from '../../llm/gemini'

interface Input {
  /** 修正指示 (例: "3 章のグラフ説明を簡潔にして") */
  instruction: string
  /** 対象セクション見出し (省略時は全体) */
  target_section?: string
}

interface Output {
  ok: true
  draft_id: string
  new_version_id: string
  new_version_number: number
  parent_version_id: string
  applied_instruction: string
}

const EDIT_SYSTEM_PROMPT = `あなたは TASTAS のシステム運用レポートを編集する編集者です。
すでに書かれているレポート全文と、ユーザーからの修正指示が与えられます。

## 厳守ルール

1. 指定されたセクション/章だけを書き換え、他は **原文をそのまま維持** する
2. target_section が省略されている場合は、指示の文脈から該当箇所を判断する
3. データに無い数字を新たに追加しない (元レポートにあった数値はそのまま)
4. 全文を Markdown で返す。前置き ("修正しました" 等) は禁止
5. 出力は完成したレポート全文のみ。差分や説明は不要
6. アウトラインや章立て (見出し階層) は元のまま維持。指示に「章を追加して」とあれば追加する
7. 指示が曖昧で何を変えるか判断つかなければ、変更せず元レポートをそのまま返す
8. 文字数: 元レポートと大きく変えない (極端に長く・短くしない)`

/**
 * 結果ビュー表示中にユーザーが「ここを直して」と依頼した時に呼ぶツール。
 *
 * 動作:
 * 1. 対象セッションの最新バージョン (Gemini 生成済み or 過去の編集版) を取得
 * 2. 編集ロック中なら拒否
 * 3. Gemini に「元レポート全文 + 指示」を送って修正版全文を取得 (簡易版方針)
 * 4. 新バージョン (source='llm_edit') として保存
 *
 * 失敗時はツール呼び出し結果として error を返す (チャットには反映されない)。
 */
export const editReportSectionTool: AdvisorTool<Input, Output> = {
  name: 'edit_report_section',
  category: 'core',
  description:
    '結果ビューに表示されているレポートの一部を修正します。' +
    '\n\n使用条件:' +
    '\n- ユーザーが既に生成済みのレポートを見ながら「ここを直して」「○章を簡潔に」のような部分修正を依頼した時のみ使う' +
    '\n- レポートが未生成の場合は使わない (update_report_draft で要件固めから始める)' +
    '\n- ユーザーが手動編集モードに入っている場合 (Canvas の編集ボタンクリック後) は呼ばずチャットで案内のみ' +
    '\n\n動作:' +
    '\n- 対象セッションの最新レポート全文 + 指示を Gemini に投げて修正版を取得' +
    '\n- 新しいバージョンとして保存 (元バージョンは履歴に残る)' +
    '\n- Canvas が自動で新バージョンに切り替わる' +
    '\n\n注意:' +
    '\n- 全文再生成方式なので 10〜30 秒かかる' +
    '\n- target_section は明確な見出しがある時のみ指定。曖昧なら省略して指示文に内容を込める',
  inputSchema: {
    type: 'object',
    properties: {
      instruction: {
        type: 'string',
        description:
          '修正指示。例: "3 章のグラフ説明を簡潔にして", "全体を 1.5 倍くらいの分量に", "末尾に次回アクションを追加"',
      },
      target_section: {
        type: 'string',
        description:
          '対象見出し (例: "サマリ", "## 主要数値")。明確に分かる時だけ指定。省略時は全体を指示文の文脈で判断',
      },
    },
    required: ['instruction'],
  },
  outputDescription:
    '{ ok, draft_id, new_version_id, new_version_number, parent_version_id, applied_instruction }',
  async available() {
    const gemini = isGeminiAvailable()
    if (!gemini.ready) {
      return { ready: false, reason: gemini.reason ?? 'Gemini 利用不可' }
    }
    return { ready: true }
  },
  async execute(input, ctx) {
    const start = Date.now()
    if (!input.instruction || input.instruction.trim().length === 0) {
      return { ok: false, error: 'instruction を指定してください' }
    }
    const draft = await getDraftBySession(ctx.sessionId)
    if (!draft) {
      return {
        ok: false,
        error: 'このセッションにはレポートドラフトがありません',
        userActionable:
          'まず update_report_draft で要件を固め、レポートを 1 度生成してください',
      }
    }
    if (draft.adminId !== ctx.adminId) {
      return { ok: false, error: 'このドラフトを編集する権限がありません' }
    }
    const parent = await getLatestVersion(draft.id)
    if (!parent) {
      return {
        ok: false,
        error: '生成済みのレポートがありません',
        userActionable:
          'まず "レポート作成" ボタンで初版を生成してください。その後で部分修正できます',
      }
    }

    // 編集ロック中なら拒否
    const lockState = await isLockedByOther({
      versionId: parent.id,
      adminId: ctx.adminId,
    })
    if (lockState.locked) {
      return {
        ok: false,
        error: '別の管理者が手動編集中です。完了するまでお待ちください',
      }
    }

    // Gemini に投げる
    const userPrompt = buildEditPrompt({
      currentMarkdown: parent.resultMarkdown,
      instruction: input.instruction,
      targetSection: input.target_section,
      draft,
    })

    let geminiOut
    try {
      geminiOut = await generateWithGemini({
        systemPrompt: EDIT_SYSTEM_PROMPT,
        userPrompt,
        abortSignal: ctx.abortSignal,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `Gemini 呼び出し失敗: ${msg}` }
    }

    if (!geminiOut.text || geminiOut.text.trim().length === 0) {
      return { ok: false, error: 'Gemini の応答が空でした' }
    }

    // 新バージョンとして保存
    const newVersion = await createReportVersion({
      draftId: draft.id,
      resultMarkdown: geminiOut.text,
      resultModel: geminiOut.model,
      draftSnapshot: buildDraftSnapshot(draft),
      source: 'llm_edit',
      parentVersionId: parent.id,
      generatedMs: geminiOut.tookMs,
      inputTokens: geminiOut.inputTokens,
      outputTokens: geminiOut.outputTokens,
    })

    return {
      ok: true,
      data: {
        ok: true as const,
        draft_id: draft.id,
        new_version_id: newVersion.id,
        new_version_number: newVersion.versionNumber,
        parent_version_id: parent.id,
        applied_instruction: input.instruction,
      },
      metadata: {
        tookMs: Date.now() - start,
      },
    }
  },
}

function buildEditPrompt(input: {
  currentMarkdown: string
  instruction: string
  targetSection?: string
  draft: { title: string | null; goal: string | null }
}): string {
  const lines: string[] = []
  lines.push('# 編集対象レポート')
  if (input.draft.title) lines.push(`- タイトル: ${input.draft.title}`)
  if (input.draft.goal) lines.push(`- 目的: ${input.draft.goal}`)
  lines.push('')
  lines.push('## 元レポート全文')
  lines.push('```markdown')
  lines.push(input.currentMarkdown)
  lines.push('```')
  lines.push('')
  lines.push('## 修正指示')
  if (input.targetSection) {
    lines.push(`- 対象セクション: \`${input.targetSection}\``)
  }
  lines.push(`- 指示: ${input.instruction}`)
  lines.push('')
  lines.push('## 出力')
  lines.push('修正後のレポート全文を Markdown で返してください。前置きや差分説明は不要。')
  return lines.join('\n')
}
