'use server'

import { Prisma, type HibaraiAuditActorType } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { createHibaraiAuditLog, recordHibaraiAudit } from './audit'
import { getErrorMessage, isUniqueConstraintError, toJSTDateOnly, toJSTSettlementMonthStart } from './utils'

const DEFAULT_RATE_BASIS_POINTS = 9000
const ADJUSTMENT_SOURCE_TYPE = 'AttendanceWageAdjustment'

export type ReconcileActor = {
  type: HibaraiAuditActorType
  id: string
  /** 何がreconcileを起動したか (review_submitted | modification_approved | system_admin_edit) */
  trigger: string
}

/**
 * 勤怠1件の日払いチャージ状態を冪等にreconcileする（同一トランザクション内で実行）。
 *
 * - 前提(CHECKED_OUT + calculated_wage>0 + ワーカーレビュー提出済 + 修正申請未処理なし)未達 → 何もしない
 * - 前提達成 & 未チャージ → ATTENDANCE_CONFIRMED を作成（初回チャージ）
 * - 前提達成 & チャージ済 → 現wageの目標advanceableと現在の実効advanceableの差をMANUAL_ADJUSTMENTで記録
 *
 * 差分(delta)ベースなので何度呼んでも収束する（wage不変ならdelta=0でno-op）。
 * balance行のFOR UPDATEロックで同一ワーカーのreconcileを直列化する。
 */
export async function reconcileHibaraiChargeInTx(
  tx: Prisma.TransactionClient,
  attendanceId: number,
  actor: ReconcileActor
): Promise<void> {
  if (!isHibaraiEnabled()) return

  const attendance = await tx.attendance.findUnique({
    where: { id: attendanceId },
    select: {
      id: true,
      user_id: true,
      application_id: true,
      job_id: true,
      status: true,
      calculated_wage: true,
      check_in_time: true,
      actual_start_time: true,
      application: { select: { worker_review_status: true } },
      modificationRequest: { select: { status: true } },
    },
  })
  if (!attendance) return

  const workerId = attendance.user_id
  const grossReward = attendance.calculated_wage ?? 0
  const hasPendingModification =
    !!attendance.modificationRequest &&
    ['PENDING', 'RESUBMITTED'].includes(attendance.modificationRequest.status)

  const prerequisitesMet =
    attendance.status === 'CHECKED_OUT' &&
    grossReward > 0 &&
    attendance.application?.worker_review_status === 'COMPLETED' &&
    !hasPendingModification

  // 勤怠行をロックして同一勤怠への並行reconcileを直列化
  await tx.$queryRaw<{ id: number }[]>`SELECT id FROM attendances WHERE id = ${attendanceId} FOR UPDATE`

  const existing = await tx.pointLedgerEntry.findFirst({
    where: { attendance_id: attendanceId, kind: 'ATTENDANCE_CONFIRMED' },
    select: { id: true, rate_basis_points: true, settlement_month: true },
  })

  // 前提未達なら何もしない（未チャージはそのまま、チャージ済は据え置き。
  // 新たな修正申請が入った場合は承認時に再度reconcileされる）
  if (!prerequisitesMet) return

  await tx.pointBalance.upsert({
    where: { worker_id: workerId },
    create: { worker_id: workerId, balance: 0, total_charged: 0, total_withdrawn: 0 },
    update: {},
  })
  const balanceRows = await tx.$queryRaw<{ balance: number }[]>`
    SELECT balance FROM point_balances WHERE worker_id = ${workerId} FOR UPDATE
  `
  if (balanceRows.length === 0) throw new Error('PointBalance not found')
  const currentBalance = balanceRows[0].balance

  const workDate = toJSTDateOnly(attendance.actual_start_time ?? attendance.check_in_time)

  if (!existing) {
    // === 初回チャージ ===
    const settlementMonth = toJSTSettlementMonthStart(attendance.actual_start_time ?? attendance.check_in_time)
    const policy = await tx.advancePaymentPolicy.findFirst({
      where: {
        worker_id: workerId,
        effective_from: { lte: new Date() },
        OR: [{ effective_to: null }, { effective_to: { gt: new Date() } }],
      },
      orderBy: { effective_from: 'desc' },
    })
    // 日払い(HIBARAI)以外のプログラム(LEGACY_CARRYBARAI/DISABLED)はチャージしない
    if (policy && policy.advance_program !== 'HIBARAI') return
    const rate = policy?.rate_basis_points ?? DEFAULT_RATE_BASIS_POINTS
    const advanceable = Math.floor((grossReward * rate) / 10000)
    const scheduledPayment = grossReward - advanceable
    const idempotencyKey = `attendance-${attendanceId}-confirmed`

    await tx.pointLedgerEntry.create({
      data: {
        worker_id: workerId,
        attendance_id: attendanceId,
        application_id: attendance.application_id,
        job_id: attendance.job_id,
        kind: 'ATTENDANCE_CONFIRMED',
        delta: advanceable,
        balance_after: currentBalance + advanceable,
        idempotency_key: idempotencyKey,
        gross_reward_amount: grossReward,
        advanceable_amount: advanceable,
        scheduled_payment_amount: scheduledPayment,
        rate_basis_points: rate,
        work_date: workDate,
        settlement_month: settlementMonth,
        note: `Auto-charged on reconcile (trigger=${actor.trigger})`,
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
      actorType: actor.type,
      actorId: actor.id,
      action: 'ATTENDANCE_CONFIRMED',
      targetType: 'Attendance',
      targetId: String(attendanceId),
      idempotencyKey,
      payload: {
        grossReward,
        advanceable,
        scheduledPayment,
        rateBasisPoints: rate,
        trigger: actor.trigger,
      } as Prisma.InputJsonValue,
      result: 'SUCCESS',
    })
    return
  }

  // === 差額調整（チャージ済の勤怠のwageが変わった）===
  // 率は原チャージ時の保存値を使う。null は migration ガードで排除済みだが、
  // 万一 null なら誤った率で残高を動かさず明示的に失敗させる。
  if (existing.rate_basis_points == null) {
    throw new Error(`ATTENDANCE_CONFIRMED ledger missing rate_basis_points (attendance ${attendanceId})`)
  }
  const rate = existing.rate_basis_points
  // 精算月は初回チャージで確定。勤務日が後から月跨ぎ修正されても動かさない
  // （月バケットの分裂を防ぐ。勤怠の精算サイクルは初回チャージ時に固定）。
  const settlementMonth = existing.settlement_month ?? toJSTSettlementMonthStart(attendance.actual_start_time ?? attendance.check_in_time)
  const targetAdvanceable = Math.floor((grossReward * rate) / 10000)
  const targetScheduled = grossReward - targetAdvanceable

  // この勤怠に紐づく現在の実効値（チャージ + 本機能の調整のみ。他用途のMANUAL_ADJUSTMENTは除外）
  const agg = await tx.pointLedgerEntry.aggregate({
    where: {
      attendance_id: attendanceId,
      OR: [
        { kind: 'ATTENDANCE_CONFIRMED' },
        { kind: 'MANUAL_ADJUSTMENT', source_type: ADJUSTMENT_SOURCE_TYPE },
      ],
    },
    _sum: { delta: true, scheduled_payment_amount: true, gross_reward_amount: true },
  })
  const currentAdvanceable = agg._sum.delta ?? 0
  const currentScheduled = agg._sum.scheduled_payment_amount ?? 0
  const currentGross = agg._sum.gross_reward_amount ?? 0
  const advanceableDelta = targetAdvanceable - currentAdvanceable
  const scheduledDelta = targetScheduled - currentScheduled
  const grossDelta = grossReward - currentGross

  if (advanceableDelta === 0 && scheduledDelta === 0 && grossDelta === 0) return

  const seq = await tx.pointLedgerEntry.count({
    where: {
      attendance_id: attendanceId,
      kind: 'MANUAL_ADJUSTMENT',
      source_type: ADJUSTMENT_SOURCE_TYPE,
    },
  })
  const idempotencyKey = `adjust-attendance-${attendanceId}-${seq + 1}`

  await tx.pointLedgerEntry.create({
    data: {
      worker_id: workerId,
      attendance_id: attendanceId,
      application_id: attendance.application_id,
      job_id: attendance.job_id,
      kind: 'MANUAL_ADJUSTMENT',
      delta: advanceableDelta,
      balance_after: currentBalance + advanceableDelta,
      idempotency_key: idempotencyKey,
      source_type: ADJUSTMENT_SOURCE_TYPE,
      // gross/advanceable/scheduled はすべて差分(delta)として記録（SUMで現在の絶対値に一致する）
      gross_reward_amount: grossDelta,
      advanceable_amount: advanceableDelta,
      scheduled_payment_amount: scheduledDelta,
      rate_basis_points: rate,
      work_date: workDate,
      settlement_month: settlementMonth,
      note: `Wage change adjustment (trigger=${actor.trigger})`,
    },
  })
  // balanceのみ更新する（total_charged/total_withdrawnはrecomputeBalanceの定義に合わせ触らない）
  if (advanceableDelta > 0) {
    await tx.pointBalance.update({
      where: { worker_id: workerId },
      data: { balance: { increment: advanceableDelta } },
    })
  } else if (advanceableDelta < 0) {
    await tx.pointBalance.update({
      where: { worker_id: workerId },
      data: { balance: { decrement: -advanceableDelta } },
    })
  }
  await createHibaraiAuditLog(tx, {
    actorType: actor.type,
    actorId: actor.id,
    action: 'ATTENDANCE_WAGE_ADJUSTED',
    targetType: 'Attendance',
    targetId: String(attendanceId),
    idempotencyKey,
    payload: {
      grossReward,
      targetAdvanceable,
      advanceableDelta,
      scheduledDelta,
      rateBasisPoints: rate,
      trigger: actor.trigger,
    } as Prisma.InputJsonValue,
    result: 'SUCCESS',
  })
}

/**
 * 独自トランザクションでreconcileを実行する（既存txの外から呼ぶ用）。
 */
export async function reconcileHibaraiCharge(attendanceId: number, actor: ReconcileActor): Promise<void> {
  if (!isHibaraiEnabled()) return
  try {
    await prisma.$transaction((tx) => reconcileHibaraiChargeInTx(tx, attendanceId, actor), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) return
    await recordHibaraiAudit({
      actorType: actor.type,
      actorId: actor.id,
      action: 'ATTENDANCE_RECONCILE_FAILED',
      targetType: 'Attendance',
      targetId: String(attendanceId),
      payload: { trigger: actor.trigger } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
    }).catch(() => {})
    throw new Error(getErrorMessage(error))
  }
}

/**
 * レビュー提出時のチャージ起動（既存の呼び出し元互換）。
 * applicationId+workerId から勤怠を解決し、独自txでreconcileする。
 */
export async function chargePointsOnReviewSubmitted(applicationId: number, workerId: number): Promise<void> {
  if (!isHibaraiEnabled()) return
  const attendance = await prisma.attendance.findFirst({
    where: { application_id: applicationId, user_id: workerId },
    select: { id: true },
  })
  if (!attendance) return
  await reconcileHibaraiCharge(attendance.id, {
    type: 'WORKER',
    id: String(workerId),
    trigger: 'review_submitted',
  })
}
