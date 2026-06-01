// 出金失敗時にワーカーへ通知する（口座を確認・修正して再申請を促す）。
// 'use server' にしない（cron からのみ呼ぶ。公開アクションにしない）。
// 完全防御: 通知失敗で出金処理を止めない（呼び出し側は fire-and-forget）。
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { sendNotification } from '@/src/lib/notification-service'

export const WITHDRAWAL_FAILED_NOTIFICATION_KEY = 'WORKER_WITHDRAWAL_FAILED'

/** 出金IDの末尾6桁から安定サポートコードを生成（A3エラーキューと同形式）（純粋）。 */
export function buildWithdrawalSupportCode(id: string): string {
  return `HB-${id.slice(-6).toUpperCase()}`
}

/** この状態のときだけワーカーへ失敗通知する（純粋）。FAILED のみ＝残高復元済み・要再申請。 */
export function shouldNotifyWithdrawalFailure(status: string): boolean {
  return status === 'FAILED'
}

/** 通知テンプレートの変数（純粋）。テンプレ側は {{worker_name}} 等で参照。
 * resubmit_url はプッシュ通知のタップ遷移先(notification-service が参照)。 */
export function buildWithdrawalFailedVariables(input: {
  workerName: string
  amount: number
  supportCode: string
  accountUrl: string
}): Record<string, string> {
  return {
    worker_name: input.workerName,
    amount: input.amount.toLocaleString('ja-JP'),
    support_code: input.supportCode,
    account_url: input.accountUrl,
    resubmit_url: input.accountUrl,
  }
}

/**
 * 出金失敗をワーカーへ通知する。status=FAILED のときだけ送る
 * （組戻不成立26はCOMPLETED永続＝資金はワーカー側にあるため通知しない）。
 */
export async function notifyWorkerWithdrawalFailed(withdrawalId: string): Promise<void> {
  try {
    if (!isHibaraiEnabled()) return
    const w = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: {
        id: true,
        status: true,
        requested_amount: true,
        worker_id: true,
        worker: { select: { name: true, email: true } },
      },
    })
    // FAILED 以外（COMPLETED/26、PROCESSING等）は通知対象外。
    if (!w || !shouldNotifyWithdrawalFailure(w.status)) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.work'
    const variables = buildWithdrawalFailedVariables({
      workerName: w.worker?.name ?? '',
      amount: w.requested_amount,
      supportCode: buildWithdrawalSupportCode(w.id),
      accountUrl: `${appUrl}/mypage/money/withdrawals/${w.id}/error`,
    })

    await sendNotification({
      notificationKey: WITHDRAWAL_FAILED_NOTIFICATION_KEY,
      targetType: 'WORKER',
      recipientId: w.worker_id,
      recipientName: w.worker?.name ?? '',
      recipientEmail: w.worker?.email ?? undefined,
      variables,
    })
  } catch (error) {
    // 通知失敗は出金フローに影響させない。
    console.error('[WITHDRAWAL_FAILED_NOTIFICATION] failed:', error)
  }
}
