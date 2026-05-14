import type { AdvisorTool } from '../types';
import { runReadOnly, describeAdvisorDataConnection } from '@/src/lib/advisor/db';

interface Input {
  facility_id?: number;
}

interface Output {
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  total: number;
  filter_applied: { facility_id?: number };
}

export const getJobsSummaryTool: AdvisorTool<Input, Output> = {
  name: 'get_jobs_summary',
  category: 'tastas-data',
  description:
    '求人 (Job テーブル) の状態別件数と種類別件数を取得します。' +
    '\n\n使用例: 「求人何件? どんな状態?」「アクティブな求人は?」',
  inputSchema: {
    type: 'object',
    properties: {
      facility_id: {
        type: 'integer',
        description: '特定施設に絞り込みたい場合のみ指定 (Facility.id)',
      },
    },
  },
  outputDescription:
    '{ by_status: {active, draft, suspended, ...}, by_type: {NORMAL, OFFER, LIMITED, ...}, total }',
  async available() {
    const conn = describeAdvisorDataConnection();
    if (conn.source === 'local_fallback') {
      return {
        ready: true,
        reason:
          'ADVISOR_DATA_DATABASE_URL 未設定: 開発用 DB (DATABASE_URL) にフォールバック。本番データを見るには Supabase 読み取り専用ロールの DSN を設定してください。',
      };
    }
    return { ready: true };
  },
  async execute(input) {
    const start = Date.now();
    try {
      const where = input.facility_id ? { facility_id: input.facility_id } : {};

      const [byStatus, byType, total] = await runReadOnly((tx) =>
        Promise.all([
          tx.job.groupBy({ by: ['status'], where, _count: { _all: true } }),
          tx.job.groupBy({ by: ['job_type'], where, _count: { _all: true } }),
          tx.job.count({ where }),
        ])
      );

      const statusMap: Record<string, number> = {};
      for (const g of byStatus) statusMap[String(g.status)] = g._count._all;

      const typeMap: Record<string, number> = {};
      for (const g of byType) typeMap[String(g.job_type)] = g._count._all;

      return {
        ok: true,
        data: {
          by_status: statusMap,
          by_type: typeMap,
          total,
          filter_applied: { facility_id: input.facility_id },
        },
        metadata: {
          tookMs: Date.now() - start,
          rowCount: byStatus.length + byType.length,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error: `求人サマリ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
