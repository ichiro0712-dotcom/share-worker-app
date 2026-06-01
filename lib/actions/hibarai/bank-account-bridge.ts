// User の銀行情報（プロフィール由来の平文/暗号化フィールド）を、日払いが読む BankAccount テーブルへ
// 同期する「橋渡し」。日払いの安全ロジック(送信前の口座変更検知・cooldown・未認証ブロック)は
// BankAccount の構造化フィールド(isVerified/lastChangedAt/cooldownUntil)に依存しているため、
// User → BankAccount の片方向同期で集約する。
// 'use server' にしない（公開アクションにしない。プロフィール保存やバックフィルから呼ぶ）。
import { AccountType, type Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { readStoredAccountNumber } from './account-encryption'

/** User側の銀行関連フィールド（プロフィールに保存される平文/暗号化された値）。 */
export type UserBankSnapshot = {
  bank_code: string | null
  bank_name: string | null
  branch_code: string | null
  branch_name: string | null
  account_name: string | null // 姓名カナから自動生成された口座名義
  account_number: string | null // 暗号化済み or 平文（readStoredAccountNumberで両対応）
}

/** BankAccount upsert 用ペイロード（既存BankAccount.accountNumberは平文のまま運用）。 */
export type BankAccountSyncPayload = {
  bankCode: string
  bankName: string
  branchCode: string
  branchName: string
  accountType: AccountType
  accountNumber: string
  accountHolderName: string
  accountHolderNameKana: string
}

/** User平文の銀行情報からBankAccount同期用ペイロードを構築（純粋）。必須欠落でnull（同期しない）。 */
export function buildBankAccountSyncPayload(user: UserBankSnapshot): BankAccountSyncPayload | null {
  const accountNumber = readStoredAccountNumber(user.account_number)
  if (!user.bank_code) return null
  if (!user.branch_code) return null
  if (!accountNumber) return null
  if (!user.account_name) return null
  return {
    bankCode: user.bank_code,
    bankName: user.bank_name ?? '',
    branchCode: user.branch_code,
    branchName: user.branch_name ?? '',
    accountType: AccountType.ORDINARY,
    accountNumber,
    accountHolderName: user.account_name,
    accountHolderNameKana: user.account_name,
  }
}

/** 既存BankAccountと新ペイロードで「識別フィールド」が変化したかを判定（純粋）。
 *  bankName/branchName(表示名)は識別外（先方の名称変更等で lastChangedAt を誤更新しないため）。 */
export function didBankIdentityChange(
  prev: {
    bankCode: string
    branchCode: string
    accountNumber: string
    accountHolderName: string
    accountHolderNameKana: string | null
    accountType: AccountType
  } | null,
  next: BankAccountSyncPayload,
): boolean {
  if (!prev) return true
  return (
    prev.bankCode !== next.bankCode ||
    prev.branchCode !== next.branchCode ||
    prev.accountNumber !== next.accountNumber ||
    prev.accountHolderName !== next.accountHolderName ||
    (prev.accountHolderNameKana ?? '') !== next.accountHolderNameKana ||
    prev.accountType !== next.accountType
  )
}

/**
 * User平文 → BankAccount へ同期（upsert）。
 * - 必須欠落（口座未登録など）は no-op（既存BankAccountも触らない）。
 * - 識別フィールド（bankCode/branchCode/accountNumber/accountHolderName/Kana/accountType）が変化したときのみ
 *   lastChangedAt を更新（withdrawal送信前の口座変更検知に使われる）。
 * - 新規作成時は isVerified=true（GMOに事前照合APIが無いため登録=検証扱い。実検証は初回振込で）。
 * - 表示名(bankName/branchName)は常に同期。
 */
export async function syncBankAccountFromUser(
  userId: number,
  user: UserBankSnapshot,
  opts: { tx?: Prisma.TransactionClient; updatedByType?: string; updatedById?: number } = {},
): Promise<{ synced: boolean; changed: boolean }> {
  const payload = buildBankAccountSyncPayload(user)
  if (!payload) return { synced: false, changed: false }

  const db = opts.tx ?? prisma
  const existing = await db.bankAccount.findUnique({
    where: { userId },
    select: {
      bankCode: true,
      branchCode: true,
      accountNumber: true,
      accountHolderName: true,
      accountHolderNameKana: true,
      accountType: true,
    },
  })
  const changed = didBankIdentityChange(existing, payload)
  const now = new Date()

  await db.bankAccount.upsert({
    where: { userId },
    create: {
      userId,
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      branchCode: payload.branchCode,
      branchName: payload.branchName,
      accountType: payload.accountType,
      accountNumber: payload.accountNumber,
      accountHolderName: payload.accountHolderName,
      accountHolderNameKana: payload.accountHolderNameKana,
      isVerified: true,
      lastChangedAt: now,
      updatedByType: opts.updatedByType ?? 'SYSTEM',
      updatedById: opts.updatedById,
    },
    update: {
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      branchCode: payload.branchCode,
      branchName: payload.branchName,
      accountType: payload.accountType,
      accountNumber: payload.accountNumber,
      accountHolderName: payload.accountHolderName,
      accountHolderNameKana: payload.accountHolderNameKana,
      // 識別フィールドが変わったときだけ lastChangedAt 更新（既存ロジックの誤発火を避ける）
      ...(changed ? { lastChangedAt: now } : {}),
      updatedByType: opts.updatedByType,
      updatedById: opts.updatedById,
    },
  })
  return { synced: true, changed }
}

/**
 * ワーカー単位で「銀行口座編集」と「出金作成」をシリアライズするための pg advisory lock キー。
 * プロフィール口座編集 tx と createWithdrawalRequest tx の両方が同じキーを取ることで、
 * 「編集 と 新規出金作成 の並行発生」によるW3/W4ガード回避(TOCTOU)を排除する。
 * 既存のphoneロック等と衝突しないよう、上位32bitに名前空間マーカーを立てる。
 */
export function workerBankLockKey(workerId: number): bigint {
  // 名前空間: 'HBLk' (Hibarai Bank Lock) を上位32bitに配置。下位32bitに workerId。
  // BigIntコンストラクタはアンダースコア区切りに非対応のため数値リテラル経由で生成。
  const NS = BigInt(0x48424c6b) // 'H' 'B' 'L' 'k'
  return (NS << BigInt(32)) | BigInt(workerId)
}

/** ワーカーに進行中(PENDING/PROCESSING)の出金があるか。W3/W4編集ブロックの判定用。 */
export async function hasActiveWithdrawal(userId: number): Promise<boolean> {
  const count = await prisma.withdrawalRequest.count({
    where: { worker_id: userId, status: { in: ['PENDING', 'PROCESSING'] } },
  })
  return count > 0
}

/** 銀行関連フィールドが変更されようとしているかを判定（純粋）。同期不要ケースの判別＋W3/W4ガードに使う。 */
export function didUserBankFieldsChange(prev: UserBankSnapshot, next: UserBankSnapshot): boolean {
  // account_number は両方とも保存形式(暗号化/平文)で比較すると毎回違う暗号文で誤検出するため、復号して比較
  const prevAcc = readStoredAccountNumber(prev.account_number)
  const nextAcc = readStoredAccountNumber(next.account_number)
  return (
    (prev.bank_code ?? '') !== (next.bank_code ?? '') ||
    (prev.branch_code ?? '') !== (next.branch_code ?? '') ||
    (prevAcc ?? '') !== (nextAcc ?? '') ||
    (prev.account_name ?? '') !== (next.account_name ?? '')
  )
}
