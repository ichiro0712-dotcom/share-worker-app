import type { AdvisorTool } from '../types';
import {
  fetchOverviewReport,
  fetchTrafficReport,
  fetchPagesReport,
  fetchLpPerformanceReport,
  fetchComparisonReport,
  fetchPageTrafficReport,
} from '@/src/lib/ga-client';

interface Input {
  report_type:
    | 'overview'
    | 'traffic'
    | 'pages'
    | 'lpPerformance'
    | 'comparison'
    | 'pageTraffic';
  start_date: string;
  end_date: string;
  current_start?: string;
  current_end?: string;
  previous_start?: string;
  previous_end?: string;
  /** pageTraffic 用: 対象ページパスの前方一致 (例: "/lp/30") */
  page_path_prefix?: string;
  /** pageTraffic 用: 対象ページパスの部分一致 (例: "30") */
  page_path_contains?: string;
}

interface Output {
  report_type: string;
  data: unknown;
  source_note: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const queryGa4Tool: AdvisorTool<Input, Output> = {
  name: 'query_ga4',
  category: 'external',
  description:
    'Google Analytics 4 (GA4) のレポートデータを取得します。' +
    '\n\n6種類のレポート:' +
    '\n- overview: 概要 (日別 PV/UU/セッション/直帰率/滞在時間)' +
    '\n- traffic: 流入元×メディア別 (サイト全体)' +
    '\n- pages: ページ別 PV/UU/滞在時間 (上位 100)' +
    '\n- lpPerformance: LP配下 (/lp/*) のメトリクス' +
    '\n- comparison: 期間比較 (今期 vs 前期)' +
    '\n- pageTraffic: **ページ × 流入元のクロス集計** (例: LP30 の流入元別 PV)' +
    '\n\npageTraffic では page_path_prefix (前方一致, 例: "/lp/30") か page_path_contains (部分一致) で対象ページを必ず絞ること' +
    '\n\n使用例: 「先週のセッション数」「LP別アクセス」「流入元」「先週vs今週の比較」「LP30 にどこから来た?」' +
    '\n\n注意: GA4 のデータは GTM 経由で計測されており、自前トラッキング (LpPageView) と数値が異なる場合があります。',
  inputSchema: {
    type: 'object',
    properties: {
      report_type: {
        type: 'string',
        enum: ['overview', 'traffic', 'pages', 'lpPerformance', 'comparison', 'pageTraffic'],
      },
      start_date: { type: 'string', description: 'YYYY-MM-DD (JST)' },
      end_date: { type: 'string', description: 'YYYY-MM-DD (JST)' },
      current_start: { type: 'string', description: 'comparison のみ。現在期間の開始' },
      current_end: { type: 'string', description: 'comparison のみ。現在期間の終了' },
      previous_start: { type: 'string', description: 'comparison のみ。比較期間の開始' },
      previous_end: { type: 'string', description: 'comparison のみ。比較期間の終了' },
      page_path_prefix: {
        type: 'string',
        description: 'pageTraffic のみ。対象ページパスの前方一致 (例: "/lp/30", "/api/lp/30")',
      },
      page_path_contains: {
        type: 'string',
        description: 'pageTraffic のみ。対象ページパスの部分一致 (例: "30")。prefix を優先するが両方未指定だと全体になるので避ける',
      },
    },
    required: ['report_type', 'start_date', 'end_date'],
  },
  outputDescription: '{ report_type, data: GA4のレポートオブジェクト, source_note }',
  async available() {
    const hasCreds =
      !!process.env.GA_CREDENTIALS_JSON ||
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasPropId = !!process.env.GA4_PROPERTY_ID;
    if (!hasCreds || !hasPropId) {
      return {
        ready: false,
        reason: 'GA4 認証情報 (GA_CREDENTIALS_JSON / GOOGLE_APPLICATION_CREDENTIALS) または GA4_PROPERTY_ID が未設定',
      };
    }
    return { ready: true };
  },
  async execute(input) {
    const start = Date.now();
    if (!DATE_RE.test(input.start_date) || !DATE_RE.test(input.end_date)) {
      return { ok: false, error: '日付は YYYY-MM-DD 形式で指定してください' };
    }
    try {
      let data: unknown;
      switch (input.report_type) {
        case 'overview':
          data = await fetchOverviewReport(input.start_date, input.end_date);
          break;
        case 'traffic':
          data = await fetchTrafficReport(input.start_date, input.end_date);
          break;
        case 'pages':
          data = await fetchPagesReport(input.start_date, input.end_date);
          break;
        case 'lpPerformance':
          data = await fetchLpPerformanceReport(input.start_date, input.end_date);
          break;
        case 'comparison': {
          // 既存実装は (current_start, current_end) 2引数。previous は内部で自動算出されるはず。
          const cs = input.current_start ?? input.start_date;
          const ce = input.current_end ?? input.end_date;
          data = await fetchComparisonReport(cs, ce);
          break;
        }
        case 'pageTraffic': {
          if (!input.page_path_prefix && !input.page_path_contains) {
            return {
              ok: false,
              error:
                'pageTraffic では page_path_prefix または page_path_contains を必ず指定してください (組み合わせ爆発防止)',
            };
          }
          data = await fetchPageTrafficReport(input.start_date, input.end_date, {
            pagePathPrefix: input.page_path_prefix,
            pagePathContains: input.page_path_contains,
          });
          break;
        }
        default:
          return { ok: false, error: `不明な report_type: ${input.report_type}` };
      }
      return {
        ok: true,
        data: {
          report_type: input.report_type,
          data,
          source_note: 'GA4 Data API 経由 (Property: ' + process.env.GA4_PROPERTY_ID + ')',
        },
        metadata: { tookMs: Date.now() - start },
      };
    } catch (e) {
      return {
        ok: false,
        error: `GA4 取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
