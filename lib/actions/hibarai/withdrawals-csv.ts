// 振込履歴(A5)のCSV生成（純粋・'use server'にしない）。
// CSVインジェクション(数式注入)対策＋カンマ/改行/引用のエスケープを行う。
import type { AdminWithdrawalRow } from './admin-withdrawals'

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '完了',
  PROCESSING: '銀行処理中',
  PENDING: '受付済み',
  DRAFT: '下書き',
  FAILED: '失敗',
  REFUNDED: '返金',
  CANCELLED: 'キャンセル',
}

/** DB状態(raw)を日本語ラベルへ。未知はそのまま返す（純粋）。 */
export function withdrawalStatusLabel(raw: string): string {
  return STATUS_LABEL[raw] ?? raw
}

/**
 * CSVの1セルをエスケープする（純粋）。
 * - 数式起点文字(= + - @ TAB CR)で始まる値は先頭に ' を付与（Exc/Sheetsの数式注入対策）
 * - カンマ・改行・ダブルクォートを含む場合は引用し、" は "" に二重化
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

const HEADERS = [
  '申請ID',
  'ワーカーID',
  'ワーカー名',
  '申請額',
  '手数料',
  '振込額',
  'ステータス',
  '申請日時',
  '完了日時',
  '銀行名',
  '口座下4桁',
  'GMO申込番号',
  '精算月',
] as const

/** 振込履歴行をCSV文字列へ（ヘッダ込み・CRLF区切り）。生レスポンスや口座番号全体は含めない。 */
export function buildWithdrawalsCsv(rows: AdminWithdrawalRow[]): string {
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    const cells = [
      r.id,
      r.workerId,
      r.workerName,
      r.requestedAmount,
      r.feeAmount,
      r.transferAmount,
      withdrawalStatusLabel(r.rawStatus),
      r.requestedAt,
      r.completedAt ?? '',
      r.bankName,
      r.accountLast4,
      r.gmoApplyNo ?? '',
      r.settlementMonth,
    ]
    lines.push(cells.map(escapeCsvField).join(','))
  }
  return lines.join('\r\n')
}
