import type { AdvisorTool } from '../types';

interface Input {
  since_minutes?: number;
  level?: 'error' | 'warning' | 'info';
  limit?: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  request_id?: string;
}

interface Output {
  logs: LogEntry[];
  count: number;
  source_note: string;
}

const VERCEL_API = 'https://api.vercel.com';

export const getVercelLogsTool: AdvisorTool<Input, Output> = {
  name: 'get_vercel_logs',
  category: 'external',
  description:
    'Vercel Runtime Logs (本番デプロイのサーバーサイドログ) を取得します。' +
    '\n\n使用例: 「今エラー出てる?」「先ほどの不具合の原因」' +
    '\n\n注意: 直近のデプロイのログのみ取得可能。古いログは Vercel ダッシュボードを直接確認する必要があります。',
  inputSchema: {
    type: 'object',
    properties: {
      since_minutes: {
        type: 'integer',
        description: '何分前まで遡るか',
        default: 60,
      },
      level: {
        type: 'string',
        enum: ['error', 'warning', 'info'],
        description: '絞り込むログレベル',
      },
      limit: {
        type: 'integer',
        description: '最大件数',
        default: 100,
      },
    },
  },
  outputDescription: '{ logs: [{ timestamp, level, message, source, request_id }], count }',
  async available() {
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) {
      return {
        ready: false,
        reason: 'VERCEL_API_TOKEN が未設定',
        plannedFrom: 'Vercel ダッシュボードで API Token を発行し、環境変数に設定後に利用可能',
      };
    }
    return { ready: true };
  },
  async execute(input, ctx) {
    const start = Date.now();
    const token = process.env.VERCEL_API_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;
    if (!token) {
      return { ok: false, error: 'VERCEL_API_TOKEN が未設定です' };
    }

    try {
      // Phase 1 では最新 deployment のイベントのみ取得
      // 1. 最新 production deployment を取得
      const deploymentsUrl =
        `${VERCEL_API}/v6/deployments?target=production&limit=1` +
        (projectId ? `&projectId=${projectId}` : '') +
        (teamId ? `&teamId=${teamId}` : '');

      const depRes = await fetch(deploymentsUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctx.abortSignal,
      });
      if (!depRes.ok) {
        return {
          ok: false,
          error: `Vercel deployments API error ${depRes.status}: ${await depRes.text().catch(() => '')}`,
        };
      }
      const depJson = (await depRes.json()) as { deployments: Array<{ uid: string; url: string }> };
      const deployment = depJson.deployments?.[0];
      if (!deployment) {
        return { ok: false, error: '本番デプロイが見つかりません' };
      }

      // 2. デプロイのログを取得
      const since = Date.now() - (input.since_minutes ?? 60) * 60 * 1000;
      const limit = Math.min(input.limit ?? 100, 500);

      const logsUrl =
        `${VERCEL_API}/v3/deployments/${deployment.uid}/events?` +
        `limit=${limit}&since=${since}` +
        (teamId ? `&teamId=${teamId}` : '');

      const logRes = await fetch(logsUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctx.abortSignal,
      });
      if (!logRes.ok) {
        return {
          ok: false,
          error: `Vercel logs API error ${logRes.status}: ${await logRes.text().catch(() => '')}`,
        };
      }
      const logsJson = (await logRes.json()) as Array<{
        date: number;
        type?: string;
        text?: string;
        payload?: { text?: string };
        requestId?: string;
        statusCode?: number;
      }>;

      let logs: LogEntry[] = (Array.isArray(logsJson) ? logsJson : []).map((e) => ({
        timestamp: new Date(e.date).toISOString(),
        level: e.type ?? 'info',
        message: e.text ?? e.payload?.text ?? '',
        request_id: e.requestId,
      }));

      if (input.level) {
        logs = logs.filter((l) => l.level.toLowerCase() === input.level);
      }

      return {
        ok: true,
        data: {
          logs,
          count: logs.length,
          source_note: `Vercel deployment ${deployment.uid} (${deployment.url})`,
        },
        metadata: { tookMs: Date.now() - start, rowCount: logs.length },
      };
    } catch (e) {
      return {
        ok: false,
        error: `Vercel ログ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
