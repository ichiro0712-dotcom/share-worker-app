/**
 * Advisor 監査ログ
 *
 * すべての主要イベントを記録する。
 * 失敗してもメイン処理を止めないように、エラーは握りつぶす。
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type AdvisorAuditEventType =
  | 'chat_request'
  | 'chat_response'
  | 'tool_call'
  | 'tool_error'
  | 'rate_limit_hit'
  | 'cost_cap_hit'
  | 'auth_failed'
  | 'error'
  | 'knowledge_sync'
  | 'session_created'
  | 'session_deleted';

export async function recordAudit(input: {
  adminId: number;
  sessionId?: string | null;
  messageId?: string | null;
  eventType: AdvisorAuditEventType;
  payload: Prisma.InputJsonValue;
  clientIp?: string | null;
  clientUa?: string | null;
}): Promise<void> {
  try {
    await prisma.advisorAuditLog.create({
      data: {
        admin_id: input.adminId,
        session_id: input.sessionId ?? undefined,
        message_id: input.messageId ?? undefined,
        event_type: input.eventType,
        payload: input.payload,
        client_ip: input.clientIp ?? undefined,
        client_ua: input.clientUa ?? undefined,
      },
    });
  } catch (e) {
    console.error('[advisor] failed to record audit log:', e);
  }
}
