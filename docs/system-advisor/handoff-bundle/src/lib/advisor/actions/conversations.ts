'use server';

/**
 * legacy `app/actions/conversations.ts` の Advisor 互換実装。
 *
 * legacy UI (chat-layout.tsx) が呼ぶシグネチャを維持しつつ、
 * 内部は Advisor 用の Prisma テーブルへ向ける。
 */

import { prisma } from '@/lib/prisma';
import { requireAdvisorAuth } from '../auth';

export interface ConversationSummary {
  id: string;
  title: string | null;
  mode: string;
  status: string;
  updated_at: string;
  /** しおり: true なら保持期間 cron の削除対象外 (Draft / Versions が永続保存される) */
  bookmarked: boolean;
}

export interface ConversationMessage {
  id: string;
  role: string;
  agent_id: string | null;
  content: string;
  created_at: string;
}

/** 自分のセッション一覧 (legacy 互換シグネチャ) */
export async function getConversations(limit = 50): Promise<ConversationSummary[]> {
  const auth = await requireAdvisorAuth();
  const rows = await prisma.advisorChatSession.findMany({
    where: { admin_id: auth.adminId, is_archived: false },
    orderBy: [{ is_pinned: 'desc' }, { last_message_at: 'desc' }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mode: 'advisor',
    status: 'active',
    updated_at: r.updated_at.toISOString(),
    bookmarked: r.bookmarked,
  }));
}

/** セッションのメッセージ一覧 */
export async function getConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  const auth = await requireAdvisorAuth();
  // 本人のセッションのみ
  const session = await prisma.advisorChatSession.findFirst({
    where: { id: conversationId, admin_id: auth.adminId },
    select: { id: true },
  });
  if (!session) return [];

  const rows = await prisma.advisorChatMessage.findMany({
    where: { session_id: conversationId },
    orderBy: { created_at: 'asc' },
  });
  // tool ロールは UI に出さない (legacy も同様の運用)
  return rows
    .filter((r) => r.role !== 'tool')
    .map((r) => ({
      id: r.id,
      role: r.role,
      agent_id: r.role === 'assistant' ? 'advisor' : null,
      content: r.content,
      created_at: r.created_at.toISOString(),
    }));
}

/** セッション削除 (legacy は物理削除だが、Advisor は監査用にソフトデリート) */
export async function deleteConversation(conversationId: string): Promise<void> {
  const auth = await requireAdvisorAuth();
  await prisma.advisorChatSession.updateMany({
    where: { id: conversationId, admin_id: auth.adminId },
    data: { is_archived: true },
  });
}

/** セッション一括削除 (ソフトデリート、自分のセッションのみ) */
export async function deleteConversations(
  conversationIds: string[]
): Promise<{ deletedCount: number }> {
  if (conversationIds.length === 0) return { deletedCount: 0 };
  const auth = await requireAdvisorAuth();
  const result = await prisma.advisorChatSession.updateMany({
    where: { id: { in: conversationIds }, admin_id: auth.adminId },
    data: { is_archived: true },
  });
  return { deletedCount: result.count };
}

/** 新規セッション作成 (legacy にはないが UI から呼ばれる場合の補助) */
export async function createConversation(opts: {
  title?: string;
}): Promise<ConversationSummary> {
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
    mode: 'advisor',
    status: 'active',
    updated_at: session.updated_at.toISOString(),
    bookmarked: session.bookmarked,
  };
}

/**
 * しおりトグル: bookmarked フラグを反転して保存。
 * しおり付きセッション = 保持期間 cron の削除対象外 (Draft / Versions が永続保存される)。
 */
export async function toggleBookmark(
  sessionId: string
): Promise<{ ok: true; bookmarked: boolean } | { ok: false; reason: string }> {
  const auth = await requireAdvisorAuth();
  const session = await prisma.advisorChatSession.findFirst({
    where: { id: sessionId, admin_id: auth.adminId },
    select: { id: true, bookmarked: true },
  });
  if (!session) return { ok: false, reason: 'セッションが存在しません' };
  const next = !session.bookmarked;
  await prisma.advisorChatSession.update({
    where: { id: session.id },
    data: { bookmarked: next },
  });
  return { ok: true, bookmarked: next };
}

/**
 * セッションのしおり状態取得 (Canvas で残日数バッジ表示用)。
 * Draft が紐づいているセッションを id で参照する用途。
 */
export async function getSessionBookmarkState(
  sessionId: string
): Promise<{ bookmarked: boolean; updatedAt: string } | null> {
  const auth = await requireAdvisorAuth();
  const session = await prisma.advisorChatSession.findFirst({
    where: { id: sessionId, admin_id: auth.adminId },
    select: { bookmarked: true, updated_at: true },
  });
  if (!session) return null;
  return {
    bookmarked: session.bookmarked,
    updatedAt: session.updated_at.toISOString(),
  };
}
