import { z } from 'zod'
import { TransferStatusCodeSchema } from './types'

export const TRANSFER_STATUS_CODES = {
  REQUESTING: 2,
  REJECTED: 3,
  WITHDRAWN: 4,
  EXPIRED: 5,
  CANCELLED_APPROVAL: 8,
  RESERVED: 11,
  PROCESSING: 12,
  RETRYING: 13,
  COMPLETED: 20,
  REPAID: 22,
  REFUND_PROCESSING: 24,
  REFUNDED: 25,
  REFUND_FAILED: 26,
  FAILED: 40,
} as const

export type TransferStatusCode = z.infer<typeof TransferStatusCodeSchema>

export const USER_FACING_STATUS_TEXT: Record<TransferStatusCode, string> = {
  2: '受け取り申請を確認しています',
  3: '申請が差し戻されました',
  4: '受け取り申請を取り下げました',
  5: '受け取り申請の期限が切れました',
  8: '受け取り予約を取り消しました',
  11: '受け取りを予約しました',
  12: '銀行で確認中です',
  13: '再試行しています',
  20: '振込完了',
  22: '資金が戻りました。口座をご確認ください',
  24: '組戻し中です',
  25: '組戻しが完了しました',
  26: '組戻しが成立しませんでした',
  40: '口座を確認できませんでした',
}

export const ADMIN_STATUS_INFO: Record<
  TransferStatusCode,
  { name: string; severity: 'info' | 'warning' | 'error' | 'success' }
> = {
  2: { name: '申請中', severity: 'info' },
  3: { name: '差戻', severity: 'warning' },
  4: { name: '取下げ', severity: 'warning' },
  5: { name: '期限切れ', severity: 'warning' },
  8: { name: '承認取消/予約取消', severity: 'warning' },
  11: { name: '予約中', severity: 'info' },
  12: { name: '手続中', severity: 'info' },
  13: { name: 'リトライ中', severity: 'warning' },
  20: { name: '手続済', severity: 'success' },
  22: { name: '資金返却', severity: 'error' },
  24: { name: '組戻手続中', severity: 'warning' },
  25: { name: '組戻済', severity: 'error' },
  26: { name: '組戻不成立', severity: 'error' },
  40: { name: '手続不成立', severity: 'error' },
}

const TERMINAL_STATUSES = new Set<number>([20, 22, 25, 26, 40, 3, 4, 5, 8])
const FAILURE_STATUSES = new Set<number>([3, 4, 5, 8, 22, 25, 26, 40])

/**
 * 残高を復元してよい失敗終端状態（＝資金が受取人側に渡っていない、または確実に戻った状態）。
 * 3:差戻 4:取下げ 5:期限切れ 8:承認取消 = 送金前に終了（資金未流出）
 * 22:資金返却 25:組戻済 = 資金が確実に戻った
 * 40:手続不成立 = 送金不成立（資金未流出）
 *
 * ⚠ 26:組戻不成立 は**除外**する。組戻し(recall)が成立せず資金は受取人側に残っているため、
 *   残高を復元すると再出金で二重支払い（運営者損失）になる。26は別途、送金済み扱い＋手動調査とする。
 */
const BALANCE_RESTORABLE_FAILURE_STATUSES = new Set<number>([3, 4, 5, 8, 22, 25, 40])

/**
 * GMO振込ステータスが以後変化しない終端状態かを判定する。
 */
export const isTerminalStatus = (code: number): boolean => TERMINAL_STATUSES.has(code)

/**
 * GMO振込ステータスが成功完了かを判定する。
 */
export const isSuccessStatus = (code: number): boolean => code === TRANSFER_STATUS_CODES.COMPLETED

/**
 * GMO振込ステータスが失敗または要対応の終端状態かを判定する。
 */
export const isFailureStatus = (code: number): boolean => FAILURE_STATUSES.has(code)

/**
 * 残高を復元してよい失敗終端状態か（資金が受取人に渡っていない/確実に戻った）。
 * 26:組戻不成立 は false（資金が戻っていないため復元すると二重支払いになる）。
 */
export const isBalanceRestorableFailureStatus = (code: number): boolean =>
  BALANCE_RESTORABLE_FAILURE_STATUSES.has(code)

/**
 * ユーザー表示用の振込ステータス文言を返す。
 */
export function getUserFacingStatusText(code: number): string {
  return USER_FACING_STATUS_TEXT[code as TransferStatusCode] ?? '振込状況を確認しています'
}

/**
 * 管理画面表示用の振込ステータス情報を返す。
 */
export function getAdminStatusInfo(code: number): { name: string; severity: 'info' | 'warning' | 'error' | 'success' } {
  return ADMIN_STATUS_INFO[code as TransferStatusCode] ?? { name: `不明(${code})`, severity: 'warning' }
}
