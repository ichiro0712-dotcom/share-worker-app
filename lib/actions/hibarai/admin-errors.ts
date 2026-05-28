// 管理者向け 出金エラー対応キュー(A3) の読み取り。
// 'use server' にしない（Server Component から呼ぶ純粋なサーバー関数。公開アクションにはしない）。
// 失敗(FAILED/REFUNDED)に加え、GMO組戻不成立(26)＝資金が受取人側に残ったまま COMPLETED 扱いに
// なる高リスク行も対応キューに含める（要手動調査）。読み取り専用。
// 注: 対応状態は現状すべて「未対応(new)」。in_progress/waiting_worker/resolved は運用ワークフロー列が
//     未実装のため導出できない。再処理/保留/完了扱いの操作も別機能（Server Action＋列追加）として未実装。
import { Prisma, WithdrawalStatus } from '@prisma/client'
import type { AdminErrorStatus, HibaraiErrorItem } from '@/lib/dummy-data/hibarai'
import prisma from '@/lib/prisma'
import { getAdminStatusInfo } from '@/lib/gmo-aozora/transfer-status'

/** GMO組戻不成立。送金済み(COMPLETED)で永続化されるが資金が戻っておらず要手動対応。 */
const GMO_RECALL_FAILED_CODE = 26

/**
 * 対応キューに表示する出金の抽出条件。
 * FAILED/REFUNDED に加え、gmo_transfer_status_code=26（組戻不成立・COMPLETED永続）を必ず含める。
 */
export const ERROR_QUEUE_WHERE: Prisma.WithdrawalRequestWhereInput = {
  OR: [
    { status: { in: [WithdrawalStatus.FAILED, WithdrawalStatus.REFUNDED] } },
    { gmo_transfer_status_code: GMO_RECALL_FAILED_CODE },
  ],
}

/** GMO状態コード/名称・error_code からエラー種別ラベルを導出（純粋）。生レスポンスは使わない。 */
export function deriveErrorType(input: {
  gmoStatusCode: number | null
  gmoStatusName: string | null
  errorCode: string | null
}): string {
  if (input.gmoStatusCode != null) return getAdminStatusInfo(input.gmoStatusCode).name
  if (input.gmoStatusName) return input.gmoStatusName
  if (input.errorCode) return input.errorCode
  return '振込エラー'
}

/** 出金IDの末尾6桁から安定したサポートコードを生成（純粋・PIIなし）。 */
export function buildSupportCode(id: string): string {
  return `HB-${id.slice(-6).toUpperCase()}`
}

function jstDateTime(date: Date): string {
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

export type ErrorSourceRow = {
  id: string
  worker_id: number
  workerName: string | null
  requested_amount: number
  gmo_transfer_status_code: number | null
  gmo_transfer_status_name: string | null
  error_code: string | null
  failed_at: Date | null
  refunded_at: Date | null
  requested_at: Date
}

/** WithdrawalRequest行を表示用 HibaraiErrorItem へ変換（純粋）。 */
export function mapWithdrawalToErrorItem(row: ErrorSourceRow): HibaraiErrorItem {
  // 運用ワークフロー列が無いため対応状態は一律「未対応」。失敗はすべて確認対象とする。
  const status: AdminErrorStatus = 'new'
  return {
    id: row.id,
    workerId: String(row.worker_id),
    workerName: row.workerName ?? `ID:${row.worker_id}`,
    errorType: deriveErrorType({
      gmoStatusCode: row.gmo_transfer_status_code,
      gmoStatusName: row.gmo_transfer_status_name,
      errorCode: row.error_code,
    }),
    amount: row.requested_amount,
    occurredAt: jstDateTime(row.failed_at ?? row.refunded_at ?? row.requested_at),
    status,
    supportCode: buildSupportCode(row.id),
  }
}

/** A3: 失敗・組戻不成立の出金を対応キューとして取得する（申請日時の新しい順）。 */
export async function getHibaraiErrors(limit = 200): Promise<HibaraiErrorItem[]> {
  const rows = await prisma.withdrawalRequest.findMany({
    where: ERROR_QUEUE_WHERE,
    orderBy: { requested_at: 'desc' },
    take: limit,
    select: {
      id: true,
      worker_id: true,
      requested_amount: true,
      gmo_transfer_status_code: true,
      gmo_transfer_status_name: true,
      error_code: true,
      failed_at: true,
      refunded_at: true,
      requested_at: true,
      worker: { select: { name: true } },
    },
  })
  return rows.map((w) =>
    mapWithdrawalToErrorItem({
      id: w.id,
      worker_id: w.worker_id,
      workerName: w.worker?.name ?? null,
      requested_amount: w.requested_amount,
      gmo_transfer_status_code: w.gmo_transfer_status_code,
      gmo_transfer_status_name: w.gmo_transfer_status_name,
      error_code: w.error_code,
      failed_at: w.failed_at,
      refunded_at: w.refunded_at,
      requested_at: w.requested_at,
    }),
  )
}
