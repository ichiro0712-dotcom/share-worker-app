/**
 * Advisor チャットセッションの永続化 (CRUD)
 *
 * Server Action として呼び出される想定。すべて認証必須。
 */

'use server';

import { prisma } from '@/lib/prisma';
import { requireAdvisorAuth } from '../auth';

export interface AdvisorSessionSummary {
  id: string;
  title: string;
  lastMessageAt: Date;
  isPinned: boolean;
  isArchived: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  createdAt: Date;
}

/** 自分のセッション一覧を取得 (新しい順) */
export async function getAdvisorSessions(opts?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<AdvisorSessionSummary[]> {
  const auth = await requireAdvisorAuth();
  const where: { admin_id: number; is_archived?: boolean } = { admin_id: auth.adminId };
  if (!opts?.includeArchived) where.is_archived = false;

  const rows = await prisma.advisorChatSession.findMany({
    where,
    orderBy: [{ is_pinned: 'desc' }, { last_message_at: 'desc' }],
    take: opts?.limit ?? 50,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    lastMessageAt: r.last_message_at,
    isPinned: r.is_pinned,
    isArchived: r.is_archived,
    totalInputTokens: r.total_input_tokens,
    totalOutputTokens: r.total_output_tokens,
    createdAt: r.created_at,
  }));
}

/** 新規セッション作成 */
export async function createAdvisorSession(opts: { title?: string }): Promise<AdvisorSessionSummary> {
  const auth = await requireAdvisorAuth();
  const session = await prisma.advisorChatSession.create({
    data: {
      admin_id: auth.adminId,
      title: opts.title?.trim() || '新しい会話',
    },
  });
  return {
    id: session.id,
    title: session.title,
    lastMessageAt: session.last_message_at,
    isPinned: session.is_pinned,
    isArchived: session.is_archived,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    createdAt: session.created_at,
  };
}

/** セッションのメタ情報を取得 (本人のもののみ) */
export async function getAdvisorSession(sessionId: string) {
  const auth = await requireAdvisorAuth();
  const row = await prisma.advisorChatSession.findFirst({
    where: { id: sessionId, admin_id: auth.adminId },
  });
  if (!row) return null;
  return row;
}

/** セッションのタイトル更新 */
export async function renameAdvisorSession(opts: { sessionId: string; title: string }): Promise<void> {
  const auth = await requireAdvisorAuth();
  await prisma.advisorChatSession.updateMany({
    where: { id: opts.sessionId, admin_id: auth.adminId },
    data: { title: opts.title.trim().slice(0, 200) },
  });
}

/** セッション削除 (ソフトデリート: is_archived = true) */
export async function deleteAdvisorSession(sessionId: string): Promise<void> {
  const auth = await requireAdvisorAuth();
  await prisma.advisorChatSession.updateMany({
    where: { id: sessionId, admin_id: auth.adminId },
    data: { is_archived: true },
  });
}

/** セッションのピン留め切り替え */
export async function toggleAdvisorSessionPin(sessionId: string): Promise<boolean> {
  const auth = await requireAdvisorAuth();
  const session = await prisma.advisorChatSession.findFirst({
    where: { id: sessionId, admin_id: auth.adminId },
  });
  if (!session) return false;
  const newPin = !session.is_pinned;
  await prisma.advisorChatSession.update({
    where: { id: sessionId },
    data: { is_pinned: newPin },
  });
  return newPin;
}

/** セッションのトークン使用量を加算 (orchestrator から呼ばれる) */
export async function incrementSessionUsage(opts: {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await prisma.advisorChatSession.update({
    where: { id: opts.sessionId },
    data: {
      total_input_tokens: { increment: opts.inputTokens },
      total_output_tokens: { increment: opts.outputTokens },
      last_message_at: new Date(),
    },
  });
}
