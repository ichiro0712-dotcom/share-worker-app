'use server'

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

export async function releaseEmergencyStop(adminId: number, approverId: number, reason: string): Promise<void> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')
  if (adminId === approverId) throw new Error('Two-person approval is required')

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
            released_by_admin_id: approverId,
          },
        })
        await createHibaraiAuditLog(tx, {
          actorType: 'SYSTEM_ADMIN',
          actorId: String(adminId),
          action: 'EMERGENCY_STOP_RELEASED',
          targetType: 'EmergencyStopState',
          targetId: 'global',
          idempotencyKey: `emergency-release-${Date.now()}`,
          payload: { reason, approverId } as Prisma.InputJsonValue,
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
      payload: { reason, approverId } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: getErrorMessage(error).slice(0, 100),
    }).catch(() => {})
    throw error
  }
}
