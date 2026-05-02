import type { AdvisorTool } from '../types';
import { runReadOnly, describeAdvisorDataConnection } from '@/src/lib/advisor/db';
import { METRIC_CATALOG, type MetricGroupBy } from './metrics-catalog';
import { parseJSTDate, getJSTDayEnd } from '../../jst';

// runReadOnly のコールバックに渡される tx の型 (prisma 全モデルを含む)
type ReadOnlyTx = Parameters<Parameters<typeof runReadOnly>[0]>[0];

interface Input {
  metric_key: string;
  start_date: string; // YYYY-MM-DD (JST)
  end_date: string;
  group_by?: MetricGroupBy;
  filter?: {
    lp_id?: string;
    campaign_code?: string;
  };
}

interface Output {
  metric_key: string;
  label: string;
  unit: string;
  period: { start: string; end: string };
  group_by: string;
  rows: Array<{ key: string; value: number }>;
  total: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const queryMetricTool: AdvisorTool<Input, Output> = {
  name: 'query_metric',
  category: 'tastas-data',
  description:
    'TASTAS の指標を期間・LP別等で取得します。' +
    '\n\n事前に list_available_metrics で metric_key を確認してから呼び出してください。' +
    '\n\n日付は必ず JST の YYYY-MM-DD 形式。期間は inclusive (両端含む)。' +
    '\n\navailable: false の指標を呼ぶとエラーが返ります。代わりに reason を返すので、ユーザーに正直に伝えてください。',
  inputSchema: {
    type: 'object',
    properties: {
      metric_key: {
        type: 'string',
        description: 'list_available_metrics で取得できる metric の key',
      },
      start_date: {
        type: 'string',
        description: 'JST の開始日 (YYYY-MM-DD, inclusive)',
      },
      end_date: {
        type: 'string',
        description: 'JST の終了日 (YYYY-MM-DD, inclusive)',
      },
      group_by: {
        type: 'string',
        enum: ['none', 'day', 'lp_id', 'campaign_code'],
        default: 'none',
      },
      filter: {
        type: 'object',
        properties: {
          lp_id: { type: 'string' },
          campaign_code: { type: 'string' },
        },
      },
    },
    required: ['metric_key', 'start_date', 'end_date'],
  },
  outputDescription:
    '{ metric_key, label, unit, period, group_by, rows: [{ key, value }], total }',
  async available() {
    const conn = describeAdvisorDataConnection();
    if (conn.source === 'local_fallback') {
      return {
        ready: true,
        reason:
          'ADVISOR_DATA_DATABASE_URL 未設定: 開発用 DB にフォールバック中。本番の指標値ではありません。',
      };
    }
    return { ready: true };
  },
  async execute(input) {
    const start = Date.now();
    const def = METRIC_CATALOG.find((m) => m.key === input.metric_key);
    if (!def) {
      return {
        ok: false,
        error: `不明な metric_key: ${input.metric_key}. list_available_metrics で確認してください`,
      };
    }
    if (!def.available) {
      return {
        ok: false,
        error: `この指標は現在取得できません: ${def.label}`,
        userActionable: `${def.reason ?? '理由不明'}${def.plannedFrom ? ` (対応予定: ${def.plannedFrom})` : ''}`,
      };
    }
    if (!DATE_RE.test(input.start_date) || !DATE_RE.test(input.end_date)) {
      return { ok: false, error: '日付は YYYY-MM-DD 形式で指定してください' };
    }
    const groupBy = input.group_by ?? 'none';
    if (!def.supportedGroupBy.includes(groupBy)) {
      return {
        ok: false,
        error: `${def.key} は group_by="${groupBy}" をサポートしていません。許可: ${def.supportedGroupBy.join(', ')}`,
      };
    }

    const periodStart = parseJSTDate(input.start_date);
    const periodEnd = getJSTDayEnd(input.end_date);

    try {
      const result = await runReadOnly((tx) =>
        runMetricQuery(tx, input.metric_key, {
          start: periodStart,
          end: periodEnd,
          groupBy,
          filter: input.filter,
        })
      );

      return {
        ok: true,
        data: {
          metric_key: def.key,
          label: def.label,
          unit: def.unit,
          period: { start: input.start_date, end: input.end_date },
          group_by: groupBy,
          rows: result.rows,
          total: result.total,
        },
        metadata: { tookMs: Date.now() - start, rowCount: result.rows.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `集計失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

interface QueryOpts {
  start: Date;
  end: Date;
  groupBy: MetricGroupBy;
  filter?: Input['filter'];
}

interface QueryResultRow {
  key: string;
  value: number;
}

async function runMetricQuery(
  tx: ReadOnlyTx,
  metricKey: string,
  opts: QueryOpts
): Promise<{ rows: QueryResultRow[]; total: number }> {
  switch (metricKey) {
    case 'TOTAL_WORKERS': {
      const count = await tx.user.count({ where: { deleted_at: null } });
      return { rows: [{ key: 'total', value: count }], total: count };
    }
    case 'NEW_WORKERS': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.user.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.user, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'TOTAL_FACILITIES': {
      const count = await tx.facility.count({ where: { deleted_at: null } });
      return { rows: [{ key: 'total', value: count }], total: count };
    }
    case 'TOTAL_JOBS': {
      const count = await tx.job.count();
      return { rows: [{ key: 'total', value: count }], total: count };
    }
    case 'ACTIVE_JOBS': {
      const count = await tx.job.count({ where: { status: 'PUBLISHED' } });
      return { rows: [{ key: 'PUBLISHED', value: count }], total: count };
    }
    case 'NEW_APPLICATIONS': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.application.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.application, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'LP_PV': {
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
      };
      if (opts.filter?.lp_id) where.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) where.campaign_code = opts.filter.campaign_code;

      const total = await tx.lpPageView.count({ where: where as never });
      if (opts.groupBy === 'lp_id') {
        const grouped = await tx.lpPageView.groupBy({
          by: ['lp_id'],
          where: where as never,
          _count: { _all: true },
        });
        return {
          rows: grouped
            .map((g) => ({ key: g.lp_id ?? '(null)', value: g._count._all }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'campaign_code') {
        const grouped = await tx.lpPageView.groupBy({
          by: ['campaign_code'],
          where: where as never,
          _count: { _all: true },
        });
        return {
          rows: grouped
            .map((g) => ({ key: g.campaign_code ?? '(null)', value: g._count._all }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.lpPageView, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'LP_REGISTRATIONS': {
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
        registration_lp_id: { not: null },
      };
      if (opts.filter?.lp_id) where.registration_lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code)
        where.registration_campaign_code = opts.filter.campaign_code;

      const total = await tx.user.count({ where: where as never });
      if (opts.groupBy === 'lp_id') {
        const grouped = await tx.user.groupBy({
          by: ['registration_lp_id'],
          where: where as never,
          _count: { _all: true },
        });
        return {
          rows: grouped
            .map((g) => ({ key: g.registration_lp_id ?? '(null)', value: g._count._all }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'campaign_code') {
        const grouped = await tx.user.groupBy({
          by: ['registration_campaign_code'],
          where: where as never,
          _count: { _all: true },
        });
        return {
          rows: grouped
            .map((g) => ({
              key: g.registration_campaign_code ?? '(null)',
              value: g._count._all,
            }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.user, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'PUBLIC_JOB_PV': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.publicJobPageView.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.publicJobPageView, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'JOB_SEARCH_PV': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.jobSearchPageView.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.jobSearchPageView, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'APPLICATION_CLICK': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.applicationClickEvent.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.applicationClickEvent, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    default:
      throw new Error(`Metric ${metricKey} は実装されていません`);
  }
}

/**
 * 日別集計の汎用ヘルパー (raw SQL を使わずに JS 側で集計)
 *
 * 大量データ時のパフォーマンスは raw SQL の方が良いが、
 * Phase 1 では DB 規模が小さいので簡易実装で十分。
 */
async function aggregateByDay(
  // biome-ignore lint/suspicious/noExplicitAny: prisma model accessor の動的呼び出し
  model: any,
  where: Record<string, unknown>,
  dateField: string,
  total: number
): Promise<{ rows: QueryResultRow[]; total: number }> {
  const records: Array<Record<string, unknown>> = await model.findMany({
    where,
    select: { [dateField]: true },
  });
  const counts = new Map<string, number>();
  for (const r of records) {
    const dt = r[dateField] as Date;
    // JST に変換して YYYY-MM-DD
    const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    const day = jst.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const rows = Array.from(counts.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  return { rows, total };
}
