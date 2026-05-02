import type { AdvisorTool } from '../types';

interface Input {
  source?: 'postgres' | 'api' | 'auth';
  since_minutes?: number;
  limit?: number;
}

interface LogEntry {
  timestamp: string;
  source: string;
  level?: string;
  message: string;
  meta?: unknown;
}

interface Output {
  logs: LogEntry[];
  count: number;
  source_note: string;
}

const SUPABASE_API = 'https://api.supabase.com';

export const getSupabaseLogsTool: AdvisorTool<Input, Output> = {
  name: 'get_supabase_logs',
  category: 'external',
  description:
    'Supabase のログを取得します (Management API 経由)。' +
    '\n\nsource: postgres (DB), api (PostgREST), auth (Auth サービス)' +
    '\n\n使用例: 「DB のスロークエリ」「Supabase API のエラー」' +
    '\n\n注意: Supabase Management API は変更頻度が高いため、エンドポイントが動作しない場合があります。',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        enum: ['postgres', 'api', 'auth'],
        default: 'api',
      },
      since_minutes: {
        type: 'integer',
        default: 60,
      },
      limit: {
        type: 'integer',
        default: 100,
      },
    },
  },
  outputDescription: '{ logs: [{ timestamp, source, level?, message, meta }], count, source_note }',
  async available() {
    if (!process.env.SUPABASE_MANAGEMENT_TOKEN) {
      return {
        ready: false,
        reason: 'SUPABASE_MANAGEMENT_TOKEN が未設定',
        plannedFrom: 'Supabase ダッシュボードで Personal Access Token を発行後に利用可能',
      };
    }
    if (!process.env.SUPABASE_PROJECT_REF) {
      return {
        ready: false,
        reason: 'SUPABASE_PROJECT_REF が未設定',
      };
    }
    return { ready: true };
  },
  async execute(input, ctx) {
    const start = Date.now();
    const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
    const projectRef = process.env.SUPABASE_PROJECT_REF;
    if (!token || !projectRef) {
      return { ok: false, error: 'Supabase 認証情報が未設定です' };
    }

    const source = input.source ?? 'api';
    const sinceMinutes = input.since_minutes ?? 60;
    const limit = Math.min(input.limit ?? 100, 500);

    // Supabase Logflare API 経由でログ取得
    // https://supabase.com/docs/reference/api/logs
    const sql = buildLogQuery(source, sinceMinutes, limit);
    const url = `${SUPABASE_API}/v1/projects/${projectRef}/analytics/endpoints/logs.all`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
        signal: ctx.abortSignal,
      });

      if (!res.ok) {
        return {
          ok: false,
          error: `Supabase logs API error ${res.status}: ${await res.text().catch(() => '')}`,
          userActionable:
            'Supabase Management API は不安定な場合があります。Supabase ダッシュボードを直接確認してください。',
        };
      }

      const json = (await res.json()) as { result?: Array<Record<string, unknown>> };
      const rows = json.result ?? [];

      const logs: LogEntry[] = rows.map((row) => ({
        timestamp: String(row.timestamp ?? row.event_message_time ?? ''),
        source,
        level: row.level ? String(row.level) : undefined,
        message:
          typeof row.event_message === 'string'
            ? row.event_message
            : JSON.stringify(row).slice(0, 500),
        meta: row,
      }));

      return {
        ok: true,
        data: {
          logs,
          count: logs.length,
          source_note: `Supabase ${source} logs (project: ${projectRef})`,
        },
        metadata: { tookMs: Date.now() - start, rowCount: logs.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `Supabase ログ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

function buildLogQuery(source: string, sinceMinutes: number, limit: number): string {
  const sinceMs = Date.now() - sinceMinutes * 60 * 1000;
  // Supabase の SQL flavor (BigQuery 系)
  const tableMap: Record<string, string> = {
    postgres: 'postgres_logs',
    api: 'edge_logs',
    auth: 'auth_logs',
  };
  const table = tableMap[source] ?? 'edge_logs';
  return `select id, timestamp, event_message from ${table} where timestamp > '${sinceMs}000' order by timestamp desc limit ${limit}`;
}
