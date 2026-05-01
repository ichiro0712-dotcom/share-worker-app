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
  };
}
