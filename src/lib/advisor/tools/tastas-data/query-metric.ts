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
