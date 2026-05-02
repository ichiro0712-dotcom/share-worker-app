'use server';

/**
 * legacy `app/actions/pending-actions.ts` の Advisor 用 stub。
 *
 * Advisor は読み取り専用なので write 系 action 承認は不要。
 * しかし UI の import を壊さないように関数の存在を保証する。
 */

export async function approveAction(
  _actionId: string
): Promise<{
  success: boolean;
  error?: string;
  result?: Record<string, string>;
  actionType?: string;
}> {
  // Advisor では action 承認機能は無効化
  return {
    success: false,
    error: 'Advisor は読み取り専用のため、action 承認機能はありません',
  };
}

/**
 * Advisor では使わない (2FA リトライ等の write 系 action は対応外)。
 * UI の dynamic import を壊さないために存在のみ提供。
 */
export async function createPendingAction(
  _conversationId: string,
  _actionType: string,
  _payload: Record<string, unknown>
): Promise<string | null> {
  return null;
}
