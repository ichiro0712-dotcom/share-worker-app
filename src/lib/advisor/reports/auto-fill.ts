/**
 * レポートの「空き穴」を Claude Tool Use で自動補完する (Phase 1)
 *
 * 設計方針 (2026-05-07 リライト):
 *  - Anthropic (Claude) を「整形係 + クエリ判断係」として使う
 *  - 既存の query_metric ツールをそのまま渡す → ユーザーがチャットで使うときと同じ動き
 *  - JSON 出力強制やブロック区切り命令は使わない (Claude は普通の Markdown 表で返す)
 *  - 戻り値に表が見つかれば置換、見つからなければスキップ
 *
 * シンプルさ優先で 1 ブロック = 1 セッションで完結 (グループ化はしない)。
 */

import { findTool, executeToolByName } from '../tools/registry'
import { getClaudeClient, ADVISOR_MODELS } from '../claude'
import type { GapBlock, GapGroup } from './gap-detector'

export interface AutoFillContext {
  adminId: number
  sessionId: string
  rangeStart: string | null
  rangeEnd: string | null
  originalRequest: string | null
  /** 全体タイムアウト (ms)、デフォルト 60000 */
  totalTimeoutMs?: number
  /** 1 ブロックあたりのタイムアウト (ms)、デフォルト 30000 */
  blockTimeoutMs?: number
}

export interface AutoFillResult {
  filledMarkdown: string
  attempts: Array<{
    chapterTitle: string | null
    blockCount: number
    ok: boolean
    error?: string
    tookMs: number
    inputTokens?: number
    outputTokens?: number
    toolCalls?: Array<{ name: string; argsJson: string }>
  }>
  anySuccess: boolean
  totalMs: number
}

interface FillOneResult {
  filledText: string | null
  inputTokens: number
  outputTokens: number
  toolCalls: Array<{ name: string; argsJson: string }>
  error?: string
}

const DEFAULT_MODEL = ADVISOR_MODELS.haiku // Haiku 4.5 で十分。表整形は単純タスク。
const MAX_TOOL_LOOPS = 8

const SYSTEM_PROMPT = `あなたは TASTAS のレポートデータアナリストです。

ユーザーは「全セルが "-" の Markdown 表」を渡してきます。
あなたの仕事は query_metric ツールで実データを取得し、表を埋めて返すことだけです。

## query_metric ツールの正しい使い方

### 利用可能な metric_key (この一覧の文字列のみ受け付ける、推測禁止)
- LP_PV: LP のページビュー数
- LP_TO_LINE_CONV: LP 内の LINE 友だち追加クリック数
- LP_REGISTRATIONS: LP 経由の登録数
- TOTAL_WORKERS / NEW_WORKERS / TOTAL_FACILITIES / TOTAL_JOBS / ACTIVE_JOBS
- NEW_APPLICATIONS / PUBLIC_JOB_PV / JOB_SEARCH_PV / JOB_DETAIL_PV
- REGISTRATION_PAGE_PV / APPLICATION_CLICKS

❌ "pv" / "page_view" / "page_views" / "sessions" / "line_click" / "line_cta_click" / "line_registration" / "registered" などの**短縮形・推測形は存在しない**。必ず上記の正式 key を使う。

### filter.lp_id について
filter.lp_id は LandingPage テーブルの数字文字列 (例: "5") を指定する。
LP5 のような特定 LP のクロス集計が必要な場合の手順:
  1. group_by="lp_id" を指定して query_metric を 1 回呼ぶ
  2. rows[].label から「LP 5」を含む key (= "5" のような数字文字列) を見つける
  3. その key を filter.lp_id に入れ、group_by="campaign_code" で再集計

## ルール (厳守)

1. metric_key は上記の正式リストから選ぶ (推測した key を試さない)
2. **列構成 (列名・列順) は元と一致させる** (列の追加・削除・並び替え禁止)
3. **行数は実データに合わせて自由に増減してよい**:
   - 元の表が「5 行 + 合計行」でも、実データが 13 行なら 13 行 + 合計行で返す
   - 元の表が「3 行」でも、実データが 1 行しかないなら 1 行で返す
   - 元の表のプレースホルダ行数は仮置きであって、実データに合わせて埋めるべき
4. **「合計」「Total」行が元の表にあれば必ず維持**し、表の最後に置く (本文行を全部足した値)
5. **並び順**: 主要指標 (例: PV) の降順を基本にする
6. 取れたデータは必ず数値として反映する。取れなかったセルだけ "-" のまま残す
7. ツール呼び出しが続けて失敗してもあきらめない: 一覧から別の key を試す

## 出力フォーマット (絶対遵守)

- **Markdown 表のみ** を返す。\`|\` で始まり \`|\` で終わる行と、その上下の区切り行 \`|---|---|\` のみ
- 表の直後に注釈が必要なら **1 行だけ** \`* ...\` または \`※ ...\` を添えて良い (最大 2 行まで)
- ❌ 禁止事項:
  - 「以下が埋めた表です」「データを取得しました」のような前置き
  - 「query_metric の利用可能なメトリクスを教えてください」のような質問返し
  - "## サマリ" "## 考察" のような新しい章見出しの追加
  - 箇条書き ("- xxx" "* xxx") を表とは別に追加すること
  - 説明文・解説・補足コメントの追加 (取れなかった理由は ※ 注釈 1 行のみ)
- 取れたデータが何も無い / ツールでエラーが続く場合は、元の表をそのまま返してよい (= 諦めて次へ)`

/**
 * Claude Tool Use ループで 1 つの空き穴ブロックを埋める。
 */
async function fillOneBlock(
  block: GapBlock,
  ctx: AutoFillContext
): Promise<FillOneResult> {
  const DEBUG = process.env.ADVISOR_AUTO_FILL_DEBUG === 'true'
  const client = getClaudeClient()

  const queryMetric = findTool('query_metric')
  if (!queryMetric) {
    return {
      filledText: null,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [],
      error: 'query_metric tool not registered',
    }
  }

  const tools = [
    {
      name: queryMetric.name,
      description: queryMetric.description,
      input_schema: queryMetric.inputSchema,
    },
  ]

  const userPrompt = buildUserPrompt(block, ctx)

  type AnthropicMessage = {
    role: 'user' | 'assistant'
    content: string | Array<Record<string, unknown>>
  }
  const messages: AnthropicMessage[] = [{ role: 'user', content: userPrompt }]
  let inputTokens = 0
  let outputTokens = 0
  const toolCalls: Array<{ name: string; argsJson: string }> = []

  if (DEBUG) {
    console.log('[auto-fill:claude] === START block at', block.start, 'kind:', block.kind, 'chapter:', block.chapterTitle)
    console.log('[auto-fill:claude] user prompt:\n', userPrompt)
  }

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: tools as never,
      messages: messages as never,
    })
    inputTokens += response.usage.input_tokens
    outputTokens += response.usage.output_tokens

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Array<{
      type: 'tool_use'
      id: string
      name: string
      input: unknown
    }>
    const textBlocks = response.content.filter((b) => b.type === 'text') as Array<{
      type: 'text'
      text: string
    }>

    if (response.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
      // assistant のメッセージ (tool_use 含む) をそのまま messages に積む
      messages.push({
        role: 'assistant',
        content: response.content as unknown as Array<Record<string, unknown>>,
      })

      // 各 tool_use を実行して tool_result で返答
      const toolResults: Array<Record<string, unknown>> = []
      for (const tu of toolUseBlocks) {
        const args = (tu.input ?? {}) as Record<string, unknown>
        toolCalls.push({ name: tu.name, argsJson: JSON.stringify(args) })
        if (tu.name !== 'query_metric') {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            is_error: true,
            content: `tool ${tu.name} is not allowed in auto-fill`,
          })
          continue
        }
        try {
          const result = await executeToolByName(tu.name, args, {
            adminId: ctx.adminId,
            sessionId: ctx.sessionId,
          })
          if (DEBUG) {
            console.log(`[auto-fill:claude] tool ${tu.name} args=`, JSON.stringify(args))
            console.log(
              `[auto-fill:claude] tool ${tu.name} result.ok=${result.ok}:`,
              JSON.stringify(result.ok ? result.data : result.error).slice(0, 500)
            )
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            is_error: !result.ok,
            content: JSON.stringify(result.ok ? result.data : { error: result.error }),
          })
        } catch (e) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            is_error: true,
            content: e instanceof Error ? e.message : String(e),
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // 通常応答 (= 最終回答)
    const finalText = textBlocks.map((b) => b.text).join('').trim()
    if (DEBUG) {
      console.log('[auto-fill:claude] final text (first 800):\n', finalText.slice(0, 800))
    }
    if (finalText.length > 0) {
      return { filledText: finalText, inputTokens, outputTokens, toolCalls }
    }

    // 空応答が来たケース: 既にツール呼び出しが走っているなら、結果を踏まえて
    // 「Markdown 表だけ返してくれ」と明示的に頼んで 1 ループ追加。
    // ツール呼び出しがまだ無いケースは打ち切り。
    if (toolCalls.length > 0 && loop < MAX_TOOL_LOOPS - 1) {
      if (DEBUG) console.log('[auto-fill:claude] empty response, retry with explicit table request')
      messages.push({
        role: 'user',
        content:
          '上記のツール結果を踏まえて、元の表を埋めた Markdown 表だけを返してください。' +
          'これ以上ツールは呼ばないでください。前置きや説明は不要、表 (| ... |) と直後の ※ 注釈 1 行だけで OK です。',
      })
      continue
    }

    return {
      filledText: null,
      inputTokens,
      outputTokens,
      toolCalls,
      error: 'Claude が空応答を返しました',
    }
  }

  return {
    filledText: null,
    inputTokens,
    outputTokens,
    toolCalls,
    error: `tool use loop が ${MAX_TOOL_LOOPS} 回上限に達しました`,
  }
}

function buildUserPrompt(block: GapBlock, ctx: AutoFillContext): string {
  const lines: string[] = []
  lines.push('以下の Markdown ブロックを query_metric ツールで実データを取って埋め直し、Markdown だけ返してください。')
  lines.push('')
  if (block.chapterTitle) lines.push(`## 章タイトル\n${block.chapterTitle}`)
  if (ctx.rangeStart && ctx.rangeEnd) {
    lines.push(`## 集計期間\n${ctx.rangeStart} 〜 ${ctx.rangeEnd}`)
  }
  if (ctx.originalRequest) {
    lines.push(`## ユーザーの当初の要望\n${ctx.originalRequest}`)
  }
  lines.push('')
  lines.push('## 埋めたいブロック (kind: ' + block.kind + ')')
  lines.push('```markdown')
  lines.push(block.rawText.trimEnd())
  lines.push('```')
  lines.push('')
  lines.push('期待する応答: 埋めた Markdown ブロックの本文のみ (コードフェンス不要、前置き不要)。')
  return lines.join('\n')
}

/**
 * Claude が返してきた最終応答テキストから「Markdown 表」だけを抽出する (2026-05-07 厳格化)。
 *
 * 戦略:
 *  - コードフェンスがあれば中身を取り出す
 *  - 中身から最初の "|...|" 行 (= 表のヘッダ行) を見つけて、そこから連続する "|...|" 行 + 注釈行 (* or ※) のみを返す
 *  - 表が見つからない / 不完全 (区切り行欠落) なら null を返す → 呼び出し側で「失敗」扱いにする
 *
 * ※「以下が埋めた表です:」「query_metric の利用可能なメトリクスを教えてください」のような
 *   メタ文 / ユーザーへの質問返しを混ぜさせないため、表以外の行は完全に捨てる。
 */
export function extractTableFromResponse(text: string): string | null {
  let stripped = text.trim()
  // コードフェンスを剥がす
  const fenceMatch = stripped.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/i)
  if (fenceMatch) stripped = fenceMatch[1].trim()

  const lines = stripped.split('\n')

  // 最初の "|...|" 行を探す (= 表のヘッダ候補)
  const headerIdx = lines.findIndex(
    (l) => l.trim().startsWith('|') && l.trim().endsWith('|')
  )
  if (headerIdx === -1) return null

  // 区切り行が headerIdx+1 にあるか? (Markdown 表の必須要素)
  const sepLine = lines[headerIdx + 1]?.trim() ?? ''
  const isSeparator =
    sepLine.startsWith('|') &&
    sepLine.endsWith('|') &&
    sepLine.slice(1, -1).split('|').every((c) => /^:?-+:?$/.test(c.trim()))
  if (!isSeparator) return null

  // 表本体を集める
  const tableLines: string[] = [lines[headerIdx], lines[headerIdx + 1]]
  let endIdx = headerIdx + 2
  while (
    endIdx < lines.length &&
    lines[endIdx].trim().startsWith('|') &&
    lines[endIdx].trim().endsWith('|')
  ) {
    tableLines.push(lines[endIdx])
    endIdx++
  }

  // 表直後の注釈行 (* 集計期間: ... / ※ 〇〇は取得できませんでした) を 1〜数行だけ取り込む。
  // ただし長文や箇条書き (- や ## 見出し) は含めない (元の文脈を破壊するため)。
  while (endIdx < lines.length) {
    const t = lines[endIdx].trim()
    if (t === '') {
      endIdx++
      break
    }
    if (t.startsWith('*') || t.startsWith('※')) {
      tableLines.push(lines[endIdx])
      endIdx++
      continue
    }
    break
  }

  return tableLines.join('\n').trim()
}

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
 * メインエントリ: レポート Markdown 中の空き穴を Claude Tool Use で自動補完する。
 * シンプル方針: 1 ブロック = 1 Claude セッションで完結 (グループ化はしない)。
 * 並列で実行することでスループットを稼ぐ。
 */
export async function autoFillReportGaps(
  markdown: string,
  groups: GapGroup[],
  ctx: AutoFillContext
): Promise<AutoFillResult> {
  const start = Date.now()
  const blockTimeoutMs = ctx.blockTimeoutMs ?? 30_000

  // groups から block を全部取り出して並列実行
  const allBlocks = groups.flatMap((g) => g.blocks)
  if (allBlocks.length === 0) {
    return { filledMarkdown: markdown, attempts: [], anySuccess: false, totalMs: 0 }
  }

  const blockResults = await Promise.all(
    allBlocks.map(async (block) => {
      const blockStart = Date.now()
      try {
        const r = await withTimeout(
          fillOneBlock(block, ctx),
          blockTimeoutMs,
          `auto-fill block (${block.kind})`
        )
        return { block, ...r, tookMs: Date.now() - blockStart }
      } catch (e) {
        return {
          block,
          filledText: null as string | null,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: [] as Array<{ name: string; argsJson: string }>,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - blockStart,
        }
      }
    })
  )

  // 後ろから順に Markdown に差し込む (offset がずれないように)
  let filledMarkdown = markdown
  const attempts: AutoFillResult['attempts'] = []
  let anySuccess = false

  const sortedResults = blockResults
    .map((r) => ({
      ...r,
      extracted: r.filledText ? extractTableFromResponse(r.filledText) : null,
    }))
    .sort((a, b) => b.block.start - a.block.start)

  for (const r of sortedResults) {
    const ok =
      r.extracted != null &&
      r.extracted.length > 0 &&
      r.extracted.trim() !== r.block.rawText.trim()

    if (ok && r.extracted) {
      const fill = r.extracted
      filledMarkdown =
        filledMarkdown.slice(0, r.block.start) +
        fill +
        (fill.endsWith('\n') ? '' : '\n') +
        filledMarkdown.slice(r.block.end)
      anySuccess = true
    }

    attempts.push({
      chapterTitle: r.block.chapterTitle,
      blockCount: 1,
      ok,
      tookMs: r.tookMs,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      toolCalls: r.toolCalls,
      ...(ok
        ? {}
        : {
            error: r.error ?? '埋めた内容が元と同一だったためスキップ',
          }),
    })
  }

  return {
    filledMarkdown,
    attempts,
    anySuccess,
    totalMs: Date.now() - start,
  }
}
