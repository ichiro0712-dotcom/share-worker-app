// 手動残高調整（運用者がワーカーの残高を理由付きで補正する）。
// 'use server' にしない（公開アクションは manual-adjustment-action.ts のみ。プリミティブは非公開）。
// 残高を直接動かす金銭センシティブな操作のため:
//   理由必須・上限・冪等(race-clean)・FOR UPDATEロック・台帳=サマリ整合性チェック・監査ログ必須。
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { createHibaraiAuditLog } from './audit'
import { getJSTSettlementMonthStart } from './utils'

/** 1回の調整額の上限（誤入力対策）。これを超える補正は複数回に分ける運用とする。 */
export const MAX_ADJUSTMENT_JPY = 1_000_000
/** 理由の最低文字数（意味のある理由を強制）。 */
export const MIN_REASON_LENGTH = 5
/** 理由の最大文字数（巨大入力でのDB/監査ペイロード肥大を防ぐ）。 */
export const MAX_REASON_LENGTH = 1000
/** 残高計算と区別するための source_type。勤怠修正差額(AttendanceWageAdjustment)とは別。 */
export const MANUAL_ADJUSTMENT_SOURCE_TYPE = 'AdminManualAdjustment'

/** 同一キーで内容の異なる調整が既存のときに投げる（キー衝突＝バグの兆候）。 */
export class IdempotencyConflictError extends Error {
  constructor(message = '同じリクエストIDで内容の異なる調整が既に存在します') {
    super(message)
    this.name = 'IdempotencyConflictError'
  }
}

export type ManualAdjustmentInput = {
  workerId: number
  amount: number
  reason: string
}

export type ValidationResult = { ok: true } | { ok: false; error: string }

/** 入力の事前検証（純粋）。残高がマイナスになるかはDBの現在値が要るためtx内で判定する。 */
export function validateAdjustment(input: ManualAdjustmentInput): ValidationResult {
  if (!Number.isInteger(input.workerId) || input.workerId <= 0) {
    return { ok: false, error: 'ワーカーIDが不正です' }
  }
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    return { ok: false, error: '金額は0以外の整数で指定してください' }
  }
  if (Math.abs(input.amount) > MAX_ADJUSTMENT_JPY) {
    return { ok: false, error: `1回の調整は ±${MAX_ADJUSTMENT_JPY.toLocaleString('ja-JP')}円 までです` }
  }
  const reasonLen = input.reason.trim().length
  if (reasonLen < MIN_REASON_LENGTH) {
    return { ok: false, error: `理由を${MIN_REASON_LENGTH}文字以上で入力してください` }
  }
  if (reasonLen > MAX_REASON_LENGTH) {
    return { ok: false, error: `理由は${MAX_REASON_LENGTH}文字以内で入力してください` }
  }
  return { ok: true }
}

export type ManualAdjustmentResult = {
  ledgerId: string
  balanceBefore: number
  balanceAfter: number
  applied: boolean
}

type ExistingLedger = { id: string; delta: number; balance_after: number; worker_id: number }

/** 既存台帳が今回の意図と一致するか検証（不一致はキー衝突＝conflict）。 */
function assertIdempotentMatch(existing: ExistingLedger, workerId: number, amount: number): void {
  if (existing.worker_id !== workerId || existing.delta !== amount) {
    throw new IdempotencyConflictError()
  }
}

function toReplayResult(existing: ExistingLedger): ManualAdjustmentResult {
  return {
    ledgerId: existing.id,
    balanceBefore: existing.balance_after - existing.delta,
    balanceAfter: existing.balance_after,
    applied: false,
  }
}

// 競合系エラー: P2002=unique違反(同キー挿入が先行), P2034=書込競合/シリアライズ失敗。
// 同キーの二重送信では、loser側がこのどちらで落ちても「適用済みなのに失敗表示」にしないため両方拾う。
const CONFLICT_ERROR_CODES = new Set(['P2002', 'P2034'])
function isConflictError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && CONFLICT_ERROR_CODES.has(error.code)
}

/**
 * 残高を手動調整する（プリミティブ・非公開）。
 * - 理由・上限・workerIdを検証
 * - point_balances を FOR UPDATE でロックし、サマリ残高 == 台帳SUM(delta) の整合性を確認
 *   （事前にドリフトがある場合は調整を拒否し、破損の上塗りを防ぐ）
 * - 結果がマイナスになる調整は拒否（債務記録はこのツールの対象外＝経理側で未確定のため）
 * - idempotencyKey で二重適用を防止。事前checkに加え、競合(P2002)時も既存を読み直して
 *   no-op(applied:false)に解決する（「適用済みなのに失敗表示」を避ける）
 * - MANUAL_ADJUSTMENT 台帳 + 監査ログ(MANUAL_BALANCE_ADJUSTED) を同一トランザクションで記録
 */
export async function applyManualAdjustment(args: {
  workerId: number
  amount: number
  reason: string
  adminId: number
  idempotencyKey: string
}): Promise<ManualAdjustmentResult> {
  const validation = validateAdjustment({ workerId: args.workerId, amount: args.amount, reason: args.reason })
  if (!validation.ok) throw new Error(validation.error)
  if (!args.idempotencyKey) throw new Error('idempotencyKey is required')

  const reason = args.reason.trim()
  const settlementMonth = getJSTSettlementMonthStart()

  try {
    return await prisma.$transaction(
      async (tx) => {
        // 既に同じキーで適用済みなら no-op（二重送信対策・fast path）
        const existing = await tx.pointLedgerEntry.findUnique({
          where: { idempotency_key: args.idempotencyKey },
          select: { id: true, delta: true, balance_after: true, worker_id: true },
        })
        if (existing) {
          assertIdempotentMatch(existing, args.workerId, args.amount)
          return toReplayResult(existing)
        }

        await tx.pointBalance.upsert({
          where: { worker_id: args.workerId },
          create: { worker_id: args.workerId, balance: 0, total_charged: 0, total_withdrawn: 0 },
          update: {},
        })
        const locked = await tx.$queryRaw<{ balance: number }[]>`
          SELECT balance FROM point_balances WHERE worker_id = ${args.workerId} FOR UPDATE
        `
        if (locked.length === 0) throw new Error('PointBalance not found')
        const balanceBefore = locked[0].balance

        // 整合性チェック: サマリ残高 == 台帳合計。ドリフトがあれば調整を拒否し原因調査に回す。
        const sum = await tx.pointLedgerEntry.aggregate({
          where: { worker_id: args.workerId },
          _sum: { delta: true },
        })
        const ledgerSum = sum._sum.delta ?? 0
        if (ledgerSum !== balanceBefore) {
          throw new Error(
            `残高サマリ(¥${balanceBefore.toLocaleString('ja-JP')})と台帳合計(¥${ledgerSum.toLocaleString('ja-JP')})が不一致です。調整前に整合性の確認が必要です`,
          )
        }

        const balanceAfter = balanceBefore + args.amount
        if (balanceAfter < 0) {
          throw new Error(
            `調整後の残高がマイナス(${balanceAfter.toLocaleString('ja-JP')}円)になります。現在残高は${balanceBefore.toLocaleString('ja-JP')}円です`,
          )
        }

        const ledger = await tx.pointLedgerEntry.create({
          data: {
            worker_id: args.workerId,
            kind: 'MANUAL_ADJUSTMENT',
            delta: args.amount,
            balance_after: balanceAfter,
            idempotency_key: args.idempotencyKey,
            source_type: MANUAL_ADJUSTMENT_SOURCE_TYPE,
            settlement_month: settlementMonth,
            note: reason,
            created_by_admin_id: args.adminId,
          },
          select: { id: true },
        })

        await tx.pointBalance.update({
          where: { worker_id: args.workerId },
          data: { balance: balanceAfter },
        })

        await createHibaraiAuditLog(tx, {
          actorType: 'SYSTEM_ADMIN',
          actorId: String(args.adminId),
          action: 'MANUAL_BALANCE_ADJUSTED',
          targetType: 'PointBalance',
          targetId: String(args.workerId),
          idempotencyKey: `manual-adj-${args.idempotencyKey}`,
          payload: {
            workerId: args.workerId,
            delta: args.amount,
            balanceBefore,
            balanceAfter,
            reason,
            ledgerId: ledger.id,
            sourceType: MANUAL_ADJUSTMENT_SOURCE_TYPE,
            idempotencyKey: args.idempotencyKey,
          } as Prisma.InputJsonValue,
          result: 'SUCCESS',
        })

        return { ledgerId: ledger.id, balanceBefore, balanceAfter, applied: true }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 },
    )
  } catch (error) {
    // 競合する二重送信(unique違反/シリアライズ失敗): 同キーが先に適用済みなら、失敗表示せず
    // 既存を読み直して no-op 解決する。別オペレーションの競合(同キーの台帳なし)はそのまま再送可能エラー。
    if (isConflictError(error)) {
      const existing = await prisma.pointLedgerEntry.findUnique({
        where: { idempotency_key: args.idempotencyKey },
        select: { id: true, delta: true, balance_after: true, worker_id: true },
      })
      if (existing) {
        assertIdempotentMatch(existing, args.workerId, args.amount)
        return toReplayResult(existing)
      }
    }
    throw error
  }
}
