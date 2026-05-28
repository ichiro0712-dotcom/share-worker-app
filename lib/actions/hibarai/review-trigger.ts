'use server'

import { Prisma } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { createHibaraiAuditLog, recordHibaraiAudit } from './audit'
import { getErrorMessage, isUniqueConstraintError } from './utils'

export async function chargePointsOnReviewSubmitted(applicationId: number, workerId: number): Promise<void> {
  if (!isHibaraiEnabled()) return

  const attendance = await prisma.attendance.findFirst({
    where: { application_id: applicationId, user_id: workerId },
    select: {
      id: true,
      application_id: true,
      job_id: true,
      calculated_wage: true,
      check_in_time: true,
      actual_start_time: true,
    },
  })
  if (!attendance) return

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM attendances WHERE id = ${attendance.id} FOR UPDATE
        `
        await tx.pointBalance.upsert({
          where: { worker_id: workerId },
          create: { worker_id: workerId, balance: 0, total_charged: 0, total_withdrawn: 0 },
          update: {},
        })
        const balanceRows = await tx.$queryRaw<{ balance: number }[]>`
          SELECT balance FROM point_balances WHERE worker_id = ${workerId} FOR UPDATE
        `
        if (balanceRows.length === 0) throw new Error('PointBalance not found')

        const existing = await tx.pointLedgerEntry.findFirst({
          where: { attendance_id: attendance.id, kind: 'ATTENDANCE_CONFIRMED' },
          select: { id: true },
        })
        if (existing) {
          await createHibaraiAuditLog(tx, {
            actorType: 'WORKER',
            actorId: String(workerId),
            action: 'ATTENDANCE_CHARGE_SKIPPED',
            targetType: 'Attendance',
            targetId: String(attendance.id),
            idempotencyKey: `attendance-${attendance.id}-confirmed`,
            payload: { applicationId, reason: 'already charged' } as Prisma.InputJsonValue,
            result: 'SUCCESS',
          })
          return
        }

        const now = new Date()
        const policy = await tx.advancePaymentPolicy.findFirst({
          where: {
            worker_id: workerId,
            effective_from: { lte: now },
            OR: [{ effective_to: null }, { effective_to: { gt: now } }],
          },
          orderBy: { effective_from: 'desc' },
        })
        const rate = policy?.rate_basis_points ?? 9000
        const grossReward = attendance.calculated_wage ?? 0
        if (grossReward <= 0) return

        const advanceable = Math.floor(grossReward * rate / 10000)
        const scheduledPayment = grossReward - advanceable
        const workDate = attendance.actual_start_time ?? attendance.check_in_time
        const settlementMonth = new Date(workDate.getFullYear(), workDate.getMonth(), 1)
        const nextBalance = balanceRows[0].balance + advanceable
        const idempotencyKey = `attendance-${attendance.id}-confirmed`

        await tx.pointLedgerEntry.create({
          data: {
            worker_id: workerId,
            attendance_id: attendance.id,
            application_id: applicationId,
            job_id: attendance.job_id,
            kind: 'ATTENDANCE_CONFIRMED',
            delta: advanceable,
            balance_after: nextBalance,
            idempotency_key: idempotencyKey,
            gross_reward_amount: grossReward,
            advanceable_amount: advanceable,
            scheduled_payment_amount: scheduledPayment,
            work_date: workDate,
            settlement_month: settlementMonth,
            note: 'Auto-charged on review submission',
          },
        })
        await tx.pointBalance.update({
          where: { worker_id: workerId },
          data: {
            balance: { increment: advanceable },
            total_charged: { increment: advanceable },
          },
        })
        await createHibaraiAuditLog(tx, {
          actorType: 'WORKER',
          actorId: String(workerId),
          action: 'ATTENDANCE_CONFIRMED',
          targetType: 'Attendance',
          targetId: String(attendance.id),
          idempotencyKey,
          payload: {
            applicationId,
            grossReward,
            advanceable,
            scheduledPayment,
            rateBasisPoints: rate,
          } as Prisma.InputJsonValue,
          result: 'SUCCESS',
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) return
    await recordHibaraiAudit({
      actorType: 'WORKER',
      actorId: String(workerId),
      action: 'ATTENDANCE_CHARGE_FAILED',
      targetType: 'Attendance',
      targetId: String(attendance.id),
      idempotencyKey: `attendance-${attendance.id}-confirmed`,
      payload: { applicationId } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
    }).catch(() => {})
    throw new Error(getErrorMessage(error))
  }
}
