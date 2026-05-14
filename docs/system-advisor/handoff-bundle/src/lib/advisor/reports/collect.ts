/**
 * @spec    docs/04_REPORT_FEATURE.md §3.3 (レポート本文生成)
 * @related knowledge/DATA_COLLECTION_PATTERNS.md §1 (ツール能力フル展開設計)
 *
 * data_sources を並列に展開してデータ収集する。
 * ツールに enum パラメータがあれば全パターンを並列実行 (Promise.all)。
 * 各ツール出力は 50KB 切り詰め (DATA_COLLECTION_PATTERNS §3)。
 */

/**
 * レポートのデータ収集
 *
 * ドラフトの `dataSources` で指定されたツールキー一覧に対して、
 * 期間 (range_start / range_end) などの共通引数を流し込みつつ並列実行する。
 *
 * 各ツールの引数仕様が異なるため、ここでツール名 → 引数組立 のマッピングを集中管理する。
 * 未知のツールは無視せず "skipped" として記録 (LLM への診断材料)。
 */

import { executeToolByName } from '../tools/registry'
import { resolveToolSource } from '../tool-source-labels'
import { METRIC_CATALOG, type MetricGroupBy } from '../tools/tastas-data/metrics-catalog'

export interface CollectInput {
  adminId: number
  sessionId: string
  rangeStart: string | null
  rangeEnd: string | null
  toolKeys: string[]
  /** dataSources に "query_metric" が含まれる場合に取得する metric キー一覧 */
  metricKeys?: string[]
}

export interface CollectedItem {
  toolName: string
  label: string
  ok: boolean
  /** ok=true 時のデータ (ツールごとに型は異なる、JSON.stringify で吸収) */
  data?: unknown
  error?: string
  tookMs?: number
}

export interface CollectResult {
  items: CollectedItem[]
  totalMs: number
}

/**
 * ツール名 → ToolContext.execute に渡す input を組み立てる関数。
 * 期間を必要とするツールは range をそのまま渡す。
 * 未対応ツールは null を返す (skipped 扱い)。
 *
 * 注: `query_metric` だけは "1 ツールキー = 1 呼び出し" の枠に収まらないため
 * 別経路 (collectReportData 内の expandQueryMetricTasks) で処理する。
 */
function buildInputFor(
  toolName: string,
  range: { start: string | null; end: string | null }
): unknown | null {
  switch (toolName) {
    case 'query_ga4':
      // 単独呼び出し用 (overview のみ)。実際は collectReportData 内の expandQueryGa4Tasks で
      // 複数の report_type を並列展開するため、こちらは null を返してスキップ扱いにする。
      // (互換性: range が未指定なら null。期間ありなら overview を返すが下記 expandQueryGa4Tasks で
      //  上書きされるため通常使われない。)
      return null

    case 'query_search_console':
      // 単独呼び出しのフォールバック (旧仕様の query のみ)。
      // 実際は collectReportData 内の expandQuerySearchConsoleTasks で複数 dimension を並列展開。
      return null

    case 'get_jobs_summary':
      // 期間引数は不要 (現状スナップショット)
      return {}

    case 'get_users_summary':
      return {}

    case 'get_recent_errors':
      // 直近の件数指定。期間は内部で 24h 等に固定されている前提で limit のみ
      return { limit: 50 }

    case 'list_available_metrics':
      // 廃止済みツール。古いドラフトに残っている場合は無音スキップ。
      return null

    case 'query_metric':
      // metric_keys ごとに個別呼び出しするため、ここでは null を返してスキップ扱いにする。
      // 実際の呼び出しは collectReportData 内の expandQueryMetricTasks で展開する。
      return null

    case 'get_supabase_logs':
      // expandSupabaseLogsTasks で source 別 (postgres/api/auth) に並列展開するため null
      return null

    case 'get_vercel_logs':
      // expandVercelLogsTasks で level 別 (error/warning/info) に並列展開するため null
      return null

    case 'get_vercel_deployments':
      // expandVercelDeploymentsTasks で env 別 (production/preview) に並列展開するため null
      return null

    case 'get_recent_commits':
      return { limit: 30 }

    default:
      return null
  }
}

/**
 * `query_metric` を含むツール一覧を、metric ごとの個別タスクに展開する。
 * - 元のツール一覧から `query_metric` を取り除き
 * - `metricKeys` の各 key について 1 個ずつ「query_metric (key)」の擬似タスクを足す
 *
 * 戻り値の `extraTasks` は collectReportData が直接 awaitable な Promise として扱える形。
 */
function expandQueryMetricTasks(input: {
  metricKeys: string[]
  range: { start: string | null; end: string | null }
  adminId: number
  sessionId: string
}): Array<Promise<CollectedItem>> {
  const baseLabel = resolveToolSource('query_metric').label
  if (!input.range.start || !input.range.end) {
    return [
      Promise.resolve({
        toolName: 'query_metric',
        label: baseLabel,
        ok: false,
        error: 'range_start / range_end が未指定のため query_metric を実行できません',
      }),
    ]
  }
  if (input.metricKeys.length === 0) {
    return [
      Promise.resolve({
        toolName: 'query_metric',
        label: baseLabel,
        ok: false,
        error:
          'metric_keys が空です。LLM に「list_available_metrics で利用可能な指標を確認して metric_keys を選んでください」と依頼してください',
      }),
    ]
  }

  // 各 metric について、metrics-catalog で宣言された supportedGroupBy 全部で並列取得する。
  // 例: LP_PV は ['none', 'day', 'lp_id', 'campaign_code'] → 4 回 query_metric を叩く。
  // これにより本文生成時に Gemini が「期間合計」「日別グラフ」「LP 別表」を作る素材を得られる。
  // 未知の metric (catalog に無い) は 'none' のみ取得 (フォールバック)。
  const tasks: Array<Promise<CollectedItem>> = []
  for (const metricKey of input.metricKeys) {
    const def = METRIC_CATALOG.find((m) => m.key === metricKey)
    const groupBys: MetricGroupBy[] = def?.supportedGroupBy ?? ['none']
    for (const groupBy of groupBys) {
      tasks.push(runMetricQuery({
        metricKey,
        groupBy,
        rangeStart: input.range.start,
        rangeEnd: input.range.end,
        adminId: input.adminId,
        sessionId: input.sessionId,
      }))
    }
  }
  return tasks
}

/** 単一の query_metric 呼び出しを CollectedItem に包む */
async function runMetricQuery(input: {
  metricKey: string
  groupBy: MetricGroupBy
  rangeStart: string
  rangeEnd: string
  adminId: number
  sessionId: string
}): Promise<CollectedItem> {
  const itemStart = Date.now()
  const baseLabel = resolveToolSource('query_metric').label
  // 表示用ラベルに groupBy も含めて Gemini プロンプトでの可読性を上げる
  const label = `${baseLabel} (${input.metricKey} / group_by=${input.groupBy})`
  try {
    const result = await executeToolByName(
      'query_metric',
      {
        metric_key: input.metricKey,
        start_date: input.rangeStart,
        end_date: input.rangeEnd,
        group_by: input.groupBy,
      },
      { adminId: input.adminId, sessionId: input.sessionId }
    )
    const tookMs = Date.now() - itemStart
    if (result.ok) {
      return {
        toolName: `query_metric:${input.metricKey}:${input.groupBy}`,
        label,
        ok: true,
        data: result.data,
        tookMs,
      }
    }
    return {
      toolName: `query_metric:${input.metricKey}:${input.groupBy}`,
      label,
      ok: false,
      error: result.error,
      tookMs,
    }
  } catch (e) {
    return {
      toolName: `query_metric:${input.metricKey}:${input.groupBy}`,
      label,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      tookMs: Date.now() - itemStart,
    }
  }
}

/** 既に廃止されたが古いドラフトに残っている可能性があるツール名 */
const DEPRECATED_TOOL_KEYS = new Set(['list_available_metrics'])

/**
 * query_ga4 を複数 report_type で並列展開する。
 * GA4 ツールは report_type ごとに異なる dimensions / metrics を返すため、レポート用は
 * overview (全体合計 + 日別) / traffic (流入経路 = source/medium) / pages (ページ別 PV) の
 * 3 種類を必ず並列で取得し、Gemini が「流入経路 Top5」「ページ別 Top5」「日別推移」を
 * 全部書けるようにする。
 *
 * 1 種類だけ (overview) だと「流入経路別データが取得できていない」と Gemini が誤判定する事象あり。
 */
function expandQueryGa4Tasks(input: {
  range: { start: string | null; end: string | null }
  adminId: number
  sessionId: string
}): Array<Promise<CollectedItem>> {
  const baseLabel = resolveToolSource('query_ga4').label
  if (!input.range.start || !input.range.end) {
    return [
      Promise.resolve({
        toolName: 'query_ga4',
        label: baseLabel,
        ok: false,
        error: 'range_start / range_end が未指定のため query_ga4 を実行できません',
      }),
    ]
  }
  // 前期間を自動算出 (今期間と同じ日数だけ前にずらす)。comparison report_type で使う。
  // 例: range_start=2026-04-28, range_end=2026-05-04 (7日間)
  //   → previous_start=2026-04-21, previous_end=2026-04-27
  const startDate = new Date(input.range.start + 'T00:00:00Z')
  const endDate = new Date(input.range.end + 'T00:00:00Z')
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  const prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000) // 開始日の前日
  const prevStartDate = new Date(prevEndDate.getTime() - daysDiff * 24 * 60 * 60 * 1000)
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
  const prevStart = fmtDate(prevStartDate)
  const prevEnd = fmtDate(prevEndDate)

  // GA4 ツールが受け付ける report_type 5 種:
  //   - overview / traffic / pages / lpPerformance: start/end のみ
  //   - comparison: 前期間との比較 (current_* / previous_* を自動算出して渡す)
  const reportTypes = ['overview', 'traffic', 'pages', 'lpPerformance', 'comparison'] as const
  return reportTypes.map((reportType) => {
    return (async (): Promise<CollectedItem> => {
      const itemStart = Date.now()
      const label = `${baseLabel} (${reportType})`
      const args: Record<string, unknown> =
        reportType === 'comparison'
          ? {
              report_type: reportType,
              start_date: input.range.start,
              end_date: input.range.end,
              current_start: input.range.start,
              current_end: input.range.end,
              previous_start: prevStart,
              previous_end: prevEnd,
            }
          : {
              report_type: reportType,
              start_date: input.range.start,
              end_date: input.range.end,
            }
      try {
        const result = await executeToolByName('query_ga4', args, {
          adminId: input.adminId,
          sessionId: input.sessionId,
        })
        const tookMs = Date.now() - itemStart
        if (result.ok) {
          return { toolName: 'query_ga4', label, ok: true, data: result.data, tookMs }
        }
        return { toolName: 'query_ga4', label, ok: false, error: result.error, tookMs }
      } catch (e) {
        return {
          toolName: 'query_ga4',
          label,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - itemStart,
        }
      }
    })()
  })
}

/**
 * query_search_console を複数 dimension で並列展開する。
 * Search Console は dimension ごとに違う集計を返すため:
 *   - query: 検索キーワード別 (Top キーワード)
 *   - page: ページ別 (どの URL に検索流入が来てるか)
 *   - device: デバイス別 (mobile / desktop / tablet)
 *   - country: 国別
 * これらを並列で取得して、Gemini が「ページ別流入 Top10」等を書けるようにする。
 */
function expandQuerySearchConsoleTasks(input: {
  range: { start: string | null; end: string | null }
  adminId: number
  sessionId: string
}): Array<Promise<CollectedItem>> {
  const baseLabel = resolveToolSource('query_search_console').label
  if (!input.range.start || !input.range.end) {
    return [
      Promise.resolve({
        toolName: 'query_search_console',
        label: baseLabel,
        ok: false,
        error: 'range_start / range_end が未指定のため query_search_console を実行できません',
      }),
    ]
  }
  const dimensions: Array<'query' | 'page' | 'device' | 'country'> = [
    'query',
    'page',
    'device',
    'country',
  ]
  return dimensions.map((dim) => {
    return (async (): Promise<CollectedItem> => {
      const itemStart = Date.now()
      const label = `${baseLabel} (${dim})`
      try {
        const result = await executeToolByName(
          'query_search_console',
          {
            start_date: input.range.start,
            end_date: input.range.end,
            dimensions: [dim],
            row_limit: 50,
          },
          { adminId: input.adminId, sessionId: input.sessionId }
        )
        const tookMs = Date.now() - itemStart
        if (result.ok) {
          return { toolName: 'query_search_console', label, ok: true, data: result.data, tookMs }
        }
        return { toolName: 'query_search_console', label, ok: false, error: result.error, tookMs }
      } catch (e) {
        return {
          toolName: 'query_search_console',
          label,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - itemStart,
        }
      }
    })()
  })
}

/**
 * get_supabase_logs を source 別 (postgres / api / auth) で並列展開する。
 * デフォルトは混在するため、Gemini が「auth エラーだけ集計」等の分析をしづらい問題を解消。
 */
function expandSupabaseLogsTasks(input: {
  adminId: number
  sessionId: string
}): Array<Promise<CollectedItem>> {
  const baseLabel = resolveToolSource('get_supabase_logs').label
  const sources = ['postgres', 'api', 'auth'] as const
  return sources.map((source) => {
    return (async (): Promise<CollectedItem> => {
      const itemStart = Date.now()
      const label = `${baseLabel} (${source})`
      try {
        const result = await executeToolByName(
          'get_supabase_logs',
          { window: 'last_24h', limit: 50, source },
          { adminId: input.adminId, sessionId: input.sessionId }
        )
        const tookMs = Date.now() - itemStart
        if (result.ok) {
          return { toolName: 'get_supabase_logs', label, ok: true, data: result.data, tookMs }
        }
        return { toolName: 'get_supabase_logs', label, ok: false, error: result.error, tookMs }
      } catch (e) {
        return {
          toolName: 'get_supabase_logs',
          label,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - itemStart,
        }
      }
    })()
  })
}

/**
 * get_vercel_logs を level 別 (error / warning / info) で並列展開する。
 * デフォルトは混在 → error と warning を分けて分析できるように。
 */
function expandVercelLogsTasks(input: {
  adminId: number
  sessionId: string
}): Array<Promise<CollectedItem>> {
  const baseLabel = resolveToolSource('get_vercel_logs').label
  const levels = ['error', 'warning', 'info'] as const
  return levels.map((level) => {
    return (async (): Promise<CollectedItem> => {
      const itemStart = Date.now()
      const label = `${baseLabel} (${level})`
      try {
        const result = await executeToolByName(
          'get_vercel_logs',
          { limit: 50, level },
          { adminId: input.adminId, sessionId: input.sessionId }
        )
        const tookMs = Date.now() - itemStart
        if (result.ok) {
          return { toolName: 'get_vercel_logs', label, ok: true, data: result.data, tookMs }
        }
        return { toolName: 'get_vercel_logs', label, ok: false, error: result.error, tookMs }
      } catch (e) {
        return {
          toolName: 'get_vercel_logs',
          label,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - itemStart,
        }
      }
    })()
  })
}

/**
 * get_vercel_deployments を env 別 (production / preview) で並列展開する。
 * 本番デプロイだけのフィルタとプレビュー含む全体を別々に取得。
 */
function expandVercelDeploymentsTasks(input: {
  adminId: number
  sessionId: string
}): Array<Promise<CollectedItem>> {
  const baseLabel = resolveToolSource('get_vercel_deployments').label
  const envs = ['production', 'preview'] as const
  return envs.map((env) => {
    return (async (): Promise<CollectedItem> => {
      const itemStart = Date.now()
      const label = `${baseLabel} (${env})`
      try {
        const result = await executeToolByName(
          'get_vercel_deployments',
          { limit: 20, env },
          { adminId: input.adminId, sessionId: input.sessionId }
        )
        const tookMs = Date.now() - itemStart
        if (result.ok) {
          return {
            toolName: 'get_vercel_deployments',
            label,
            ok: true,
            data: result.data,
            tookMs,
          }
        }
        return {
          toolName: 'get_vercel_deployments',
          label,
          ok: false,
          error: result.error,
          tookMs,
        }
      } catch (e) {
        return {
          toolName: 'get_vercel_deployments',
          label,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - itemStart,
        }
      }
    })()
  })
}

export async function collectReportData(input: CollectInput): Promise<CollectResult> {
  const start = Date.now()
  const range = { start: input.rangeStart, end: input.rangeEnd }

  // 廃止済みのツール名をドラフトから除外 (古いセッション救済)
  const liveToolKeys = input.toolKeys.filter((k) => !DEPRECATED_TOOL_KEYS.has(k))

  // 複数引数パターンで並列展開するツールはここで分離する。
  // - query_metric: metric_keys × group_by 全展開
  // - query_ga4: report_type 5 種展開
  // - query_search_console: dimensions 4 種展開
  // - get_supabase_logs: source 3 種展開
  // - get_vercel_logs: level 3 種展開
  // - get_vercel_deployments: env 2 種展開
  const includesQueryMetric = liveToolKeys.includes('query_metric')
  const includesQueryGa4 = liveToolKeys.includes('query_ga4')
  const includesSearchConsole = liveToolKeys.includes('query_search_console')
  const includesSupabaseLogs = liveToolKeys.includes('get_supabase_logs')
  const includesVercelLogs = liveToolKeys.includes('get_vercel_logs')
  const includesVercelDeployments = liveToolKeys.includes('get_vercel_deployments')
  const expandedKeys = new Set([
    'query_metric',
    'query_ga4',
    'query_search_console',
    'get_supabase_logs',
    'get_vercel_logs',
    'get_vercel_deployments',
  ])
  const otherToolKeys = liveToolKeys.filter((k) => !expandedKeys.has(k))

  const baseTasks = otherToolKeys.map(async (toolName): Promise<CollectedItem> => {
    const args = buildInputFor(toolName, range)
    const label = resolveToolSource(toolName).label
    if (args === null) {
      return {
        toolName,
        label,
        ok: false,
        error: 'このツールはレポート用の自動引数が未定義のためスキップされました',
      }
    }
    const itemStart = Date.now()
    try {
      const result = await executeToolByName(toolName, args, {
        adminId: input.adminId,
        sessionId: input.sessionId,
      })
      const tookMs = Date.now() - itemStart
      if (result.ok) {
        return { toolName, label, ok: true, data: result.data, tookMs }
      }
      return { toolName, label, ok: false, error: result.error, tookMs }
    } catch (e) {
      return {
        toolName,
        label,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        tookMs: Date.now() - itemStart,
      }
    }
  })

  const metricTasks = includesQueryMetric
    ? expandQueryMetricTasks({
        metricKeys: input.metricKeys ?? [],
        range,
        adminId: input.adminId,
        sessionId: input.sessionId,
      })
    : []

  const ga4Tasks = includesQueryGa4
    ? expandQueryGa4Tasks({ range, adminId: input.adminId, sessionId: input.sessionId })
    : []

  const searchConsoleTasks = includesSearchConsole
    ? expandQuerySearchConsoleTasks({
        range,
        adminId: input.adminId,
        sessionId: input.sessionId,
      })
    : []

  const supabaseTasks = includesSupabaseLogs
    ? expandSupabaseLogsTasks({ adminId: input.adminId, sessionId: input.sessionId })
    : []

  const vercelLogTasks = includesVercelLogs
    ? expandVercelLogsTasks({ adminId: input.adminId, sessionId: input.sessionId })
    : []

  const vercelDeployTasks = includesVercelDeployments
    ? expandVercelDeploymentsTasks({ adminId: input.adminId, sessionId: input.sessionId })
    : []

  const items = await Promise.all([
    ...baseTasks,
    ...metricTasks,
    ...ga4Tasks,
    ...searchConsoleTasks,
    ...supabaseTasks,
    ...vercelLogTasks,
    ...vercelDeployTasks,
  ])
  return { items, totalMs: Date.now() - start }
}