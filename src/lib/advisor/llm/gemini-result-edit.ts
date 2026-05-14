/**
 * Gemini API 直叩きで生成済みレポート (result_markdown) を編集する
 *
 * `[TOOL:result_edit]` で来た指示を Gemini Flash で result_markdown 全体に対して
 * 部分的に書き換える。skeleton (ドラフト本体) は触らない。
 *
 * draft_revise (skeleton 編集) と並ぶ Gemini バイパス経路で、
 * Anthropic loop=1 TTFB 100 秒級の問題を構造的に回避する。
 *
 * 例: ユーザーが「流入経路の項目を日本語にして」と Canvas でレポートを見ながら指示
 *     → 既存 result_markdown の該当セクションだけ書き換え、新バージョンとして保存
 */

import { generateWithGemini } from './gemini'

export interface EditResultParams {
  /** 現在の result_markdown (= 最新バージョンの本文) */
  currentResult: string
  /** ユーザー指示本文 ([TOOL:result_edit] プレフィックスは剥がした) */
  userInstruction: string
  /** 編集の文脈として渡すドラフト要件 (title / goal / range など) */
  context: {
    title: string | null
    goal: string | null
    rangeStart: string | null
    rangeEnd: string | null
  }
  /** 直近のチャット履歴 (Markdown 整形済み)。Gemini に文脈を渡す。 */
  chatHistoryContext?: string
  abortSignal?: AbortSignal
}

export interface EditResultResult {
  /** 修正後の result_markdown 全体 (redirectToDraft=true の場合は空文字) */
  updatedResult: string
  /** 1〜2 行の説明 (チャット欄に表示する text) */
  summary: string
  /**
   * Gemini が「これは result_edit (文言修正) では実現できず、
   * 新データの収集が必要 = ドラフト変更 + レポート再生成が必要」と判断した場合 true。
   * orchestrator は true を受けたら draft_revise → generateReport を自動で続ける。
   */
  redirectToDraft: boolean
  /**
   * redirectToDraft=true のとき、ドラフト側に渡す指示文。
   * 元のユーザー指示を Gemini が「draft_revise 用に整理した」もの。
   * 例: 「LP名を本物の名前で表示して + 今週の登録者数 (NEW_WORKERS) の表を追加」
   */
  draftInstruction: string | null
  metrics: {
    elapsedMs: number
    inputTokens: number
    outputTokens: number
    model: string
  }
}

const SYSTEM_PROMPT = `あなたは生成済みレポートの編集アシスタントです。
ユーザーの指示に従って、現在の result_markdown を書き換えてください。

# 出力ルール (絶対遵守)
- ユーザー指示が**明示的に範囲を指定**している (例: 「流入経路の項目だけ」「サマリの最後の段落だけ」) なら、
  その範囲のみ書き換え、それ以外の章 / 段落 / 表は完全に保持する
- ユーザー指示が範囲指定なし (例: 「全体的に文体を丁寧に」「全部日本語化」) なら全体に適用
- レポート全体の章構造 (## 見出し) は **増減せず維持** する (ユーザーが明示的に「○○章を消して」と
  言わない限り)
- 表のデータ (数字) は **改変禁止**。文言・表記・並びの修正のみ。新しい数字を作らない
- 既存の数字や事実は維持。文章だけリライトする

# ❗ redirect_to_draft 判定 (新データ取得が必要な指示は escape する)

ユーザー指示が **「現在のレポートに無いデータ / 表 / 数字を追加する」** 内容なら、
result_edit (文字列書き換えのみ) では絶対に実現不可。**redirect_to_draft=true** で返すこと:

判定基準:
- ✅ redirect 必要: 「○○の表を追加して」「○○のデータも入れて」「ID じゃなくて本物の名前で」
  「先週との比較を出して」「日別の推移を入れて」など、**新しい数字 / カラム / 行 / 集計が必要**
- ❌ redirect 不要 (普通に result_edit する): 「日本語にして」「文体を丁寧に」「順位を逆にして」
  「冗長な部分を削って」「タイトルを変えて」など、**既存テキストの整形・並び替え・削除のみ**

redirect_to_draft=true のとき:
- updated_result は空文字 ""
- draft_instruction に「draft_revise 用に整理した指示文」を入れる
  - ユーザー原文を draft_revise が理解できる形に書き直す
  - 例 ユーザー原文: 「LP名、LPの名前で表示して + 今週の登録者数の表を足して」
       → draft_instruction: 「LP別表で LP ID ではなく本物の LP 名 (LandingPage.name) を表示。
          さらに『今週の登録者数』(NEW_WORKERS) の表を追加して。」
- summary は「データ取得が必要なため、ドラフトを更新してレポートを再生成します」と返す

**判定に迷ったら redirect する側に倒す** (中途半端に文字列で誤魔化すより、
ちゃんとデータ取り直して再生成する方がユーザーにとって正しい結果になる)。

# 📋 Markdown テーブル記法 (絶対遵守)

GFM テーブルの **セパレーター行は列数分の \`---\` を必ず書く**。
表を編集するときも、ヘッダ行の \`|\` の数とセパレーター行の \`|\` の数は **必ず一致** させる:

✅ 正しい (3列): \`| 列1 | 列2 | 列3 |\` の下は \`|---|---|---|\`
❌ 壊れる: \`|---|\` だけだと表として認識されない

# JSON 出力フォーマット (必ず JSON のみ、コードブロックや前置き禁止)
{
  "updated_result": "<修正後の markdown 全体。redirect_to_draft=true なら空文字>",
  "summary": "<1〜2 行 (50〜120 字) で何をしたか / なぜ redirect したか。❌ ボタン操作案内禁止>",
  "redirect_to_draft": false,
  "draft_instruction": "<redirect_to_draft=true のときだけ書く。draft_revise 用に整理した指示>" or null
}

# JSON 出力の絶対ルール (これを破ると壊れる)
- 文字列値の中の改行は **必ず \\n** にエスケープする (生の改行を入れない)
- 文字列値の中の \" (二重引用符) は **必ず \\"** にエスケープする
- 末尾カンマ禁止
- updated_result は長くなるが、すべて 1 行の文字列値として \\n を使って改行を表現する
`

function buildUserPrompt(params: EditResultParams): string {
  const c = params.context
  const historyBlock = params.chatHistoryContext && params.chatHistoryContext.trim().length > 0
    ? `# 直近のチャット履歴 (このセッションでの過去のやり取り、参考用)
${params.chatHistoryContext}

`
    : ''
  return `${historyBlock}# レポート要件 (参考)
- タイトル: ${c.title ?? '(未設定)'}
- 目的: ${c.goal ?? '(未設定)'}
- 期間: ${c.rangeStart ?? '?'} 〜 ${c.rangeEnd ?? '?'}

# 現在のレポート本文 (これを書き換える)
\`\`\`markdown
${params.currentResult}
\`\`\`

# ユーザーの修正指示
${params.userInstruction}

上記の出力フォーマットに従って JSON のみを返してください。`
}

/**
 * 文字列リテラル内の生改行を \n にエスケープして JSON 救済する。
 * gemini-edit / gemini-draft-create と同じ実装。
 */
function repairJsonString(raw: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escape) {
      out += ch
      escape = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString) {
      if (ch === '\n') {
        out += '\\n'
        continue
      }
      if (ch === '\r') continue
      if (ch === '\t') {
        out += '\\t'
        continue
      }
    }
    out += ch
  }
  return out
}

function parseEditResultResponse(text: string): {
  updated_result: string
  summary: string
  redirect_to_draft: boolean
  draft_instruction: string | null
} {
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini レスポンスが空でした')
  }

  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }

  let parsed: unknown = tryParse(text.trim())

  if (!parsed) {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (fenced) parsed = tryParse(fenced[1].trim())
  }

  let sliced: string | null = null
  if (!parsed) {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      sliced = text.slice(firstBrace, lastBrace + 1)
      parsed = tryParse(sliced)
    }
  }

  if (!parsed && sliced) {
    parsed = tryParse(repairJsonString(sliced))
  }

  if (!parsed && sliced) {
    const noTrailingComma = sliced.replace(/,(\s*[}\]])/g, '$1')
    parsed = tryParse(repairJsonString(noTrailingComma))
  }

  if (!parsed || typeof parsed !== 'object') {
    const preview = text.slice(0, 800).replace(/\n/g, '\\n')
    throw new Error(
      `Gemini レスポンスから JSON を抽出できませんでした (length=${text.length}, head=${preview})`
    )
  }

  const o = parsed as Record<string, unknown>
  const redirect = o.redirect_to_draft === true
  const updated =
    typeof o.updated_result === 'string'
      ? o.updated_result
      : typeof o.result_markdown === 'string'
        ? o.result_markdown
        : null
  // redirect_to_draft=true なら updated_result は空でも OK (使わない)
  if (!redirect) {
    if (!updated || updated.length < 50) {
      throw new Error('updated_result フィールドが見つからないか短すぎます')
    }
  }
  const draftInstruction =
    typeof o.draft_instruction === 'string' && o.draft_instruction.trim().length > 0
      ? o.draft_instruction.trim()
      : null
  const summary =
    typeof o.summary === 'string' && o.summary.length > 0
      ? o.summary
      : (redirect
          ? 'データ取得が必要なため、ドラフトを更新してレポートを再生成します'
          : 'レポートを更新しました')
  return {
    updated_result: updated ?? '',
    summary,
    redirect_to_draft: redirect,
    draft_instruction: draftInstruction,
  }
}

/**
 * Gemini Flash で生成済みレポートを編集する。
 * 失敗時は throw する (orchestrator 側で catch してエラー表示)。
 */
export async function editResultWithGemini(params: EditResultParams): Promise<EditResultResult> {
  const userPrompt = buildUserPrompt(params)
  const result = await generateWithGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jsonMode: true,
    abortSignal: params.abortSignal,
  })

  const parsed = parseEditResultResponse(result.text)

  return {
    updatedResult: parsed.updated_result,
    summary: parsed.summary,
    redirectToDraft: parsed.redirect_to_draft,
    draftInstruction: parsed.draft_instruction,
    metrics: {
      elapsedMs: result.tookMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    },
  }
}
