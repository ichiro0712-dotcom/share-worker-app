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
  /**
   * 集計結果の行。
   * - key: グループ化キー (group_by=lp_id なら LandingPage.lp_number の文字列)
   * - value: 件数 / 値
   * - label: 表示用ラベル (group_by=lp_id のときは "LP 5 (◯◯キャンペーン LP)" 形式で
   *   LandingPage.name から解決される。LLM はレポートでは label を優先して表示する)
   */
  rows: Array<{ key: string; value: number; label?: string }>;
  total: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const queryMetricTool: AdvisorTool<Input, Output> = {
  name: 'query_metric',
  category: 'tastas-data',
  description:
    'TASTAS の指標を期間・LP別等で取得します。' +
    '\n\nmetric_key はシステムプロンプトの「利用可能なメトリクス一覧」表から選ぶ。' +
    '\n\n日付は必ず JST の YYYY-MM-DD 形式。期間は inclusive (両端含む)。' +
    '\n\navailable: false の指標を呼ぶとエラーが返ります。代わりに reason を返すので、ユーザーに正直に伝えてください。',
  inputSchema: {
    type: 'object',
    properties: {
      metric_key: {
        type: 'string',
        description: 'システムプロンプトの「利用可能なメトリクス一覧」表に列挙された key',
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
    '{ metric_key, label, unit, period, group_by, rows: [{ key, value, label? }], total }' +
    '\n- group_by=lp_id のとき、rows[].label に "LP <番号> (<LP名>)" 形式で LandingPage.name が入る' +
    '\n- レポート / 表で「LP 別」を表示する場合は key (ID) ではなく label を優先して使うこと',
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
        error: `不明な metric_key: ${input.metric_key}. システムプロンプトの「利用可能なメトリクス一覧」表で確認してください`,
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
          // truncated=true のとき、日別集計は最初の MAX_DAYS_AGGREGATION_ROWS 件しか
          // 走査していない (OOM 防止のため)。total は count() なので正確だが、日別の rows
          // は不完全な可能性がある旨を LLM に伝える。
          ...(result.truncated ? { truncated: true } : {}),
        },
        metadata: {
          tookMs: Date.now() - start,
          rowCount: result.rows.length,
          ...(result.truncated ? { truncated: true } : {}),
        },
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
  /**
   * 表示用ラベル (任意)。group_by=lp_id のときに "LP 5 (◯◯キャンペーン LP)" 形式で
   * LandingPage.name から解決される。
   */
  label?: string;
  value: number;
}

async function runMetricQuery(
  tx: ReadOnlyTx,
  metricKey: string,
  opts: QueryOpts
): Promise<{ rows: QueryResultRow[]; total: number; truncated?: boolean }> {
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
        const lpIds = grouped.map((g) => g.lp_id).filter((v): v is string => !!v);
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: grouped
            .map((g) => {
              const key = g.lp_id ?? '(null)';
              return {
                key,
                label: labels.get(key),
                value: g._count._all,
              };
            })
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
        const lpIds = grouped
          .map((g) => g.registration_lp_id)
          .filter((v): v is string => !!v);
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: grouped
            .map((g) => {
              const key = g.registration_lp_id ?? '(null)';
              return {
                key,
                label: labels.get(key),
                value: g._count._all,
              };
            })
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
    case 'LP_TO_LINE_CONV': {
      // LP 内の LINE 友だち追加ボタンクリック数
      // (button_id が 'line_register' / 'line_register_cta' / 'line_register_hero' で始まる)
      // line_ プレフィックス全般を拾うことで将来追加されるバリアントにも対応。
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
        button_id: { startsWith: 'line_' },
      };
      if (opts.filter?.lp_id) where.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) where.campaign_code = opts.filter.campaign_code;

      const total = await tx.lpClickEvent.count({ where: where as never });
      if (opts.groupBy === 'lp_id') {
        const grouped = await tx.lpClickEvent.groupBy({
          by: ['lp_id'],
          where: where as never,
          _count: { _all: true },
        });
        const lpIds = grouped.map((g) => g.lp_id).filter((v): v is string => !!v);
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: grouped
            .map((g) => {
              const key = g.lp_id ?? '(null)';
              return {
                key,
                label: labels.get(key),
                value: g._count._all,
              };
            })
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'campaign_code') {
        const grouped = await tx.lpClickEvent.groupBy({
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
        return aggregateByDay(tx.lpClickEvent, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'LP_TO_REGISTER_CONV': {
      // LP 内の新規登録ボタンクリック数 (LINE 経由ではない直接登録)
      // button_id が 'cta_register' または 'register_' で始まる
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
        OR: [
          { button_id: 'cta_register' },
          { button_id: { startsWith: 'register_' } },
        ],
      };
      if (opts.filter?.lp_id) where.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) where.campaign_code = opts.filter.campaign_code;

      const total = await tx.lpClickEvent.count({ where: where as never });
      if (opts.groupBy === 'lp_id') {
        const grouped = await tx.lpClickEvent.groupBy({
          by: ['lp_id'],
          where: where as never,
          _count: { _all: true },
        });
        const lpIds = grouped.map((g) => g.lp_id).filter((v): v is string => !!v);
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: grouped
            .map((g) => {
              const key = g.lp_id ?? '(null)';
              return {
                key,
                label: labels.get(key),
                value: g._count._all,
              };
            })
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'campaign_code') {
        const grouped = await tx.lpClickEvent.groupBy({
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
        return aggregateByDay(tx.lpClickEvent, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    // ===== ワーカー系 =====
    case 'WITHDRAWN_WORKERS': {
      const where = { deleted_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.user.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.user, where, 'deleted_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'WITHDRAWAL_RATE': {
      const withdrawn = await tx.user.count({
        where: { deleted_at: { gte: opts.start, lte: opts.end } },
      });
      const startRegistered = await tx.user.count({
        where: { created_at: { lt: opts.start } },
      });
      const rate = startRegistered > 0 ? (withdrawn / startRegistered) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    case 'CANCEL_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const totalApps = await tx.application.count({ where: periodWhere });
      const workerCancels = await tx.application.count({
        where: { ...periodWhere, cancelled_by: 'WORKER' as never },
      });
      const rate = totalApps > 0 ? (workerCancels / totalApps) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    case 'LAST_MINUTE_CANCEL_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const totalApps = await tx.application.count({ where: periodWhere });
      // 直前キャンセル: cancelled_by=WORKER かつ (work_date - updated_at) が 0〜24h
      // JS 側で計算するため findMany で取り出す。OOM ガードに limit を入れる。
      const cancelled = await tx.application.findMany({
        where: { ...periodWhere, cancelled_by: 'WORKER' as never },
        select: { updated_at: true, workDate: { select: { work_date: true } } },
        take: 200_000,
      });
      const lastMinute = cancelled.filter((a) => {
        if (!a.workDate?.work_date) return false;
        const diffMs = a.workDate.work_date.getTime() - a.updated_at.getTime();
        const diffH = diffMs / (1000 * 60 * 60);
        return diffH >= 0 && diffH <= 24;
      }).length;
      const rate = totalApps > 0 ? (lastMinute / totalApps) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    case 'WORKER_REVIEW_COUNT': {
      const where = {
        reviewer_type: 'FACILITY' as never,
        created_at: { gte: opts.start, lte: opts.end },
      };
      const total = await tx.review.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.review, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'WORKER_REVIEW_AVG': {
      const rows = await tx.review.findMany({
        where: {
          reviewer_type: 'FACILITY' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
        select: { rating: true },
        take: 200_000,
      });
      const avg =
        rows.length > 0
          ? rows.reduce((s, r) => s + r.rating, 0) / rows.length
          : 0;
      return {
        rows: [{ key: 'avg', value: Math.round(avg * 100) / 100 }],
        total: Math.round(avg * 100) / 100,
      };
    }
    // ===== 施設系 =====
    case 'NEW_FACILITIES': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        deleted_at: null,
      };
      const total = await tx.facility.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.facility, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'WITHDRAWN_FACILITIES': {
      const where = { deleted_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.facility.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.facility, where, 'deleted_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'FACILITY_WITHDRAWAL_RATE': {
      const withdrawn = await tx.facility.count({
        where: { deleted_at: { gte: opts.start, lte: opts.end } },
      });
      const startRegistered = await tx.facility.count({
        where: { created_at: { lt: opts.start } },
      });
      const rate = startRegistered > 0 ? (withdrawn / startRegistered) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    case 'FACILITY_REVIEW_COUNT': {
      const where = {
        reviewer_type: 'WORKER' as never,
        created_at: { gte: opts.start, lte: opts.end },
      };
      const total = await tx.review.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.review, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'FACILITY_REVIEW_AVG': {
      const rows = await tx.review.findMany({
        where: {
          reviewer_type: 'WORKER' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
        select: { rating: true },
        take: 200_000,
      });
      const avg =
        rows.length > 0
          ? rows.reduce((s, r) => s + r.rating, 0) / rows.length
          : 0;
      return {
        rows: [{ key: 'avg', value: Math.round(avg * 100) / 100 }],
        total: Math.round(avg * 100) / 100,
      };
    }
    // ===== 求人・マッチング系 =====
    case 'CHILD_JOB_COUNT': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.jobWorkDate.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.jobWorkDate, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'TOTAL_SLOTS': {
      const rows = await tx.jobWorkDate.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { recruitment_count: true },
        take: 500_000,
      });
      const sum = rows.reduce((s, r) => s + (r.recruitment_count ?? 0), 0);
      return { rows: [{ key: 'total', value: sum }], total: sum };
    }
    case 'REMAINING_SLOTS': {
      // JobWorkDate ごとに (recruitment_count - 非キャンセル応募数) の MAX(0, ・) を SUM
      const workDates = await tx.jobWorkDate.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: {
          id: true,
          recruitment_count: true,
          applications: {
            where: { status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] } },
            select: { id: true },
          },
        },
        take: 500_000,
      });
      const sum = workDates.reduce((s, wd) => {
        const filled = wd.applications.length;
        const remaining = Math.max(0, (wd.recruitment_count ?? 0) - filled);
        return s + remaining;
      }, 0);
      return { rows: [{ key: 'total', value: sum }], total: sum };
    }
    case 'LIMITED_JOB_COUNT': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        job_type: { in: ['LIMITED_WORKED' as never, 'LIMITED_FAVORITE' as never] },
      };
      const total = await tx.job.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.job, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'OFFER_JOB_COUNT': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        job_type: 'OFFER' as never,
      };
      const total = await tx.job.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.job, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'OFFER_ACCEPTANCE_RATE': {
      const periodJobWhere = {
        created_at: { gte: opts.start, lte: opts.end },
        job_type: 'OFFER' as never,
      };
      const offerJobs = await tx.job.count({ where: periodJobWhere });
      const accepted = await tx.application.count({
        where: {
          status: { not: 'CANCELLED' as never },
          workDate: { job: periodJobWhere },
        },
      });
      const rate = offerJobs > 0 ? (accepted / offerJobs) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    case 'MATCHING_COUNT': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
      };
      const total = await tx.application.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.application, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'AVG_MATCHING_HOURS': {
      // マッチング: status NOT IN [APPLIED, CANCELLED] のマッチ済み Application
      // 期間: created_at 基準。 (application.updated_at - job.created_at) を時間単位で
      const apps = await tx.application.findMany({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
        select: {
          updated_at: true,
          workDate: { select: { job: { select: { created_at: true } } } },
        },
        take: 200_000,
      });
      const diffs = apps
        .map((a) =>
          a.workDate?.job?.created_at
            ? (a.updated_at.getTime() - a.workDate.job.created_at.getTime()) /
              (1000 * 60 * 60)
            : null
        )
        .filter((v): v is number => v !== null && v >= 0);
      const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
      return {
        rows: [{ key: 'avg', value: Math.round(avg * 100) / 100 }],
        total: Math.round(avg * 100) / 100,
      };
    }
    // ===== LP 系 (lp-tracking/route.ts 由来) =====
    case 'LP_SESSIONS': {
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
      };
      if (opts.filter?.lp_id) where.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) where.campaign_code = opts.filter.campaign_code;
      const rows = await tx.lpPageView.findMany({
        where: where as never,
        select: { lp_id: true, campaign_code: true, session_id: true },
        take: 500_000,
      });
      if (opts.groupBy === 'lp_id') {
        const map = new Map<string, Set<string>>();
        for (const r of rows) {
          if (!map.has(r.lp_id)) map.set(r.lp_id, new Set());
          map.get(r.lp_id)!.add(r.session_id);
        }
        const lpIds = Array.from(map.keys());
        const labels = await resolveLpLabels(tx, lpIds);
        const out = Array.from(map.entries())
          .map(([k, set]) => ({ key: k, label: labels.get(k), value: set.size }))
          .sort((a, b) => b.value - a.value);
        const total = out.reduce((s, r) => s + r.value, 0);
        return { rows: out, total };
      }
      if (opts.groupBy === 'campaign_code') {
        const map = new Map<string, Set<string>>();
        for (const r of rows) {
          const k = r.campaign_code ?? '(null)';
          if (!map.has(k)) map.set(k, new Set());
          map.get(k)!.add(r.session_id);
        }
        const out = Array.from(map.entries())
          .map(([k, set]) => ({ key: k, value: set.size }))
          .sort((a, b) => b.value - a.value);
        const total = out.reduce((s, r) => s + r.value, 0);
        return { rows: out, total };
      }
      // 全期間ユニークセッション (lp_id × campaign_code × session_id で一意化、(lp_id, campaign_code) 単位で session_id 集計してから合計)
      const map = new Map<string, Set<string>>();
      for (const r of rows) {
        const k = `${r.lp_id}|${r.campaign_code ?? ''}`;
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(r.session_id);
      }
      const total = Array.from(map.values()).reduce((s, set) => s + set.size, 0);
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'LP_EVENTS': {
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
      };
      if (opts.filter?.lp_id) where.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) where.campaign_code = opts.filter.campaign_code;
      const total = await tx.lpClickEvent.count({ where: where as never });
      if (opts.groupBy === 'lp_id') {
        const grouped = await tx.lpClickEvent.groupBy({
          by: ['lp_id'],
          where: where as never,
          _count: { _all: true },
        });
        const lpIds = grouped.map((g) => g.lp_id).filter((v): v is string => !!v);
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: grouped
            .map((g) => ({
              key: g.lp_id ?? '(null)',
              label: labels.get(g.lp_id ?? ''),
              value: g._count._all,
            }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      if (opts.groupBy === 'campaign_code') {
        const grouped = await tx.lpClickEvent.groupBy({
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
        return aggregateByDay(tx.lpClickEvent, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'LP_EVENT_CTR': {
      // LP_EVENTS / LP_SESSIONS
      const baseWhere: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
      };
      if (opts.filter?.lp_id) baseWhere.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) baseWhere.campaign_code = opts.filter.campaign_code;
      const events = await tx.lpClickEvent.count({ where: baseWhere as never });
      const pvRows = await tx.lpPageView.findMany({
        where: baseWhere as never,
        select: { lp_id: true, campaign_code: true, session_id: true },
        take: 500_000,
      });
      const sessionMap = new Map<string, Set<string>>();
      for (const r of pvRows) {
        const k = `${r.lp_id}|${r.campaign_code ?? ''}`;
        if (!sessionMap.has(k)) sessionMap.set(k, new Set());
        sessionMap.get(k)!.add(r.session_id);
      }
      const sessions = Array.from(sessionMap.values()).reduce((s, set) => s + set.size, 0);
      const ctr = sessions > 0 ? (events / sessions) * 100 : 0;
      return {
        rows: [{ key: 'ctr', value: Math.round(ctr * 100) / 100 }],
        total: Math.round(ctr * 100) / 100,
      };
    }
    case 'LP_REGISTRATION_RATE': {
      // LP_REGISTRATIONS / LP_SESSIONS
      const periodFilter = { gte: opts.start, lte: opts.end };
      const regWhere: Record<string, unknown> = {
        created_at: periodFilter,
        registration_lp_id: { not: null },
      };
      if (opts.filter?.lp_id) regWhere.registration_lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code)
        regWhere.registration_campaign_code = opts.filter.campaign_code;
      const registrations = await tx.user.count({ where: regWhere as never });
      const pvWhere: Record<string, unknown> = { created_at: periodFilter };
      if (opts.filter?.lp_id) pvWhere.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) pvWhere.campaign_code = opts.filter.campaign_code;
      const pvRows = await tx.lpPageView.findMany({
        where: pvWhere as never,
        select: { lp_id: true, campaign_code: true, session_id: true },
        take: 500_000,
      });
      const sessionMap = new Map<string, Set<string>>();
      for (const r of pvRows) {
        const k = `${r.lp_id}|${r.campaign_code ?? ''}`;
        if (!sessionMap.has(k)) sessionMap.set(k, new Set());
        sessionMap.get(k)!.add(r.session_id);
      }
      const sessions = Array.from(sessionMap.values()).reduce((s, set) => s + set.size, 0);
      const rate = sessions > 0 ? (registrations / sessions) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    // ===== Funnel (登録動線) 系 =====
    case 'REGISTRATION_PAGE_PV': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.registrationPageView.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.registrationPageView, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'REGISTRATION_PAGE_UU': {
      const rows = await tx.registrationPageView.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { session_id: true },
        take: 500_000,
      });
      const uu = new Set(rows.map((r) => r.session_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'FUNNEL_REGISTERED': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.user.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.user, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'FUNNEL_VERIFIED': {
      const total = await tx.user.count({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          email_verified: true,
        },
      });
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'FUNNEL_SEARCH_REACHED': {
      const registeredUsers = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registeredUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const views = await tx.jobSearchPageView.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(views.map((v) => v.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'FUNNEL_JOB_VIEWED': {
      const registeredUsers = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registeredUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const views = await tx.jobDetailPageView.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(views.map((v) => v.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'FUNNEL_BOOKMARKED': {
      const registeredUsers = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registeredUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const bookmarks = await tx.bookmark.findMany({
        where: {
          user_id: { in: userIds },
          type: 'FAVORITE' as never,
          target_job_id: { not: null },
        },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(bookmarks.map((b) => b.user_id).filter((v) => v !== null)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'FUNNEL_APPLIED': {
      const registeredUsers = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registeredUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const apps = await tx.application.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(apps.map((a) => a.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'OVERALL_CONVERSION_RATE': {
      const registered = await tx.user.count({
        where: { created_at: { gte: opts.start, lte: opts.end } },
      });
      if (registered === 0) {
        return { rows: [{ key: 'rate', value: 0 }], total: 0 };
      }
      const registeredUsers = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registeredUsers.map((u) => u.id);
      const apps = await tx.application.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true },
        take: 500_000,
      });
      const applied = new Set(apps.map((a) => a.user_id)).size;
      const rate = (applied / registered) * 100;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    // ===== B群: 応募系 =====
    case 'APPLICATION_CLICK_UU': {
      const registeredUsers = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registeredUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const clicks = await tx.applicationClickEvent.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(clicks.map((c) => c.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'APPLICATION_DAYS': {
      // NEW_APPLICATIONS と同義 (1 応募 = 1 勤務日)
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.application.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.application, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'APPLICATION_CONVERSION_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const apps = await tx.application.findMany({
        where: periodWhere,
        select: { user_id: true },
        take: 500_000,
      });
      const appliedUU = new Set(apps.map((a) => a.user_id)).size;
      const views = await tx.jobDetailPageView.findMany({
        where: periodWhere,
        select: { user_id: true },
        take: 500_000,
      });
      const viewedUU = new Set(views.map((v) => v.user_id)).size;
      const rate = viewedUU > 0 ? (appliedUU / viewedUU) * 100 : 0;
      return {
        rows: [{ key: 'rate', value: Math.round(rate * 100) / 100 }],
        total: Math.round(rate * 100) / 100,
      };
    }
    case 'APPLICATIONS_PER_WORKER':
    case 'AVG_APPLICATION_DAYS': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.application.count({ where: periodWhere });
      const apps = await tx.application.findMany({
        where: periodWhere,
        select: { user_id: true },
        take: 500_000,
      });
      const uniqueWorkers = new Set(apps.map((a) => a.user_id)).size;
      const value = uniqueWorkers > 0 ? total / uniqueWorkers : 0;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'AVG_APPLICATION_MATCHING_HOURS': {
      // 応募 (created_at) → マッチング確定 (updated_at) の平均時間
      const apps = await tx.application.findMany({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
        select: { created_at: true, updated_at: true },
        take: 200_000,
      });
      const diffs = apps
        .map((a) => (a.updated_at.getTime() - a.created_at.getTime()) / (1000 * 60 * 60))
        .filter((v) => v >= 0);
      const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
      const rounded = Math.round(avg * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'AVG_REGISTRATION_TO_APPLICATION_DAYS': {
      const registered = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true, created_at: true },
        take: 500_000,
      });
      if (registered.length === 0) return { rows: [{ key: 'avg', value: 0 }], total: 0 };
      const userIds = registered.map((u) => u.id);
      const apps = await tx.application.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: 500_000,
      });
      const firstApp = new Map<number, Date>();
      for (const a of apps) {
        if (!firstApp.has(a.user_id)) firstApp.set(a.user_id, a.created_at);
      }
      const userMap = new Map(registered.map((u) => [u.id, u.created_at]));
      const diffs: number[] = [];
      for (const [uid, firstAt] of Array.from(firstApp.entries())) {
        const regAt = userMap.get(uid);
        if (regAt) {
          const days = (firstAt.getTime() - regAt.getTime()) / (1000 * 60 * 60 * 24);
          if (days >= 0) diffs.push(days);
        }
      }
      const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
      const rounded = Math.round(avg * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'AVG_JOB_MATCHING_HOURS': {
      // 求人 (Job) → 各求人で最初のマッチング成立までの平均時間
      const matched = await tx.application.findMany({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
        select: {
          updated_at: true,
          workDate: { select: { job: { select: { id: true, created_at: true } } } },
        },
        orderBy: { updated_at: 'asc' },
        take: 200_000,
      });
      const firstMatch = new Map<number, { jobCreated: Date; matchAt: Date }>();
      for (const a of matched) {
        const job = a.workDate?.job;
        if (!job) continue;
        if (!firstMatch.has(job.id)) {
          firstMatch.set(job.id, { jobCreated: job.created_at, matchAt: a.updated_at });
        }
      }
      const diffs: number[] = [];
      for (const v of Array.from(firstMatch.values())) {
        const h = (v.matchAt.getTime() - v.jobCreated.getTime()) / (1000 * 60 * 60);
        if (h >= 0) diffs.push(h);
      }
      const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
      const rounded = Math.round(avg * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'AVG_REGISTRATION_TO_VERIFY_HOURS': {
      const users = await tx.user.findMany({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          email_verified: true,
          email_verified_at: { not: null },
        },
        select: { created_at: true, email_verified_at: true },
        take: 500_000,
      });
      const diffs = users
        .map((u) =>
          u.email_verified_at
            ? (u.email_verified_at.getTime() - u.created_at.getTime()) / (1000 * 60 * 60)
            : null
        )
        .filter((v): v is number => v !== null && v >= 0);
      const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
      const rounded = Math.round(avg * 10) / 10;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    // ===== B群: 求人詳細 (jobAnalytics) 系 =====
    case 'JOB_DETAIL_PV': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.jobDetailPageView.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.jobDetailPageView, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'JOB_DETAIL_USERS': {
      const rows = await tx.jobDetailPageView.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(rows.map((r) => r.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'JOB_DETAIL_APPLICATION_COUNT': {
      const where = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.application.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.application, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'JOB_DETAIL_APPLICATION_USERS': {
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { user_id: true },
        take: 500_000,
      });
      const uu = new Set(apps.map((a) => a.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'JOB_DETAIL_APPLICATION_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const views = await tx.jobDetailPageView.findMany({
        where: periodWhere,
        select: { user_id: true },
        take: 500_000,
      });
      const viewedUU = new Set(views.map((v) => v.user_id)).size;
      const apps = await tx.application.findMany({
        where: periodWhere,
        select: { user_id: true },
        take: 500_000,
      });
      const appliedUU = new Set(apps.map((a) => a.user_id)).size;
      const rate = viewedUU > 0 ? (appliedUU / viewedUU) * 100 : 0;
      const rounded = Math.round(rate * 10) / 10;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    case 'JOB_DETAIL_AVG_APPLICATION_DAYS': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const appCount = await tx.application.count({ where: periodWhere });
      const apps = await tx.application.findMany({
        where: periodWhere,
        select: { user_id: true },
        take: 500_000,
      });
      const appUserCount = new Set(apps.map((a) => a.user_id)).size;
      const avg = appUserCount > 0 ? appCount / appUserCount : 0;
      const rounded = Math.round(avg * 10) / 10;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    // ===== B群: Funnel 拡張系 =====
    case 'FUNNEL_JOB_VIEWED_PV': {
      const registered = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registered.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const pv = await tx.jobDetailPageView.count({
        where: { user_id: { in: userIds } },
      });
      return { rows: [{ key: 'total', value: pv }], total: pv };
    }
    case 'FUNNEL_SEARCH_PV': {
      const registered = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      const userIds = registered.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const pv = await tx.jobSearchPageView.count({
        where: { user_id: { in: userIds } },
      });
      return { rows: [{ key: 'total', value: pv }], total: pv };
    }
    // ===== B群: 求人構造系 =====
    case 'PARENT_JOB_COUNT': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        status: 'PUBLISHED' as never,
      };
      const total = await tx.job.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.job, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'PARENT_JOB_INTERVIEW_COUNT': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        status: 'PUBLISHED' as never,
        requires_interview: true,
      };
      const total = await tx.job.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.job, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'PARENT_JOBS_PER_FACILITY': {
      const parentJobs = await tx.job.count({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: 'PUBLISHED' as never,
        },
      });
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { workDate: { select: { job: { select: { facility_id: true } } } } },
        take: 500_000,
      });
      const facilityIds = new Set(
        apps
          .map((a) => a.workDate?.job?.facility_id)
          .filter((id): id is number => id != null && id > 0)
      );
      const activeFacilityCount = facilityIds.size || 1;
      const value = parentJobs / activeFacilityCount;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'CHILD_JOB_INTERVIEW_COUNT': {
      const where = {
        created_at: { gte: opts.start, lte: opts.end },
        job: { requires_interview: true },
      };
      const total = await tx.jobWorkDate.count({ where });
      if (opts.groupBy === 'day') {
        return aggregateByDay(tx.jobWorkDate, where, 'created_at', total);
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'CHILD_JOBS_PER_FACILITY': {
      const childJobs = await tx.jobWorkDate.count({
        where: { created_at: { gte: opts.start, lte: opts.end } },
      });
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { workDate: { select: { job: { select: { facility_id: true } } } } },
        take: 500_000,
      });
      const facilityIds = new Set(
        apps
          .map((a) => a.workDate?.job?.facility_id)
          .filter((id): id is number => id != null && id > 0)
      );
      const activeFacilityCount = facilityIds.size || 1;
      const value = childJobs / activeFacilityCount;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    // ===== B群: perWorker / perFacility =====
    case 'MATCHINGS_PER_WORKER': {
      const matched = await tx.application.count({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
      });
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { user_id: true },
        take: 500_000,
      });
      const workers = new Set(apps.map((a) => a.user_id)).size || 1;
      const value = matched / workers;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'MATCHINGS_PER_FACILITY': {
      const matched = await tx.application.count({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
      });
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { workDate: { select: { job: { select: { facility_id: true } } } } },
        take: 500_000,
      });
      const facilityIds = new Set(
        apps
          .map((a) => a.workDate?.job?.facility_id)
          .filter((id): id is number => id != null && id > 0)
      );
      const facilities = facilityIds.size || 1;
      const value = matched / facilities;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'REVIEWS_PER_WORKER': {
      const reviewCount = await tx.review.count({
        where: {
          reviewer_type: 'FACILITY' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
      });
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { user_id: true },
        take: 500_000,
      });
      const workers = new Set(apps.map((a) => a.user_id)).size || 1;
      const value = reviewCount / workers;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'REVIEWS_PER_FACILITY': {
      const reviewCount = await tx.review.count({
        where: {
          reviewer_type: 'WORKER' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
      });
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { workDate: { select: { job: { select: { facility_id: true } } } } },
        take: 500_000,
      });
      const facilityIds = new Set(
        apps
          .map((a) => a.workDate?.job?.facility_id)
          .filter((id): id is number => id != null && id > 0)
      );
      const facilities = facilityIds.size || 1;
      const value = reviewCount / facilities;
      const rounded = Math.round(value * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    // ===== B群: LP 帰属系 =====
    case 'PARENT_JOB_PV':
    case 'LP_JOB_DETAIL_PV': {
      const lpUserWhere: Record<string, unknown> = {
        registration_lp_id: { not: null },
      };
      if (opts.filter?.lp_id) lpUserWhere.registration_lp_id = opts.filter.lp_id;
      const lpUsers = await tx.user.findMany({
        where: lpUserWhere as never,
        select: { id: true, registration_lp_id: true },
        take: 500_000,
      });
      const userIds = lpUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const views = await tx.jobDetailPageView.findMany({
        where: {
          user_id: { in: userIds },
          created_at: { gte: opts.start, lte: opts.end },
        },
        select: { user_id: true },
        take: 500_000,
      });
      const total = views.length;
      if (opts.groupBy === 'lp_id') {
        const userLpMap = new Map(lpUsers.map((u) => [u.id, u.registration_lp_id]));
        const lpCount = new Map<string, number>();
        for (const v of views) {
          const lp = userLpMap.get(v.user_id);
          if (!lp) continue;
          lpCount.set(lp, (lpCount.get(lp) ?? 0) + 1);
        }
        const lpIds = Array.from(lpCount.keys());
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: Array.from(lpCount.entries())
            .map(([key, value]) => ({ key, label: labels.get(key), value }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'PARENT_JOB_SESSIONS': {
      const lpUserWhere: Record<string, unknown> = {
        registration_lp_id: { not: null },
      };
      if (opts.filter?.lp_id) lpUserWhere.registration_lp_id = opts.filter.lp_id;
      const lpUsers = await tx.user.findMany({
        where: lpUserWhere as never,
        select: { id: true, registration_lp_id: true },
        take: 500_000,
      });
      const userIds = lpUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const views = await tx.jobDetailPageView.findMany({
        where: {
          user_id: { in: userIds },
          created_at: { gte: opts.start, lte: opts.end },
        },
        select: { user_id: true },
        take: 500_000,
      });
      if (opts.groupBy === 'lp_id') {
        const userLpMap = new Map(lpUsers.map((u) => [u.id, u.registration_lp_id]));
        const lpUsers2 = new Map<string, Set<number>>();
        for (const v of views) {
          const lp = userLpMap.get(v.user_id);
          if (!lp) continue;
          if (!lpUsers2.has(lp)) lpUsers2.set(lp, new Set());
          lpUsers2.get(lp)!.add(v.user_id);
        }
        const lpIds = Array.from(lpUsers2.keys());
        const labels = await resolveLpLabels(tx, lpIds);
        const rows = Array.from(lpUsers2.entries())
          .map(([key, set]) => ({ key, label: labels.get(key), value: set.size }))
          .sort((a, b) => b.value - a.value);
        const total = rows.reduce((s, r) => s + r.value, 0);
        return { rows, total };
      }
      const uu = new Set(views.map((v) => v.user_id)).size;
      return { rows: [{ key: 'total', value: uu }], total: uu };
    }
    case 'LP_APPLICATION_COUNT': {
      const lpUserWhere: Record<string, unknown> = {
        registration_lp_id: { not: null },
      };
      if (opts.filter?.lp_id) lpUserWhere.registration_lp_id = opts.filter.lp_id;
      const lpUsers = await tx.user.findMany({
        where: lpUserWhere as never,
        select: { id: true, registration_lp_id: true },
        take: 500_000,
      });
      const userIds = lpUsers.map((u) => u.id);
      if (userIds.length === 0) return { rows: [{ key: 'total', value: 0 }], total: 0 };
      const apps = await tx.application.findMany({
        where: {
          user_id: { in: userIds },
          created_at: { gte: opts.start, lte: opts.end },
        },
        select: { user_id: true },
        take: 500_000,
      });
      const total = apps.length;
      if (opts.groupBy === 'lp_id') {
        const userLpMap = new Map(lpUsers.map((u) => [u.id, u.registration_lp_id]));
        const lpCount = new Map<string, number>();
        for (const a of apps) {
          const lp = userLpMap.get(a.user_id);
          if (!lp) continue;
          lpCount.set(lp, (lpCount.get(lp) ?? 0) + 1);
        }
        const lpIds = Array.from(lpCount.keys());
        const labels = await resolveLpLabels(tx, lpIds);
        return {
          rows: Array.from(lpCount.entries())
            .map(([key, value]) => ({ key, label: labels.get(key), value }))
            .sort((a, b) => b.value - a.value),
          total,
        };
      }
      return { rows: [{ key: 'total', value: total }], total };
    }
    case 'LP_AVG_DWELL_TIME': {
      const where: Record<string, unknown> = {
        created_at: { gte: opts.start, lte: opts.end },
      };
      if (opts.filter?.lp_id) where.lp_id = opts.filter.lp_id;
      if (opts.filter?.campaign_code) where.campaign_code = opts.filter.campaign_code;
      const rows = await tx.lpEngagementSummary.findMany({
        where: where as never,
        select: { lp_id: true, total_dwell_time: true },
        take: 500_000,
      });
      if (opts.groupBy === 'lp_id') {
        const sums = new Map<string, { total: number; count: number }>();
        for (const r of rows) {
          const cur = sums.get(r.lp_id) ?? { total: 0, count: 0 };
          cur.total += r.total_dwell_time;
          cur.count++;
          sums.set(r.lp_id, cur);
        }
        const lpIds = Array.from(sums.keys());
        const labels = await resolveLpLabels(tx, lpIds);
        const out = Array.from(sums.entries())
          .map(([key, v]) => ({
            key,
            label: labels.get(key),
            value: v.count > 0 ? Math.round((v.total / v.count) * 10) / 10 : 0,
          }))
          .sort((a, b) => b.value - a.value);
        const allTotal =
          rows.length > 0
            ? Math.round((rows.reduce((s, r) => s + r.total_dwell_time, 0) / rows.length) * 10) / 10
            : 0;
        return { rows: out, total: allTotal };
      }
      const avg =
        rows.length > 0 ? rows.reduce((s, r) => s + r.total_dwell_time, 0) / rows.length : 0;
      const rounded = Math.round(avg * 10) / 10;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    // ===== B群: 限定求人 / 連続低評価 / 離脱率 =====
    case 'LIMITED_JOB_APPLICATION_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const limitedJobs = await tx.job.count({
        where: {
          ...periodWhere,
          job_type: { in: ['LIMITED_WORKED' as never, 'LIMITED_FAVORITE' as never] },
        },
      });
      const limitedApps = await tx.application.count({
        where: {
          ...periodWhere,
          workDate: {
            job: {
              job_type: { in: ['LIMITED_WORKED' as never, 'LIMITED_FAVORITE' as never] },
            },
          },
        },
      });
      const rate = limitedJobs > 0 ? (limitedApps / limitedJobs) * 100 : 0;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    case 'CONSECUTIVE_LOW_RATING_WORKER_COUNT': {
      const reviews = await tx.review.findMany({
        where: {
          reviewer_type: 'FACILITY' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
        select: { user_id: true, rating: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 500_000,
      });
      const byUser = new Map<number, { rating: number }[]>();
      for (const r of reviews) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
        const list = byUser.get(r.user_id)!;
        if (list.length < 3) list.push({ rating: r.rating });
      }
      let count = 0;
      for (const list of Array.from(byUser.values())) {
        if (list.length === 3 && list.every((r: { rating: number }) => r.rating <= 2)) count++;
      }
      return { rows: [{ key: 'total', value: count }], total: count };
    }
    case 'WORKER_DROPOUT_RATE': {
      const registered = await tx.user.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: { id: true },
        take: 500_000,
      });
      if (registered.length === 0) return { rows: [{ key: 'rate', value: 0 }], total: 0 };
      const userIds = registered.map((u) => u.id);
      const apps = await tx.application.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true },
        take: 500_000,
      });
      const applied = new Set(apps.map((a) => a.user_id));
      const dropouts = registered.filter((u) => !applied.has(u.id)).length;
      const rate = (dropouts / registered.length) * 100;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    // ===== D群: Attendance 系 =====
    case 'ATTENDANCE_CHECK_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const confirmedApps = await tx.application.count({
        where: {
          ...periodWhere,
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
      });
      const attendances = await tx.attendance.findMany({
        where: periodWhere,
        select: { application_id: true },
        take: 500_000,
      });
      const attendedAppIds = new Set(
        attendances.map((a) => a.application_id).filter((v): v is number => v !== null)
      );
      const rate = confirmedApps > 0 ? (attendedAppIds.size / confirmedApps) * 100 : 0;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    case 'ATTENDANCE_COMPLETION_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const total = await tx.attendance.count({ where: periodWhere });
      const completed = await tx.attendance.count({
        where: { ...periodWhere, status: 'CHECKED_OUT' },
      });
      const rate = total > 0 ? (completed / total) * 100 : 0;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    case 'EARLY_CHECKOUT_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const checkedOut = await tx.attendance.count({
        where: { ...periodWhere, check_out_time: { not: null } },
      });
      const early = await tx.attendance.count({
        where: { ...periodWhere, check_out_type: 'MODIFICATION_REQUIRED' },
      });
      const rate = checkedOut > 0 ? (early / checkedOut) * 100 : 0;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    // ===== D群: Bookmark / Message / Review 分布系 =====
    case 'BOOKMARK_REMOVAL_RATE': {
      // Bookmark は物理削除のため解除追跡不可。常に 0 を返す参考指標。
      return { rows: [{ key: 'rate', value: 0 }], total: 0 };
    }
    case 'MESSAGE_RESPONSE_TIME_AVG': {
      // application_id 単位 (thread_id がない旧形式も含む) でメッセージを時系列に並べ、
      // from の切替時点で前メッセージとの created_at 差を「応答時間」として集計
      const messages = await tx.message.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: {
          application_id: true,
          thread_id: true,
          from_user_id: true,
          from_facility_id: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
        take: 500_000,
      });
      // application_id か thread_id でグループ化 (どちらか先に存在する方)
      const groups = new Map<string, typeof messages>();
      for (const m of messages) {
        const k = m.thread_id ? `t:${m.thread_id}` : m.application_id ? `a:${m.application_id}` : null;
        if (!k) continue;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(m);
      }
      const diffs: number[] = [];
      for (const list of Array.from(groups.values())) {
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1];
          const cur = list[i];
          const prevIsWorker = prev.from_user_id !== null;
          const curIsWorker = cur.from_user_id !== null;
          // from の切り替わり = 応答
          if (prevIsWorker !== curIsWorker) {
            const h = (cur.created_at.getTime() - prev.created_at.getTime()) / (1000 * 60 * 60);
            if (h >= 0) diffs.push(h);
          }
        }
      }
      const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
      const rounded = Math.round(avg * 100) / 100;
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'FACILITY_RATING_DISTRIBUTION': {
      const grouped = await tx.review.groupBy({
        by: ['rating'],
        where: {
          reviewer_type: 'WORKER' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
        _count: { _all: true },
      });
      const rows = grouped
        .map((g) => ({ key: String(g.rating), value: g._count._all }))
        .sort((a, b) => Number(a.key) - Number(b.key));
      const total = rows.reduce((s, r) => s + r.value, 0);
      return { rows, total };
    }
    case 'WORKER_RATING_DISTRIBUTION': {
      const grouped = await tx.review.groupBy({
        by: ['rating'],
        where: {
          reviewer_type: 'FACILITY' as never,
          created_at: { gte: opts.start, lte: opts.end },
        },
        _count: { _all: true },
      });
      const rows = grouped
        .map((g) => ({ key: String(g.rating), value: g._count._all }))
        .sort((a, b) => Number(a.key) - Number(b.key));
      const total = rows.reduce((s, r) => s + r.value, 0);
      return { rows, total };
    }
    // ===== D群: Repeat / LaborDoc 系 =====
    case 'REPEAT_WORKER_RATE': {
      const apps = await tx.application.findMany({
        where: { created_at: { gte: opts.start, lte: opts.end } },
        select: {
          user_id: true,
          workDate: { select: { job: { select: { facility_id: true } } } },
        },
        take: 500_000,
      });
      if (apps.length === 0) return { rows: [{ key: 'rate', value: 0 }], total: 0 };
      const pairCount = new Map<string, number>();
      for (const a of apps) {
        const fid = a.workDate?.job?.facility_id;
        if (!fid) continue;
        const k = `${a.user_id}|${fid}`;
        pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
      }
      const repeatUsers = new Set<number>();
      for (const [k, c] of Array.from(pairCount.entries())) {
        if (c >= 2) repeatUsers.add(Number(k.split('|')[0]));
      }
      const totalUsers = new Set(apps.map((a) => a.user_id)).size;
      const rate = totalUsers > 0 ? (repeatUsers.size / totalUsers) * 100 : 0;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
    }
    case 'AVG_ATTENDANCE_HOURLY_WAGE': {
      const records = await tx.attendance.findMany({
        where: {
          created_at: { gte: opts.start, lte: opts.end },
          status: 'CHECKED_OUT',
          actual_start_time: { not: null },
          actual_end_time: { not: null },
          calculated_wage: { not: null },
        },
        select: {
          actual_start_time: true,
          actual_end_time: true,
          actual_break_time: true,
          calculated_wage: true,
        },
        take: 200_000,
      });
      const wages: number[] = [];
      for (const r of records) {
        if (!r.actual_start_time || !r.actual_end_time || r.calculated_wage == null) continue;
        const workMs = r.actual_end_time.getTime() - r.actual_start_time.getTime();
        const breakMs = (r.actual_break_time ?? 0) * 60 * 1000;
        const hours = (workMs - breakMs) / (1000 * 60 * 60);
        if (hours > 0) {
          wages.push(r.calculated_wage / hours);
        }
      }
      const avg = wages.length > 0 ? wages.reduce((s, v) => s + v, 0) / wages.length : 0;
      const rounded = Math.round(avg);
      return { rows: [{ key: 'avg', value: rounded }], total: rounded };
    }
    case 'LABOR_DOC_SUBMISSION_RATE': {
      const periodWhere = { created_at: { gte: opts.start, lte: opts.end } };
      const confirmedApps = await tx.application.count({
        where: {
          ...periodWhere,
          status: { notIn: ['APPLIED' as never, 'CANCELLED' as never] },
        },
      });
      const docs = await tx.laborDocument.count({ where: periodWhere });
      const rate = confirmedApps > 0 ? (docs / confirmedApps) * 100 : 0;
      const rounded = Math.round(rate * 100) / 100;
      return { rows: [{ key: 'rate', value: rounded }], total: rounded };
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
 *
 * OOM ガード (2026-05-04 追加): 念のため findMany に take 制限を入れる。
 * MAX_DAYS_AGGREGATION_ROWS を超えたら truncated 扱いで集計を止める。
 * (期間 + メトリクス次第では数百万件にスケールしうるため、Vercel Function 1024MB の OOM を防ぐ)
 *
 * 数値の正確性: 既存実装の JST 変換ロジックを完全に維持。
 *   `dt.getTime() + 9h offset` → `toISOString().slice(0,10)` で「JST 0 時境界の YYYY-MM-DD」。
 *   Postgres 側集計に書き換えると JST 境界の取り扱いミスで数値が変わる事故になりうるので、
 *   ここでは JS 側集計を維持しつつ件数上限だけ入れる方針。
 */
const MAX_DAYS_AGGREGATION_ROWS = 100_000;

async function aggregateByDay(
  // biome-ignore lint/suspicious/noExplicitAny: prisma model accessor の動的呼び出し
  model: any,
  where: Record<string, unknown>,
  dateField: string,
  total: number
): Promise<{ rows: QueryResultRow[]; total: number; truncated?: boolean }> {
  const records: Array<Record<string, unknown>> = await model.findMany({
    where,
    select: { [dateField]: true },
    take: MAX_DAYS_AGGREGATION_ROWS,
    // orderBy は不要 (集計するだけ)。take と組み合わせても件数取得が早い順序で問題なし
  });
  const truncated = records.length >= MAX_DAYS_AGGREGATION_ROWS;
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
  return truncated ? { rows, total, truncated: true } : { rows, total };
}

/**
 * LP ID 配列から LandingPage.name をまとめて解決して、表示用ラベルマップを返す。
 *
 * 既存の groupBy: 'lp_id' は key に lp_id (= LandingPage.lp_number の文字列) を入れて
 * 返していたが、ユーザーから「LLM がドラフトでは LP 名を表示すると言っているのに
 * 最終レポートでは ID しか出ない」と指摘あり。
 *
 * このヘルパーで lp_id → "LP <番号> (<name>)" のマップを作り、各 caller で rows[].label
 * に流す。LandingPage 側に該当が無い (= 削除済み LP / 未登録) の lp_id は label なしで
 * key だけ残す (件数自体は欠落させない)。
 *
 * 使用例:
 *   const grouped = await tx.lpPageView.groupBy({ by: ['lp_id'], ... })
 *   const labels = await resolveLpLabels(tx, grouped.map(g => g.lp_id).filter(Boolean) as string[])
 *   const rows = grouped.map(g => ({
 *     key: g.lp_id ?? '(null)',
 *     label: labels.get(g.lp_id ?? ''),
 *     value: g._count._all,
 *   }))
 */
async function resolveLpLabels(
  tx: ReadOnlyTx,
  lpIds: string[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (lpIds.length === 0) return labels;

  // lp_id (string) を Int に変換 (lp_number は Int @unique)。
  // 数値変換できないものはスキップ (LandingPage に存在しない ID として扱われる)。
  const lpNumbers = Array.from(
    new Set(
      lpIds
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n))
    )
  );
  if (lpNumbers.length === 0) return labels;

  const pages = await tx.landingPage.findMany({
    where: { lp_number: { in: lpNumbers } },
    select: { lp_number: true, name: true },
  });

  for (const p of pages) {
    const key = String(p.lp_number);
    labels.set(key, `LP ${p.lp_number} (${p.name})`);
  }
  return labels;
}
