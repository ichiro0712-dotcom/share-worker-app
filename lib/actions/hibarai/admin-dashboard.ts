// 管理ダッシュボード(A1)集計と監査ログ(A6)の読み取り。
// 'use server' にしない（Server Component から呼ぶ純粋なサーバー関数。公開アクションにはしない）。
import { WithdrawalStatus } from '@prisma/client'
import type { AuditLogItem } from '@/lib/dummy-data/hibarai'
import prisma from '@/lib/prisma'
import { getTodayJSTStart } from './utils'

/** 監査ログの result(SUCCESS/ERROR/WARNING) を表示用にマップ（純粋） */
export function mapAuditResult(result: string): AuditLogItem['result'] {
  switch (result) {
    case 'SUCCESS':
      return '成功'
    case 'ERROR':
      return '失敗'
    case 'WARNING':
      return '警告'
    default:
      return '承認待ち'
  }
}

/** action からUIフィルタ種別を導出（純粋） */
export function mapAuditType(action: string): AuditLogItem['type'] {
  if (action.startsWith('EMERGENCY_STOP')) return 'emergency'
  if (action === 'POLICY_UPDATED' || action === 'HIBARAI_SETTINGS_UPDATED') return 'policy'
  if (action.startsWith('OAUTH') || action.includes('TOKEN')) return 'auth'
  if (action.startsWith('BANK') || action.includes('ACCOUNT')) return 'account'
  return 'withdrawal'
}

export type AdminDashboardSummary = {
  todayRequests: number
  errorCount: number
  stoppedWorkers: number
  totalWithdrawn: number
  // 未送金（GMO未送信で滞留中＝処理待ち/入金待ち）。残高不足だとここが増える。
  pendingTransferCount: number
  pendingTransferAmount: number
}

/** A1ダッシュボードの集計（本日基準・JST）。 */
export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const todayStart = getTodayJSTStart()
  const activeNonFailed = { notIn: [WithdrawalStatus.FAILED, WithdrawalStatus.CANCELLED] }

  // 未送金（GMO未送信で滞留）: status PENDING/PROCESSING かつ gmo_apply_no 未発行。
  const notYetTransferred = {
    gmo_apply_no: null,
    status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
  }

  const [todayRequests, todaySum, errorCount, stoppedWorkers, pendingTransfer] = await Promise.all([
    prisma.withdrawalRequest.count({ where: { requested_at: { gte: todayStart } } }),
    prisma.withdrawalRequest.aggregate({
      where: { requested_at: { gte: todayStart }, status: activeNonFailed },
      _sum: { requested_amount: true },
    }),
    prisma.withdrawalRequest.count({ where: { requested_at: { gte: todayStart }, status: 'FAILED' } }),
    prisma.advancePaymentPolicy.count({
      where: { active_slot: 'active', OR: [{ is_suspended: true }, { advance_program: 'DISABLED' }] },
    }),
    prisma.withdrawalRequest.aggregate({
      where: notYetTransferred,
      _count: true,
      _sum: { transfer_amount: true },
    }),
  ])

  return {
    todayRequests,
    errorCount,
    stoppedWorkers,
    totalWithdrawn: todaySum._sum?.requested_amount ?? 0,
    pendingTransferCount: pendingTransfer._count ?? 0,
    pendingTransferAmount: pendingTransfer._sum?.transfer_amount ?? 0,
  }
}

/** A6監査ログ（直近）。hibarai_audit_logs を表示用に整形。 */
export async function getHibaraiAuditLogsForAdmin(limit = 100): Promise<AuditLogItem[]> {
  const logs = await prisma.hibaraiAuditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      created_at: true,
      actor_type: true,
      actor_id: true,
      action: true,
      target_type: true,
      target_id: true,
      ip_address: true,
      result: true,
    },
  })
  return logs.map((l) => ({
    id: l.id,
    timestamp: l.created_at.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    actor: `${l.actor_type}${l.actor_id ? ` #${l.actor_id}` : ''}`,
    action: l.action,
    target: `${l.target_type ?? ''}${l.target_id ? ` ${l.target_id}` : ''}`.trim() || '-',
    ipAddress: l.ip_address ?? '-',
    result: mapAuditResult(l.result),
    type: mapAuditType(l.action),
  }))
}
