// 注意: このモジュールは 'use server' にしない。
// setAdvancePaymentPolicy は adminId を引数で受け取る金銭設定の書込プリミティブのため、
// 公開 Server Action として露出させない（露出すると認証無しで任意 adminId 指定で呼べてしまう）。
// 公開アクションは認証付きの worker-policy-action.ts(saveWorkerPolicy) のみ。
import { Prisma, type AdvanceProgram } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { createHibaraiAuditLog } from './audit'

const ALLOWED_PROGRAMS: readonly AdvanceProgram[] = ['HIBARAI', 'DISABLED', 'LEGACY_CARRYBARAI']

export type SetAdvancePaymentPolicyInput = {
  workerId: number
  /** 前払い率 basis points (0..10000、9000=90%) */
  rateBasisPoints: number
  perRequestLimitAmount: number | null
  dailyLimitAmount: number | null
  monthlyLimitAmount: number | null
  /** 出金一時停止（チャージは継続、出金のみ停止） */
  isSuspended: boolean
  /** HIBARAI=日払い対象 / DISABLED=日払い対象外(チャージ・出金とも不可) / LEGACY_CARRYBARAI */
  advanceProgram: AdvanceProgram
  /** 適用開始日時(JST想定)。省略時は now */
  effectiveFrom?: Date
  /** 変更理由（必須・監査ログに残す） */
  reason: string
}

type PolicySnapshot = {
  rateBasisPoints: number
  isSuspended: boolean
  advanceProgram: string
  perRequestLimitAmount: number | null
  dailyLimitAmount: number | null
  monthlyLimitAmount: number | null
}

/**
 * ワーカーの前払いポリシー（率/上限/停止/プログラム）を版管理で更新する。
 *
 * - 旧 active を無効化(active_slot=null, effective_to, replaced_by_id)してから新 active を作成。
 *   `@@unique(worker_id, active_slot)` を満たすため「旧無効化 → 新作成 → 旧へ版リンク」の順で行う。
 * - 変更は必ず hibarai_audit_logs に記録する（誰が・いつ・before/after・理由）。二者承認は無し。
 */
export async function setAdvancePaymentPolicy(
  input: SetAdvancePaymentPolicyInput,
  adminId: number
): Promise<{ id: string }> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  if (!Number.isInteger(input.rateBasisPoints) || input.rateBasisPoints < 0 || input.rateBasisPoints > 10000) {
    throw new Error('rateBasisPoints must be an integer between 0 and 10000')
  }
  const reason = input.reason?.trim()
  if (!reason) throw new Error('reason is required')
  if (!Number.isInteger(input.workerId) || input.workerId <= 0) {
    throw new Error('invalid workerId')
  }
  if (!ALLOWED_PROGRAMS.includes(input.advanceProgram)) {
    throw new Error('invalid advanceProgram')
  }
  for (const limit of [input.perRequestLimitAmount, input.dailyLimitAmount, input.monthlyLimitAmount]) {
    if (limit != null && (!Number.isSafeInteger(limit) || limit < 0)) {
      throw new Error('limit amounts must be a non-negative safe integer or null')
    }
  }

  const effectiveFrom = input.effectiveFrom ?? new Date()

  return prisma.$transaction(
    async (tx) => {
      const current = await tx.advancePaymentPolicy.findFirst({
        where: { worker_id: input.workerId, active_slot: 'active' },
      })

      // UNIQUE(worker_id, active_slot) を空けるため、新規作成より先に旧を無効化する
      if (current) {
        await tx.advancePaymentPolicy.update({
          where: { id: current.id },
          data: { active_slot: null, effective_to: effectiveFrom },
        })
      }

      const created = await tx.advancePaymentPolicy.create({
        data: {
          worker_id: input.workerId,
          rate_basis_points: input.rateBasisPoints,
          per_request_limit_amount: input.perRequestLimitAmount,
          daily_limit_amount: input.dailyLimitAmount,
          monthly_limit_amount: input.monthlyLimitAmount,
          advance_program: input.advanceProgram,
          is_suspended: input.isSuspended,
          reason,
          effective_from: effectiveFrom,
          created_by_admin_id: adminId,
          active_slot: 'active',
        },
      })

      if (current) {
        await tx.advancePaymentPolicy.update({
          where: { id: current.id },
          data: { replaced_by_id: created.id },
        })
      }

      const before: PolicySnapshot | null = current
        ? {
            rateBasisPoints: current.rate_basis_points,
            isSuspended: current.is_suspended,
            advanceProgram: current.advance_program,
            perRequestLimitAmount: current.per_request_limit_amount,
            dailyLimitAmount: current.daily_limit_amount,
            monthlyLimitAmount: current.monthly_limit_amount,
          }
        : null
      const after: PolicySnapshot = {
        rateBasisPoints: input.rateBasisPoints,
        isSuspended: input.isSuspended,
        advanceProgram: input.advanceProgram,
        perRequestLimitAmount: input.perRequestLimitAmount,
        dailyLimitAmount: input.dailyLimitAmount,
        monthlyLimitAmount: input.monthlyLimitAmount,
      }

      // 監査ログ必須（二者承認は無いので、追跡可能性はここで担保する）
      await createHibaraiAuditLog(tx, {
        actorType: 'SYSTEM_ADMIN',
        actorId: String(adminId),
        action: 'POLICY_UPDATED',
        targetType: 'AdvancePaymentPolicy',
        targetId: created.id,
        payload: {
          workerId: input.workerId,
          before,
          after,
          reason,
          effectiveFrom: effectiveFrom.toISOString(),
        } as Prisma.InputJsonValue,
        result: 'SUCCESS',
      })

      return { id: created.id }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }
  )
}

export type WorkerPolicyView = {
  current: {
    id: string
    rateBasisPoints: number
    perRequestLimitAmount: number | null
    dailyLimitAmount: number | null
    monthlyLimitAmount: number | null
    isSuspended: boolean
    advanceProgram: string
    effectiveFrom: Date
    reason: string
  } | null
  history: Array<{
    id: string
    rateBasisPoints: number
    isSuspended: boolean
    advanceProgram: string
    effectiveFrom: Date
    effectiveTo: Date | null
    reason: string
    createdByAdminId: number
    createdAt: Date
  }>
}

/**
 * 管理画面表示用に、ワーカーの現ポリシーと変更履歴を取得する。
 */
export async function getWorkerPolicyForAdmin(workerId: number): Promise<WorkerPolicyView> {
  if (!isHibaraiEnabled()) throw new Error('Feature disabled')

  const [current, history] = await Promise.all([
    prisma.advancePaymentPolicy.findFirst({
      where: { worker_id: workerId, active_slot: 'active' },
    }),
    prisma.advancePaymentPolicy.findMany({
      where: { worker_id: workerId },
      orderBy: { effective_from: 'desc' },
      take: 20,
    }),
  ])

  return {
    current: current
      ? {
          id: current.id,
          rateBasisPoints: current.rate_basis_points,
          perRequestLimitAmount: current.per_request_limit_amount,
          dailyLimitAmount: current.daily_limit_amount,
          monthlyLimitAmount: current.monthly_limit_amount,
          isSuspended: current.is_suspended,
          advanceProgram: current.advance_program,
          effectiveFrom: current.effective_from,
          reason: current.reason,
        }
      : null,
    history: history.map((p) => ({
      id: p.id,
      rateBasisPoints: p.rate_basis_points,
      isSuspended: p.is_suspended,
      advanceProgram: p.advance_program,
      effectiveFrom: p.effective_from,
      effectiveTo: p.effective_to,
      reason: p.reason,
      createdByAdminId: p.created_by_admin_id,
      createdAt: p.created_at,
    })),
  }
}
