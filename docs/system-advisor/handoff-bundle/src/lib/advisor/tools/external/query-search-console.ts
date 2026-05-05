import type { AdvisorTool } from '../types'
import {
  querySearchAnalytics,
  isSearchConsoleConfigured,
  type SearchConsoleDimension,
  type SearchConsoleSearchType,
} from '@/src/lib/search-console-client'

interface Input {
  start_date: string
  end_date: string
  dimensions?: SearchConsoleDimension[]
  row_limit?: number
  search_type?: SearchConsoleSearchType
}

interface Output {
  rows: Array<{
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
  totals: { clicks: number; impressions: number }
  period: { start: string; end: string }
  site_url: string
  source_note: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const querySearchConsoleTool: AdvisorTool<Input, Output> = {
  name: 'query_search_console',
  category: 'external',
  description:
    'Google Search Console (GSC) から検索クエリ別の流入データを取得します。' +
    '\n\n用途: 「どんな検索ワードで来てる?」「直近の検索流入トップ10」「特定ページの検索順位」' +
    '\n\nGA4 では検索クエリ別の流入は取得できません (個人情報保護のため)。GSC が唯一の手段です。' +
    '\n\ndimensions に [query] を指定すると検索ワード別、[page] でページ別、[query, page] で組み合わせ。' +
    'dimensions を空配列にすると期間全体の totals (clicks/impressions) のみ返ります。',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: { type: 'string', description: 'YYYY-MM-DD (JST)' },
      end_date: { type: 'string', description: 'YYYY-MM-DD (JST)' },
      dimensions: {
        type: 'array',
        items: { type: 'string', enum: ['query', 'page', 'country', 'device', 'date'] },
        description: '集計軸。例: ["query"] で検索ワード別',
      },
      row_limit: {
        type: 'integer',
        default: 50,
        maximum: 500,
        description: '返却行数上限 (最大 500)',
      },
      search_type: {
        type: 'string',
        enum: ['web', 'image', 'video', 'news'],
        default: 'web',
        description: '検索タイプ。通常は web で OK',
      },
    },
    required: ['start_date', 'end_date'],
  },
  outputDescription:
    '{ rows: 行毎の clicks/impressions/ctr/position, totals, period, site_url }',
  async available() {
    return isSearchConsoleConfigured()
  },
  async execute(input) {
    const start = Date.now()
    if (!DATE_RE.test(input.start_date) || !DATE_RE.test(input.end_date)) {
      return { ok: false, error: '日付は YYYY-MM-DD 形式で指定してください' }
    }
    try {
      const result = await querySearchAnalytics({
        startDate: input.start_date,
        endDate: input.end_date,
        dimensions: input.dimensions,
        rowLimit: input.row_limit,
        searchType: input.search_type,
      })
      return {
        ok: true,
        data: {
          rows: result.rows,
          totals: result.totals,
          period: result.period,
          site_url: result.siteUrl,
          source_note: `Google Search Console API 経由 (Site: ${result.siteUrl})`,
        },
        metadata: { tookMs: Date.now() - start, rowCount: result.rows.length },
      }
    } catch (e) {
      return {
        ok: false,
        error: `Search Console 取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  },
}
