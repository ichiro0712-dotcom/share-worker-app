import type { AdvisorTool } from '../types';
import { runReadOnly, describeAdvisorDataConnection } from '@/src/lib/advisor/db';

interface Input {
  since_hours?: number;
  limit?: number;
}

interface ErrorRow {
  id: number;
  timestamp: string;
  source: string;
  message: string;
  details?: unknown;
}

interface Output {
  errors: ErrorRow[];
  count: number;
  source_note: string;
}

export const getRecentErrorsTool: AdvisorTool<Input, Output> = {
  name: 'get_recent_errors',
  category: 'tastas-data',
  description:
    'TASTAS の SystemLog テーブルから最近のエラー系ログを取得します。' +
    '\n\n注意: 本テーブルは管理者操作の監査ログです。runtime エラーは Vercel ログに残るため get_vercel_logs を併用してください。' +
    '\n\n使用例: 「最近の管理者操作」「異常な操作はあった?」',
  inputSchema: {
    type: 'object',
    properties: {
      since_hours: {
        type: 'integer',
        description: '何時間前までのログを対象にするか',
        default: 24,
      },
      limit: {
        type: 'integer',
        description: '最大件数',
        default: 50,
      },
    },
  },
  outputDescription:
    '{ errors: [{ id, timestamp, source, message, details }], count, source_note }',
  async available() {
    const conn = describeAdvisorDataConnection();
    if (conn.source === 'local_fallback') {
      return {
        ready: true,
        reason:
          'ADVISOR_DATA_DATABASE_URL 未設定: 開発用 DB にフォールバック中。本番ログは get_vercel_logs / get_supabase_logs を使用してください。',
      };
    }
    return { ready: true };
  },
  async execute(input) {
    const start = Date.now();
    try {
      const sinceHours = Math.max(1, Math.min(input.since_hours ?? 24, 24 * 30));
      const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
      const limit = Math.min(input.limit ?? 50, 200);

      const rows = await runReadOnly((tx) =>
        tx.systemLog.findMany({
          where: {
            created_at: { gte: since },
            action: { contains: 'ERROR', mode: 'insensitive' },
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        })
      );

      const errors: ErrorRow[] = rows.map((r) => ({
        id: r.id,
        timestamp: r.created_at.toISOString(),
        source: `${r.target_type}:${r.target_id ?? '-'}`,
        message: r.action,
        details: r.details ?? undefined,
      }));

      return {
        ok: true,
        data: {
          errors,
          count: errors.length,
          source_note:
            'SystemLog (管理者操作の監査ログ) の中から ERROR を含む action を抽出。runtime エラーは get_vercel_logs を参照。',
        },
        metadata: { tookMs: Date.now() - start, rowCount: errors.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `エラーログ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
