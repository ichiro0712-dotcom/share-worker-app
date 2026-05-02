/**
 * Gemini API 直叩きで初回レポートドラフトを作成するヘルパー
 *
 * Anthropic ノードアフィニティ問題 (loop=1 TTFB 100 秒級) を全工程で回避するため、
 * `[TOOL:report_create]` で来る初回ドラフト作成依頼も Gemini Flash で直接処理する。
 *
 * editDraftWithGemini (修正用) と対をなす。
 * 修正版と違い、ユーザーの自由文要望から要件 (title / goal / range / data_sources /
 * metric_keys / outline / notes) と 0 埋め skeleton_markdown を 1 回の JSON 出力で
 * 全部生成する。
 */

import { generateWithGemini } from './gemini'
import { METRIC_CATALOG } from '../tools/tastas-data/metrics-catalog'
import { formatJST } from '../jst'

/** Gemini に提示するメトリクス候補一覧 (available のみ、key + label + 説明) */
function buildMetricsCatalogForPrompt(): string {
  const lines: string[] = []
  for (const m of METRIC_CATALOG) {
    if (!m.available) continue
    const groupBy = m.supportedGroupBy.join(' / ')
    lines.push(`- \`${m.key}\` (${m.label}, 単位: ${m.unit}): ${m.description} [group_by: ${groupBy}]`)
  }
  return lines.join('\n')
}

/** Gemini に提示するデータソース (toolKey) 候補 */
const DATA_SOURCE_OPTIONS = [
  { key: 'query_metric', label: '本番 DB 指標集計', note: 'metric_keys を必ず一緒に指定すること' },
  { key: 'query_ga4', label: 'Google Analytics 4', note: 'ページビュー / セッション / 流入元' },
  { key: 'query_search_console', label: 'Google Search Console', note: '検索キーワード / 順位 / CTR' },
  { key: 'get_jobs_summary', label: '求人サマリ', note: '求人テーブルの現状' },
  { key: 'get_users_summary', label: 'ユーザーサマリ', note: 'ワーカー / 管理者の総数' },
  { key: 'get_recent_errors', label: 'エラーログ', note: '直近のシステムエラー' },
  { key: 'get_supabase_logs', label: 'Supabase ログ', note: 'Auth / Postgres' },
  { key: 'get_vercel_logs', label: 'Vercel ログ', note: 'ランタイムログ' },
  { key: 'get_recent_commits', label: 'GitHub コミット', note: '最近の変更履歴' },
]

function buildDataSourceListForPrompt(): string {
  return DATA_SOURCE_OPTIONS.map((d) => `- \`${d.key}\` (${d.label}): ${d.note}`).join('\n')
}

export interface CreateDraftParams {
  /** ユーザーが書いた要望本文 ([TOOL:report_create] プレフィックスは剥がした) */
  userRequest: string
  /** 「今日」「先週」を解釈するための現在時刻 (JST) */
  nowJst?: Date
  abortSignal?: AbortSignal
}

export interface CreateDraftResult {
  title: string
  goal: string
  rangeStart: string | null
  rangeEnd: string | null
  dataSources: string[]
  metricKeys: string[]
  outline: string
  notes: string
  skeletonMarkdown: string
  /** 1〜2 行 (50〜120 字) のチャット返答テキスト */
  summary: string
  metrics: {
    elapsedMs: number
    inputTokens: number
    outputTokens: number
    model: string
  }
}

const SYSTEM_PROMPT = `あなたは TASTAS (看護師・介護士向け求人マッチング) のレポート作成アシスタントです。
ユーザーの自由文要望から、レポートドラフトの要件と 0 埋め skeleton_markdown を JSON で生成してください。

# 役割分担 (重要)
- あなたの仕事 = 要件確定 + skeleton (0 埋め骨格) 作成
- 数字を集めて本文を書く仕事 = 別系統 (ユーザーが「レポート作成」ボタンを押した後)
- データ収集ツール (query_metric / query_ga4 等) を呼ぶ必要は無い (呼べない)

# 出力ルール (絶対遵守)
- skeleton_markdown は 0 埋めの表骨格 + 章立てのみ。実数字は入れない (0 / "-" / "(コメント)")
- 章数は 3〜6 個 (## 見出し)
- グラフ / チャート未対応のため、グラフ要望が来ても表で代替する
- 期間が曖昧な要望 ("先週" 等) は今日の日付から JST で解釈する
- データソースに query_metric を選ぶなら metric_keys 必須

# 出力フォーマット (必ず JSON のみ、コードブロックや前置き禁止)
{
  "title": "<レポートタイトル (1 行)>",
  "goal": "<目的 1 文>",
  "range_start": "YYYY-MM-DD or null",
  "range_end": "YYYY-MM-DD or null",
  "data_sources": ["query_metric", "query_ga4", ...],
  "metric_keys": ["LP_PV", "LP_TO_LINE_CONV", ...],
  "outline": "## サマリ\\n## 主要 KPI\\n## 流入分析\\n## 次のアクション",
  "notes": "<除外条件 / 補足 1〜3 行>",
  "skeleton_markdown": "<0 埋めの表骨格 Markdown 全体>",
  "summary": "<1〜2 行 (50〜120 字) で何を作ったかチャット返答用テキスト>"
}
`

function buildUserPrompt(params: CreateDraftParams): string {
  const now = params.nowJst ?? new Date()
  const todayStr = formatJST(now).slice(0, 10) // YYYY-MM-DD
  return `# 現在の日時 (JST)
${formatJST(now)} (今日 = ${todayStr})

# ユーザーの要望
${params.userRequest}

# 利用可能なメトリクス (query_metric の metric_key 候補)
${buildMetricsCatalogForPrompt()}

# 利用可能なデータソース (data_sources の値)
${buildDataSourceListForPrompt()}

上記の出力フォーマットに従って JSON のみを返してください。`
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function parseCreateResponse(text: string): {
  title: string
  goal: string
  range_start: string | null
  range_end: string | null
  data_sources: string[]
  metric_keys: string[]
  outline: string
  notes: string
  skeleton_markdown: string
  summary: string
} {
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini レスポンスが空でした')
  }

  let parsed: unknown = tryParse(text.trim())
  if (!parsed) {
    const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
    if (fenced) parsed = tryParse(fenced[1].trim())
  }
  if (!parsed) {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      parsed = tryParse(text.slice(firstBrace, lastBrace + 1))
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Gemini レスポンスから JSON を抽出できませんでした (length=${text.length})`)
  }

  const o = parsed as Record<string, unknown>
  const skeleton =
    typeof o.skeleton_markdown === 'string' ? o.skeleton_markdown :
    typeof o.updated_skeleton === 'string' ? o.updated_skeleton : null
  if (!skeleton || skeleton.length < 30) {
    throw new Error('skeleton_markdown が見つからないか短すぎます')
  }
  const title = typeof o.title === 'string' ? o.title : '(タイトル未設定)'
  const goal = typeof o.goal === 'string' ? o.goal : ''
  const range_start = typeof o.range_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.range_start) ? o.range_start : null
  const range_end = typeof o.range_end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.range_end) ? o.range_end : null
  const data_sources = Array.isArray(o.data_sources) ? o.data_sources.filter((x): x is string => typeof x === 'string') : []
  const metric_keys = Array.isArray(o.metric_keys) ? o.metric_keys.filter((x): x is string => typeof x === 'string') : []
  const outline = typeof o.outline === 'string' ? o.outline : ''
  const notes = typeof o.notes === 'string' ? o.notes : ''
  const summary = typeof o.summary === 'string' && o.summary.length > 0
    ? o.summary
    : 'Canvas にレポートドラフトを作成しました。修正があればご指示ください。'

  return {
    title, goal, range_start, range_end, data_sources, metric_keys,
    outline, notes, skeleton_markdown: skeleton, summary,
  }
}

/**
 * Gemini Flash で初回レポートドラフトを作成する。
 * 失敗時は throw する (orchestrator 側で catch して Anthropic ルートに fall through)。
 */
export async function createDraftWithGemini(params: CreateDraftParams): Promise<CreateDraftResult> {
  const userPrompt = buildUserPrompt(params)
  const result = await generateWithGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jsonMode: true,
    abortSignal: params.abortSignal,
  })

  const parsed = parseCreateResponse(result.text)

  return {
    title: parsed.title,
    goal: parsed.goal,
    rangeStart: parsed.range_start,
    rangeEnd: parsed.range_end,
    dataSources: parsed.data_sources,
    metricKeys: parsed.metric_keys,
    outline: parsed.outline,
    notes: parsed.notes,
    skeletonMarkdown: parsed.skeleton_markdown,
    summary: parsed.summary,
    metrics: {
      elapsedMs: result.tookMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    },
  }
}
