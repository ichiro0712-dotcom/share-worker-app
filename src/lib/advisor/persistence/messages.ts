/**
 * Advisor チャットメッセージの永続化
 *
 * Server Action として呼び出される。
 * orchestrator は内部関数経由で使うので、本ファイルは UI 用の getter が中心。
 */

'use server';

import { prisma } from '@/lib/prisma';
import { requireAdvisorAuth } from '../auth';
import type { Prisma } from '@prisma/client';

export interface AdvisorMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown;
  toolResult?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  createdAt: Date;
}

/** セッションのメッセージ全件を取得 (本人のセッションのみ) */
export async function getAdvisorMessages(sessionId: string): Promise<AdvisorMessageRecord[]> {
  const auth = await requireAdvisorAuth();
  const session = await prisma.advisorChatSession.findFirst({
    where: { id: sessionId, admin_id: auth.adminId },
    select: { id: true },
  });
  if (!session) return [];

  const rows = await prisma.advisorChatMessage.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant' | 'tool',
    content: r.content,
    toolCalls: r.tool_calls ?? undefined,
    toolResult: r.tool_result ?? undefined,
    inputTokens: r.input_tokens ?? undefined,
    outputTokens: r.output_tokens ?? undefined,
    model: r.model ?? undefined,
    createdAt: r.created_at,
  }));
}

/** 最新N件 + 圧縮対象から外したいメッセージのみを取得 (Orchestrator 用) */
export async function getRecentMessagesForOrchestrator(opts: {
  sessionId: string;
  limit?: number;
}): Promise<AdvisorMessageRecord[]> {
  // Orchestrator は内部呼び出しなので auth チェックは API Route 側で行う前提
  const rows = await prisma.advisorChatMessage.findMany({
    where: { session_id: opts.sessionId, is_compacted: false },
    orderBy: { created_at: 'asc' },
    take: opts.limit ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant' | 'tool',
    content: r.content,
    toolCalls: r.tool_calls ?? undefined,
    toolResult: r.tool_result ?? undefined,
    inputTokens: r.input_tokens ?? undefined,
    outputTokens: r.output_tokens ?? undefined,
    model: r.model ?? undefined,
    createdAt: r.created_at,
  }));
}

/** メッセージの追加 (Orchestrator 内部用) */
export async function appendMessage(input: {
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Prisma.InputJsonValue;
  toolResult?: Prisma.InputJsonValue;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  model?: string;
}): Promise<{ id: string }> {
  const created = await prisma.advisorChatMessage.create({
    data: {
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      tool_calls: input.toolCalls ?? undefined,
      tool_result: input.toolResult ?? undefined,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cache_read_tokens: input.cacheReadTokens,
      cache_write_tokens: input.cacheWriteTokens,
      model: input.model,
    },
    select: { id: true },
  });
  return created;
}

/** メッセージ数集計 (rate-limit 用) */
export async function countUserMessagesByAdmin(opts: {
  adminId: number;
  since: Date;
}): Promise<number> {
  return prisma.advisorChatMessage.count({
    where: {
      role: 'user',
      created_at: { gte: opts.since },
      session: { admin_id: opts.adminId },
    },
  });
}
