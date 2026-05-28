// 'use server' にしない（adminId を引数で受ける停止/解除を公開アクションとして露出させない）。
// 公開アクションは認証付きの emergency-stop-action.ts のみ。
import { Prisma } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { createHibaraiAuditLog, recordHibaraiAudit } from './audit'
import { getErrorMessage } from './utils'

export async function triggerEmergencyStop(adminId: number, reason: string): Promise<void> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.emergencyStopState.upsert({
          where: { id: 'global' },
          create: {
            id: 'global',
            is_stopped: true,
            stopped_at: new Date(),
            stopped_by_admin_id: adminId,
            stopped_reason: reason,
          },
          update: {},
        })
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM emergency_stop_states WHERE id = 'global' FOR UPDATE
        `
        await tx.emergencyStopState.update({
          where: { id: 'global' },
          data: {
            is_stopped: true,
            stopped_at: new Date(),
            stopped_by_admin_id: adminId,
            stopped_reason: reason,
          },
        })
        await createHibaraiAuditLog(tx, {
          actorType: 'SYSTEM_ADMIN',
          actorId: String(adminId),
          action: 'EMERGENCY_STOP_TRIGGERED',
          targetType: 'EmergencyStopState',
          targetId: 'global',
          idempotencyKey: `emergency-stop-${Date.now()}`,
          payload: { reason } as Prisma.InputJsonValue,
          result: 'SUCCESS',
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }
    )
  } catch (error) {
    await recordHibaraiAudit({
      actorType: 'SYSTEM_ADMIN',
      actorId: String(adminId),
      action: 'EMERGENCY_STOP_TRIGGER_FAILED',
      targetType: 'EmergencyStopState',
      targetId: 'global',
      payload: { reason } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: getErrorMessage(error).slice(0, 100),
    }).catch(() => {})
    throw error
  }
}

// 解除は単独可（二者承認なし）。誰が・いつ・なぜ解除したかは監査ログに必ず残す。
export async function releaseEmergencyStop(adminId: number, reason: string): Promise<void> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.emergencyStopState.upsert({
          where: { id: 'global' },
          create: { id: 'global', is_stopped: false },
          update: {},
        })
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM emergency_stop_states WHERE id = 'global' FOR UPDATE
        `
        await tx.emergencyStopState.update({
          where: { id: 'global' },
          data: {
            is_stopped: false,
            released_at: new Date(),
            released_by_admin_id: adminId,
          },
        })
        await createHibaraiAuditLog(tx, {
          actorType: 'SYSTEM_ADMIN',
          actorId: String(adminId),
          action: 'EMERGENCY_STOP_RELEASED',
          targetType: 'EmergencyStopState',
          targetId: 'global',
          idempotencyKey: `emergency-release-${Date.now()}`,
          payload: { reason } as Prisma.InputJsonValue,
          result: 'SUCCESS',
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }
    )
  } catch (error) {
    await recordHibaraiAudit({
      actorType: 'SYSTEM_ADMIN',
      actorId: String(adminId),
      action: 'EMERGENCY_STOP_RELEASE_FAILED',
      targetType: 'EmergencyStopState',
      targetId: 'global',
      payload: { reason } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: getErrorMessage(error).slice(0, 100),
    }).catch(() => {})
    throw error
  }
}

export type EmergencyStopStateView = {
  isStopped: boolean
  stoppedAt: Date | null
  stoppedReason: string | null
  releasedAt: Date | null
}

/** 現在の緊急停止状態を取得する。 */
export async function getEmergencyStopState(): Promise<EmergencyStopStateView> {
  const s = await prisma.emergencyStopState.findUnique({ where: { id: 'global' } })
  return {
    isStopped: s?.is_stopped ?? false,
    stoppedAt: s?.stopped_at ?? null,
    stoppedReason: s?.stopped_reason ?? null,
    releasedAt: s?.released_at ?? null,
  }
}

export type EmergencyStopHistoryItem = {
  action: 'EMERGENCY_STOP_TRIGGERED' | 'EMERGENCY_STOP_RELEASED' | string
  actorId: string | null
  at: Date
  reason: string | null
}

/** 停止/解除の操作履歴を監査ログから取得する。 */
export async function getEmergencyStopHistory(limit = 10): Promise<EmergencyStopHistoryItem[]> {
  const logs = await prisma.hibaraiAuditLog.findMany({
    where: { action: { in: ['EMERGENCY_STOP_TRIGGERED', 'EMERGENCY_STOP_RELEASED'] } },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { action: true, actor_id: true, created_at: true, payload: true },
  })
  return logs.map((l) => {
    const payload = (l.payload ?? {}) as { reason?: unknown }
    return {
      action: l.action,
      actorId: l.actor_id,
      at: l.created_at,
      reason: typeof payload.reason === 'string' ? payload.reason : null,
    }
  })
}
