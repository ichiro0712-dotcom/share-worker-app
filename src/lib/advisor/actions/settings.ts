'use server';

/**
 * Advisor 設定ページ用 Server Actions
 * - getSettings: 現在の設定値を取得
 * - saveSettings: System Admin が編集した設定を保存
 * - getDataSources: 参照可能な外部データソースの一覧 (表示のみ)
 * - getMonthlyUsage: 月次の LLM 使用統計 (表示のみ)
 */

import { prisma } from '@/lib/prisma';
import { requireAdvisorAuth } from '../auth';
import {
  getAdvisorSettings,
  updateAdvisorSettings,
  type AdvisorSettingsValues,
} from '../persistence/settings';
import { getDefaultPromptText } from '../system-prompt';
import { describeAdvisorDataConnection } from '../db';
import { getAvailableTools } from '../tools/registry';

export interface SettingsPagePayload {
  current: AdvisorSettingsValues;
  defaultPromptText: string;
}

/** 設定ページ初期データ */
export async function getSettings(): Promise<SettingsPagePayload> {
  await requireAdvisorAuth();
  const current = await getAdvisorSettings();
  return {
    current,
    defaultPromptText: getDefaultPromptText(),
  };
}

/** 設定保存 */
export async function saveSettings(opts: {
  maxToolLoops: number;
  systemPromptOverride: string | null;
  /** null を渡すとデフォルトモデル (code 内 ADVISOR_MODELS.sonnet) に戻す */
  primaryModelId?: string | null;
  /** null を渡すと primary と同じモデルになる */
  loop1ModelId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdvisorAuth();
  try {
    await updateAdvisorSettings({
      adminId: auth.adminId,
      maxToolLoops: opts.maxToolLoops,
      systemPromptOverride: opts.systemPromptOverride,
      primaryModelId: opts.primaryModelId,
      loop1ModelId: opts.loop1ModelId,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface DataSourceInfo {
  id: string;
  label: string;
  category: 'github' | 'database' | 'logs' | 'analytics' | 'other';
  status: 'ready' | 'unavailable' | 'fallback';
  detail: string;
}

/**
 * 参照可能な外部データソース一覧を返す。
 * 設定ページで「現在 Advisor が触れるデータの一覧」を表示するため。
 */
export async function getDataSources(): Promise<DataSourceInfo[]> {
  await requireAdvisorAuth();
  const sources: DataSourceInfo[] = [];

  // 1. GitHub
  const githubOwner = process.env.ADVISOR_GITHUB_OWNER;
  const githubRepo = process.env.ADVISOR_GITHUB_REPO;
  const githubToken = process.env.GITHUB_TOKEN_FOR_ADVISOR;
  sources.push({
    id: 'github',
    label: `GitHub (${githubOwner ?? '?'}/${githubRepo ?? '?'})`,
    category: 'github',
    status: githubToken && githubOwner && githubRepo ? 'ready' : 'unavailable',
    detail: githubToken
      ? `main ブランチを参照。READ ONLY (PAT scope: contents:read)`
      : 'GITHUB_TOKEN_FOR_ADVISOR が未設定',
  });

  // 2. 本番 Supabase DB
  const conn = describeAdvisorDataConnection();
  sources.push({
    id: 'production_supabase',
    label: '本番 Supabase DB',
    category: 'database',
    status: conn.source === 'production_supabase' ? 'ready' : 'fallback',
    detail:
      conn.source === 'production_supabase'
        ? `${conn.host} に advisor_readonly ロールで接続 (SELECT のみ)`
        : '⚠️ ADVISOR_DATA_DATABASE_URL 未設定: 開発用 DB にフォールバック中',
  });

  // 3. Supabase Management API (ログ取得)
  const hasMgmt =
    !!process.env.SUPABASE_MANAGEMENT_TOKEN && !!process.env.SUPABASE_PROJECT_REF;
  sources.push({
    id: 'supabase_logs',
    label: 'Supabase ログ (Management API)',
    category: 'logs',
    status: hasMgmt ? 'ready' : 'unavailable',
    detail: hasMgmt
      ? `Project ${process.env.SUPABASE_PROJECT_REF} の logs.all を読める`
      : 'SUPABASE_MANAGEMENT_TOKEN / SUPABASE_PROJECT_REF が未設定',
  });

  // 4. GA4
  const hasGa4 =
    (!!process.env.GA_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS) &&
    !!process.env.GA4_PROPERTY_ID;
  sources.push({
    id: 'ga4',
    label: 'Google Analytics 4',
    category: 'analytics',
    status: hasGa4 ? 'ready' : 'unavailable',
    detail: hasGa4 ? `Property ID: ${process.env.GA4_PROPERTY_ID}` : 'GA4 認証情報が未設定',
  });

  // 5. Vercel
  const hasVercel = !!process.env.VERCEL_TOKEN;
  sources.push({
    id: 'vercel',
    label: 'Vercel (deployments / logs)',
    category: 'logs',
    status: hasVercel ? 'ready' : 'unavailable',
    detail: hasVercel ? 'デプロイ履歴 / Function ログを取得' : 'VERCEL_TOKEN が未設定',
  });

  // 6. ローカルの Advisor メタデータ DB (常に ready)
  sources.push({
    id: 'advisor_meta',
    label: 'Advisor メタデータ DB (チャット履歴・監査ログ)',
    category: 'database',
    status: 'ready',
    detail: 'AdvisorChatSession / AdvisorAuditLog 等。書き込み可 (Advisor 自身の履歴)',
  });

  return sources;
}

export interface ToolStatusInfo {
  name: string;
  category: string;
  description: string;
  ready: boolean;
  reason?: string;
}

/**
 * 現在登録されている全ツールの一覧 + 利用可否
 */
export async function getToolList(): Promise<ToolStatusInfo[]> {
  await requireAdvisorAuth();
  const tools = getAvailableTools();
  const results: ToolStatusInfo[] = [];
  for (const t of tools) {
    let ready = true;
    let reason: string | undefined;
    if (t.available) {
      try {
        const s = await t.available();
        ready = s.ready;
        reason = s.reason;
      } catch (e) {
        ready = false;
        reason = e instanceof Error ? e.message : String(e);
      }
    }
    results.push({
      name: t.name,
      category: t.category,
      description: t.description.split('\n')[0]?.slice(0, 120) ?? '',
      ready,
      reason,
    });
  }
  return results;
}

export interface MonthlyUsageRow {
  month: string; // YYYY-MM
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  toolCallCount: number;
  messageCount: number;
  estimatedCostUsd: number;
}

/**
 * 月次の LLM 使用統計 (直近 12ヶ月)
 *
 * AdvisorUsageDaily を月単位で GROUP BY した結果を返す。
 * 注: 現スキーマは admin_id × date_jst ユニークで model_id は持っていないので、
 *     モデル別の内訳は出せない (全モデル合算)。モデル別が欲しくなったら
 *     AdvisorUsageDaily にカラム追加が必要 (将来課題)。
 */
export async function getMonthlyUsage(): Promise<MonthlyUsageRow[]> {
  await requireAdvisorAuth();

  // 直近 12ヶ月分のレコードを取得
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const rows = await prisma.advisorUsageDaily.findMany({
    where: { date_jst: { gte: cutoff } },
    orderBy: { date_jst: 'asc' },
  });

  const map = new Map<string, MonthlyUsageRow>();
  for (const r of rows) {
    const month = `${r.date_jst.getFullYear()}-${String(r.date_jst.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(month);
    const cost = Number(r.estimated_cost_usd);
    if (existing) {
      existing.inputTokens += r.input_tokens;
      existing.outputTokens += r.output_tokens;
      existing.cacheReadTokens += r.cache_read_tokens;
      existing.cacheWriteTokens += r.cache_write_tokens;
      existing.totalTokens += r.input_tokens + r.output_tokens;
      existing.toolCallCount += r.tool_call_count;
      existing.messageCount += r.message_count;
      existing.estimatedCostUsd += cost;
    } else {
      map.set(month, {
        month,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        totalTokens: r.input_tokens + r.output_tokens,
        toolCallCount: r.tool_call_count,
        messageCount: r.message_count,
        estimatedCostUsd: cost,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
}
