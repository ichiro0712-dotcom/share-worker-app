/**
 * コスト上限ガード + 日次使用量集計
 *
 * - リクエスト前に「今日の累計 + 推定入力tokens」が上限を超えそうかチェック
 * - リクエスト後に実際の使用量を加算
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getTodayJSTStart } from './jst';
import { ADVISOR_MODELS, estimateCostUsd, type AdvisorModelId } from './claude';

const DAILY_TOKEN_CAP_DEFAULT = 2_000_000;

export interface CostCheckResult {
  allowed: boolean;
  reason?: string;
  usedToday: number;
  cap: number;
}

export async function checkCostCap(opts: {
  adminId: number;
  estimatedInputTokens?: number;
}): Promise<CostCheckResult> {
  const cap = parseInt(process.env.ADVISOR_DAILY_TOKEN_CAP ?? '') || DAILY_TOKEN_CAP_DEFAULT;
  const today = getTodayJSTStart();

  const usage = await prisma.advisorUsageDaily.findUnique({
    where: { admin_id_date_jst: { admin_id: opts.adminId, date_jst: today } },
  });

  const currentUsed = usage ? usage.input_tokens + usage.output_tokens : 0;
  const projected = currentUsed + (opts.estimatedInputTokens ?? 0);

  if (projected > cap) {
    return {
      allowed: false,
      reason: `1日のトークン上限 (${cap.toLocaleString()}) に到達しています。明日まで待つか、管理者にキャップ引き上げを依頼してください。`,
      usedToday: currentUsed,
      cap,
    };
  }

  return { allowed: true, usedToday: currentUsed, cap };
}

/** 使用量を加算 (orchestrator 完了時に呼ぶ) */
export async function incrementUsage(input: {
  adminId: number;
  modelId: AdvisorModelId;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  toolCallCount?: number;
}): Promise<void> {
  const today = getTodayJSTStart();
  const cost = estimateCostUsd({
    modelId: input.modelId,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cacheReadTokens: input.cacheReadTokens,
    cacheWriteTokens: input.cacheWriteTokens,
  });

  await prisma.advisorUsageDaily.upsert({
    where: { admin_id_date_jst: { admin_id: input.adminId, date_jst: today } },
    create: {
      admin_id: input.adminId,
      date_jst: today,
      message_count: 1,
      tool_call_count: input.toolCallCount ?? 0,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cache_read_tokens: input.cacheReadTokens ?? 0,
      cache_write_tokens: input.cacheWriteTokens ?? 0,
      estimated_cost_usd: new Prisma.Decimal(cost),
    },
    update: {
      message_count: { increment: 1 },
      tool_call_count: { increment: input.toolCallCount ?? 0 },
      input_tokens: { increment: input.inputTokens },
      output_tokens: { increment: input.outputTokens },
      cache_read_tokens: { increment: input.cacheReadTokens ?? 0 },
      cache_write_tokens: { increment: input.cacheWriteTokens ?? 0 },
      estimated_cost_usd: { increment: new Prisma.Decimal(cost) },
    },
  });
}

/** 統計取得 (UI / monitoring 用、Phase 外) */
export async function getDailyUsage(opts: { adminId: number; days?: number }) {
  const days = opts.days ?? 30;
  const since = new Date(getTodayJSTStart().getTime() - days * 24 * 60 * 60 * 1000);
  return prisma.advisorUsageDaily.findMany({
    where: { admin_id: opts.adminId, date_jst: { gte: since } },
    orderBy: { date_jst: 'desc' },
  });
}

export { ADVISOR_MODELS };
