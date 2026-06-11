// User の銀行情報（プロフィール由来の平文/暗号化フィールド）を、日払いが読む BankAccount テーブルへ
// 同期する「橋渡し」。日払いの安全ロジック(送信前の口座変更検知・cooldown・未認証ブロック)は
// BankAccount の構造化フィールド(isVerified/lastChangedAt/cooldownUntil)に依存しているため、
// User → BankAccount の片方向同期で集約する。
// 'use server' にしない（公開アクションにしない。プロフィール保存やバックフィルから呼ぶ）。
import { AccountType, BankAccountKind, type Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { convertYuchoToZengin, isYuchoBankCode, YUCHO_BANK_CODE } from '@/lib/bank/yucho'
import { readStoredAccountNumber } from './account-encryption'

/** User側の銀行関連フィールド（プロフィールに保存される平文/暗号化された値）。 */
export type UserBankSnapshot = {
  bank_code: string | null
  bank_name: string | null
  branch_code: string | null
  branch_name: string | null
  account_name: string | null // 姓名カナから自動生成された口座名義
  account_number: string | null // 暗号化済み or 平文（readStoredAccountNumberで両対応）
  // ゆうちょ対応（任意。未指定は従来の全銀口座として扱う）。記号・番号は原本（暗号化 or 平文）。
  bank_account_kind?: BankAccountKind | null
  yucho_symbol?: string | null
  yucho_number?: string | null
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
  // ゆうちょ: 種別と記号・番号の原本（平文。BankAccount.accountNumber同様に平文運用）。全銀はZENGIN/null。
  bankAccountKind: BankAccountKind
  yuchoSymbol: string | null
  yuchoNumber: string | null
}

/** ゆうちょ口座か（kind=YUCHO もしくは銀行コード9900）。 */
function isYuchoUser(user: UserBankSnapshot): boolean {
  return user.bank_account_kind === BankAccountKind.YUCHO || isYuchoBankCode(user.bank_code)
}

/** 口座種別を正規化（既存行の null は従来の全銀=ZENGIN と等価に扱う。変更検知の誤発火防止）。 */
function normalizeKind(kind: BankAccountKind | null | undefined): BankAccountKind {
  return kind === BankAccountKind.YUCHO ? BankAccountKind.YUCHO : BankAccountKind.ZENGIN
}

/** User平文の銀行情報からBankAccount同期用ペイロードを構築（純粋）。必須欠落でnull（同期しない）。 */
export function buildBankAccountSyncPayload(user: UserBankSnapshot): BankAccountSyncPayload | null {
  if (!user.account_name) return null

  // ゆうちょ: 記号・番号(原本)から全銀の店番・口座番号へ変換して同期する。
  if (isYuchoUser(user)) {
    const symbol = readStoredAccountNumber(user.yucho_symbol)
    const number = readStoredAccountNumber(user.yucho_number)
    if (!symbol || !number) return null
    const conv = convertYuchoToZengin(symbol, number)
    if (!conv.ok) {
      // 変換不能(振替口座/桁数不正)。同期しない（GMOへ不正な振込先を作らない）。
      console.warn('[bank-account-bridge] ゆうちょ記号・番号の変換に失敗したため同期をスキップ')
      return null
    }
    return {
      bankCode: YUCHO_BANK_CODE,
      bankName: user.bank_name ?? 'ゆうちょ銀行',
      branchCode: conv.branchCode,
      branchName: user.branch_name ?? '',
      // Phase1の変換は通常貯金=普通のみ（振替口座は convertYuchoToZengin が弾く）。
      accountType: AccountType.ORDINARY,
      accountNumber: conv.accountNumber,
      accountHolderName: user.account_name,
      accountHolderNameKana: user.account_name,
      bankAccountKind: BankAccountKind.YUCHO,
      yuchoSymbol: symbol,
      yuchoNumber: number,
    }
  }

  // 全銀（従来）
  const accountNumber = readStoredAccountNumber(user.account_number)
  if (!user.bank_code) return null
  if (!user.branch_code) return null
  if (!accountNumber) return null
  // 全銀フォーマットの口座番号は最大7桁(数字)。BankAccount.accountNumber は VarChar(7) のため、
  // 8桁(ゆうちょの番号をそのまま入れた等)や非数字をそのまま upsert すると
  // "value too long for the column's type" でプロフィール保存tx全体がrollbackする(PROFILE_UPDATE_FAILED)。
  // ここで弾いて同期しない(no-op)。
  if (!/^\d{1,7}$/.test(accountNumber)) {
    console.warn('[bank-account-bridge] 全銀に収まらない口座番号のため同期をスキップ（桁数/形式不正の可能性）')
    return null
  }
  return {
    bankCode: user.bank_code,
    bankName: user.bank_name ?? '',
    branchCode: user.branch_code,
    branchName: user.branch_name ?? '',
    accountType: AccountType.ORDINARY,
    accountNumber,
    accountHolderName: user.account_name,
    accountHolderNameKana: user.account_name,
    bankAccountKind: BankAccountKind.ZENGIN,
    yuchoSymbol: null,
    yuchoNumber: null,
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
    bankAccountKind?: BankAccountKind | null
    yuchoSymbol?: string | null
    yuchoNumber?: string | null
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
    prev.accountType !== next.accountType ||
    // ゆうちょ: 記号・番号(原本)の変更も識別変化として扱う。
    // 異なる記号・番号が同じ全銀口座番号へ変換され得るため、原本比較でないと変更を取りこぼす。
    (prev.yuchoSymbol ?? '') !== (next.yuchoSymbol ?? '') ||
    (prev.yuchoNumber ?? '') !== (next.yuchoNumber ?? '')
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
      bankAccountKind: true,
      yuchoSymbol: true,
      yuchoNumber: true,
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
      bankAccountKind: payload.bankAccountKind,
      yuchoSymbol: payload.yuchoSymbol,
      yuchoNumber: payload.yuchoNumber,
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
      bankAccountKind: payload.bankAccountKind,
      yuchoSymbol: payload.yuchoSymbol,
      yuchoNumber: payload.yuchoNumber,
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
  // ゆうちょの記号・番号も同様に復号して比較（原本が変われば送金先が変わる）。
  const prevSym = readStoredAccountNumber(prev.yucho_symbol ?? null)
  const nextSym = readStoredAccountNumber(next.yucho_symbol ?? null)
  const prevNum = readStoredAccountNumber(prev.yucho_number ?? null)
  const nextNum = readStoredAccountNumber(next.yucho_number ?? null)
  return (
    (prev.bank_code ?? '') !== (next.bank_code ?? '') ||
    (prev.branch_code ?? '') !== (next.branch_code ?? '') ||
    (prevAcc ?? '') !== (nextAcc ?? '') ||
    (prev.account_name ?? '') !== (next.account_name ?? '') ||
    // 既存行(null)と新規保存(ZENGIN)を誤って「変更」と判定しないよう正規化して比較。
    normalizeKind(prev.bank_account_kind) !== normalizeKind(next.bank_account_kind) ||
    (prevSym ?? '') !== (nextSym ?? '') ||
    (prevNum ?? '') !== (nextNum ?? '')
  )
}
