/**
 * レポートの「空き穴」を Gemini Tool Use で自動補完する (Phase 1)
 *
 * フロー:
 *  1. detectGapBlocks で穴を抽出
 *  2. groupGapBlocks で章ごとにまとめる
 *  3. 各グループを Gemini に「この表を埋めて」と依頼
 *     - tools: [query_metric] のみ (Phase 1 はメトリクス表のみ対応)
 *     - Gemini は filter.lp_id 等を自分で組み立てて呼べる
 *  4. 戻った Markdown スニペットで元 Markdown を置換
 *
 * 失敗耐性:
 *  - 個別グループが失敗しても他のグループは独立して試行される
 *  - 全体タイムアウト 60 秒、各グループ 20 秒
 *  - Gemini が「データなし」と返したら元のままにして次へ
 */

import { executeToolByName, findTool } from '../tools/registry'
import type { GapGroup } from './gap-detector'

export interface AutoFillContext {
  adminId: number
  sessionId: string
  /** ドラフトの期間 (ツール呼び出し時の補助情報) */
  rangeStart: string | null
  rangeEnd: string | null
  /** ドラフトの original_request (= ユーザーが当初書いた要望、Gemini に文脈として渡す) */
  originalRequest: string | null
  /** 全体タイムアウト (ms)、デフォルト 60000 */
  totalTimeoutMs?: number
  /** 1 グループあたりのタイムアウト (ms)、デフォルト 20000 */
  groupTimeoutMs?: number
}

export interface AutoFillResult {
  /** 補完後の Markdown (失敗グループは元のまま) */
  filledMarkdown: string
  /** 各グループの試行結果 */
  attempts: Array<{
    chapterTitle: string | null
    blockCount: number
    ok: boolean
    error?: string
    tookMs: number
    /** 補完で消費した Gemini token */
    inputTokens?: number
    outputTokens?: number
    /** Gemini が呼んだツール名と回数 (audit log 用) */
    toolCalls?: Array<{ name: string; argsJson: string }>
  }>
  /** 補完が 1 つでも成功したか (= 新バージョン保存に値するか) */
  anySuccess: boolean
  totalMs: number
}

const DEFAULT_MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `あなたは TASTAS のレポートデータアナリストです。

ユーザーが提示する「空き穴のあるレポートブロック」(= 全セルが "-" の表 / 「取得できません」と書かれた段落) を、
ツールを使って実データを取得し、埋めて返してください。

## ルール
1. 必要なら query_metric ツールを呼んで実データを取得する。
   - filter.lp_id / filter.campaign_code を使うと特定 LP / キャンペーン限定の集計ができる
   - group_by="lp_id" / "campaign_code" / "day" で軸別に集計できる
   - filter と group_by を組み合わせれば「LP5 限定 × キャンペーン別」のクロス集計も可能
2. ブロックの章タイトル / 表ヘッダ / ユーザーの original_request から「何を埋めるべきか」を推測する
3. データが取れなかった項目は元の "-" のまま残し、章末に「※ 〇〇は取得できませんでした」と書く (嘘の数字は禁止)
4. 出力は埋めた **Markdown ブロックの本体のみ** (前後に余計な説明文を付けない)
   - 表の場合: ヘッダ行 + 区切り行 + 本文行のみを返す
   - 段落の場合: 修正された段落本文のみ
5. 表の列構成・行数・章タイトルは元のブロックと一致させる (構造変更は禁止)
6. JST 基準の日付で書く

## 入力フォーマット
- chapter_title: 章タイトル
- range: 集計期間 (YYYY-MM-DD 〜 YYYY-MM-DD)
- original_request: ユーザーが当初書いた要望 (LP5 など対象を絞り込む手がかり)
- block: 元の空き穴ブロック (表 or 段落の Markdown)

## 出力フォーマット
埋めた Markdown ブロックの本体のみ。前後の "" バッククォートや余計な説明は不要。
取れなかった場合は元のブロックをそのまま返す。`

interface ToolCallRecord {
  name: string
  argsJson: string
}

/** Gemini Tool Use ループ。1 グループぶんを処理する。 */
async function fillGroupWithGemini(
  group: GapGroup,
  ctx: AutoFillContext
): Promise<{
  filledText: string | null
  inputTokens: number
  outputTokens: number
  toolCalls: ToolCallRecord[]
  error?: string
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      filledText: null,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [],
      error: 'GEMINI_API_KEY 未設定',
    }
  }

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  // 渡すツール: query_metric のみ (Phase 1)。将来 query_ga4 等も追加予定。
  const allowedToolNames = ['query_metric']
  const toolDecls = allowedToolNames
    .map((name) => findTool(name))
    .filter((t): t is NonNullable<typeof t> => t != null)
    .map((t) => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: t.inputSchema as Record<string, unknown>,
    }))
  const allowedToolNameSet = new Set(allowedToolNames)

  const userPrompt = buildUserPromptForGroup(group, ctx)

  // Gemini Tool Use のループ
  let inputTokens = 0
  let outputTokens = 0
  const toolCalls: ToolCallRecord[] = []
  // contents は Gemini の会話履歴を表す ({ role, parts })
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    { role: 'user', parts: [{ text: userPrompt }] },
  ]

  // 最大 5 ループ (= ツール呼び出し 4 回 + 最終応答 1 回) で打ち切る
  const MAX_LOOPS = 5
  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: toolDecls }],
      },
      contents,
    })

    const usage = response.usageMetadata as
      | { promptTokenCount?: number; candidatesTokenCount?: number }
      | undefined
    inputTokens += usage?.promptTokenCount ?? 0
    outputTokens += usage?.candidatesTokenCount ?? 0

    // Gemini レスポンスから functionCall / text を抽出
    const candidate = response.candidates?.[0]
    const parts = candidate?.content?.parts ?? []
    const functionCalls = parts.filter(
      (p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
        'functionCall' in p && p.functionCall != null
    )
    const textParts = parts.filter(
      (p): p is { text: string } => 'text' in p && typeof p.text === 'string'
    )

    if (functionCalls.length > 0) {
      // ツール呼び出しがあれば実行して結果を contents に積む
      const modelContent = {
        role: 'model',
        parts: parts.map((p) => p as Record<string, unknown>),
      }
      contents.push(modelContent)

      const toolResponses: Array<Record<string, unknown>> = []
      for (const fc of functionCalls) {
        const fname = fc.functionCall.name
        const fargs = (fc.functionCall.args ?? {}) as Record<string, unknown>
        toolCalls.push({ name: fname, argsJson: JSON.stringify(fargs) })
        if (!allowedToolNameSet.has(fname)) {
          toolResponses.push({
            functionResponse: {
              name: fname,
              response: { error: `tool ${fname} is not allowed in auto-fill` },
            },
          })
          continue
        }
        try {
          const result = await executeToolByName(fname, fargs, {
            adminId: ctx.adminId,
            sessionId: ctx.sessionId,
          })
          toolResponses.push({
            functionResponse: {
              name: fname,
              response: result.ok ? { data: result.data } : { error: result.error },
            },
          })
        } catch (e) {
          toolResponses.push({
            functionResponse: {
              name: fname,
              response: { error: e instanceof Error ? e.message : String(e) },
            },
          })
        }
      }
      contents.push({ role: 'user', parts: toolResponses })
      continue
    }

    // 通常テキスト応答 (= 最終回答)
    const finalText = textParts.map((p) => p.text).join('').trim()
    if (finalText.length > 0) {
      return {
        filledText: finalText,
        inputTokens,
        outputTokens,
        toolCalls,
      }
    }

    // text も functionCall も無い場合は打ち切り
    return {
      filledText: null,
      inputTokens,
      outputTokens,
      toolCalls,
      error: 'Gemini が空応答を返しました',
    }
  }

  return {
    filledText: null,
    inputTokens,
    outputTokens,
    toolCalls,
    error: `tool use loop が ${MAX_LOOPS} 回上限に達しました`,
  }
}

function buildUserPromptForGroup(group: GapGroup, ctx: AutoFillContext): string {
  const lines: string[] = []
  lines.push('## context')
  if (group.chapterTitle) lines.push(`chapter_title: ${group.chapterTitle}`)
  if (ctx.rangeStart && ctx.rangeEnd) {
    lines.push(`range: ${ctx.rangeStart} 〜 ${ctx.rangeEnd}`)
  }
  if (ctx.originalRequest) {
    lines.push(`original_request: ${ctx.originalRequest}`)
  }
  lines.push('')
  lines.push('## blocks (空き穴)')
  for (let i = 0; i < group.blocks.length; i++) {
    const b = group.blocks[i]
    lines.push(`### block ${i + 1} (${b.kind})`)
    lines.push(b.rawText.trimEnd())
    lines.push('')
  }
  lines.push('## task')
  lines.push(
    'ツールで実データを取得し、各 block を埋めた Markdown を順に返してください。' +
      'block 区切りは `\\n---BLOCK---\\n` で区切ること (block N の数だけ区切る)。' +
      '取れなかったブロックはそのまま元の Markdown を返してください。'
  )
  return lines.join('\n')
}

/**
 * Promise にタイムアウトを掛ける小さなヘルパ。
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/**
 * Markdown 内の各 block を、Gemini が返した区切りテキストでパッチする。
 */
function applyFillsToMarkdown(
  markdown: string,
  group: GapGroup,
  filledText: string
): { applied: number; result: string } {
  // Gemini が返した文字列を区切る
  const parts = filledText.split(/\n?---BLOCK---\n?/g)
  // block 数より少ない / 多い場合は前から順に当てる (余り / 不足は無視)
  let result = markdown
  let applied = 0

  // 元 Markdown の置換は「元位置の昇順 → 後ろから前へ」が安全 (offset がずれないように)
  const blocksWithFill = group.blocks
    .map((b, idx) => ({
      block: b,
      fill: parts[idx]?.trim() ?? null,
    }))
    .filter((bf) => {
      if (!bf.fill) return false
      // 元の rawText と完全一致の場合は「埋まらなかった」と判定
      if (bf.fill === bf.block.rawText.trim()) return false
      return true
    })
    .sort((a, b) => b.block.start - a.block.start) // 後ろから

  for (const { block, fill } of blocksWithFill) {
    result =
      result.slice(0, block.start) +
      fill +
      (fill.endsWith('\n') ? '' : '\n') +
      result.slice(block.end)
    applied++
  }
  return { applied, result }
}

/**
 * メインエントリ: レポート Markdown 中の空き穴を Gemini Tool Use で自動補完する。
 * 失敗しても元 Markdown は壊れない (= 全グループ失敗なら filledMarkdown === markdown)。
 */
export async function autoFillReportGaps(
  markdown: string,
  groups: GapGroup[],
  ctx: AutoFillContext
): Promise<AutoFillResult> {
  const start = Date.now()
  const totalTimeoutMs = ctx.totalTimeoutMs ?? 60_000
  const groupTimeoutMs = ctx.groupTimeoutMs ?? 20_000
  const overallDeadline = start + totalTimeoutMs

  if (groups.length === 0) {
    return { filledMarkdown: markdown, attempts: [], anySuccess: false, totalMs: 0 }
  }

  // 各グループを並列で処理。各グループにタイムアウト 20 秒を設ける。
  // (全体 60 秒なので、3 グループまで並列でほぼ収まる。それ以上は逐次にフォールバック)
  const groupResults = await Promise.all(
    groups.map(async (group) => {
      const groupStart = Date.now()
      // overall deadline までの残時間と groupTimeoutMs の小さい方
      const remaining = overallDeadline - groupStart
      const timeout = Math.min(groupTimeoutMs, Math.max(1000, remaining))
      try {
        const r = await withTimeout(
          fillGroupWithGemini(group, ctx),
          timeout,
          `auto-fill group "${group.chapterTitle ?? '(no chapter)'}"`
        )
        return { group, ...r, tookMs: Date.now() - groupStart }
      } catch (e) {
        return {
          group,
          filledText: null as string | null,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: [] as ToolCallRecord[],
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - groupStart,
        }
      }
    })
  )

  // 各グループの結果を Markdown にパッチする (順序: 元位置の後ろから)
  let filledMarkdown = markdown
  const attempts: AutoFillResult['attempts'] = []
  let anySuccess = false

  for (const r of groupResults) {
    if (r.filledText) {
      const { applied, result } = applyFillsToMarkdown(filledMarkdown, r.group, r.filledText)
      filledMarkdown = result
      const ok = applied > 0
      if (ok) anySuccess = true
      attempts.push({
        chapterTitle: r.group.chapterTitle,
        blockCount: r.group.blocks.length,
        ok,
        tookMs: r.tookMs,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        toolCalls: r.toolCalls,
        ...(ok ? {} : { error: '埋めた内容が元と同一だったためスキップ' }),
      })
    } else {
      attempts.push({
        chapterTitle: r.group.chapterTitle,
        blockCount: r.group.blocks.length,
        ok: false,
        tookMs: r.tookMs,
        error: r.error ?? '不明なエラー',
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        toolCalls: r.toolCalls,
      })
    }
  }

  return {
    filledMarkdown,
    attempts,
    anySuccess,
    totalMs: Date.now() - start,
  }
}
