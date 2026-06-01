// 日払い運用監視（PROCESSING滞留・組戻不成立26・UNKNOWN監査頻度）。
// 'use server' にしない（Server Componentから呼ぶ。公開アクションにしない）。
import { WithdrawalStatus } from '@prisma/client'
import prisma from '@/lib/prisma'

export type AgeBucket = { label: string; maxHours: number | null }

/** 滞留の年齢区分（純粋）。順番が前のバケットから順に「maxHours以下」で振り分け、null=上限なし(catch-all)。 */
export const DEFAULT_AGE_BUCKETS: AgeBucket[] = [
  { label: '〜1時間', maxHours: 1 },
  { label: '1〜6時間', maxHours: 6 },
  { label: '6〜24時間', maxHours: 24 },
  { label: '24時間超', maxHours: null },
]

/** 2点間の差を時間(hour)で返す（純粋）。 */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60)
}

/**
 * 年齢(hour)の配列をバケットに振り分け、各バケットの件数を返す（純粋）。
 * 前から順に maxHours 以下なら該当バケットへ。null は catch-all。負値は最初のバケット(保守的)。
 */
export function bucketAges(agesInHours: number[], buckets: AgeBucket[]): Array<{ label: string; count: number }> {
  const out = buckets.map((b) => ({ label: b.label, count: 0 }))
  for (const age of agesInHours) {
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i]
      if (b.maxHours == null || age <= b.maxHours) {
        out[i].count += 1
        break
      }
    }
  }
  return out
}

export type ProcessingItem = {
  id: string
  workerId: number
  workerName: string
  requestedAmount: number
  requestedAt: Date
  ageHours: number
  hasApplyNo: boolean
  gmoApplyNo: string | null
  gmoStatusCode: number | null
  gmoStatusName: string | null
  lastPolledAt: Date | null
}

export type MonitoringSummary = {
  generatedAt: Date
  processing: {
    total: number
    // 銀行処理中（GMO受理済み・applyNoあり）の年齢分布
    withApplyNo: { total: number; buckets: Array<{ label: string; count: number }> }
    // 未送信（処理待ち・applyNo未発行）の年齢分布。残高不足時はここが増える
    withoutApplyNo: { total: number; buckets: Array<{ label: string; count: number }> }
    // 古い順 top N（運用が個別調査する用）
    oldest: ProcessingItem[]
  }
  /** 組戻不成立(26): 資金が受取人側に残り、要手動対応の累計件数 */
  recallFailedCount: number
  /** 直近24時間の WITHDRAWAL_SUBMIT_UNKNOWN 監査件数（GMO応答不明）。多発はGMO/構成異常のサイン */
  submitUnknownLast24h: number
}

const OLDEST_LIMIT = 10

/** A7 監視ビュー: 集計結果を返す。 */
export async function getMonitoringSummary(now: Date = new Date()): Promise<MonitoringSummary> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [processing, recallFailedCount, submitUnknownLast24h] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where: { status: WithdrawalStatus.PROCESSING },
      orderBy: { requested_at: 'asc' },
      select: {
        id: true,
        worker_id: true,
        requested_amount: true,
        requested_at: true,
        gmo_apply_no: true,
        gmo_transfer_status_code: true,
        gmo_transfer_status_name: true,
        last_polled_at: true,
        worker: { select: { name: true } },
      },
    }),
    prisma.withdrawalRequest.count({
      where: { gmo_transfer_status_code: 26 },
    }),
    prisma.hibaraiAuditLog.count({
      where: { action: 'WITHDRAWAL_SUBMIT_UNKNOWN', created_at: { gte: dayAgo } },
    }),
  ])

  const items: ProcessingItem[] = processing.map((w) => ({
    id: w.id,
    workerId: w.worker_id,
    workerName: w.worker?.name ?? `ID:${w.worker_id}`,
    requestedAmount: w.requested_amount,
    requestedAt: w.requested_at,
    ageHours: hoursBetween(w.requested_at, now),
    hasApplyNo: w.gmo_apply_no != null,
    gmoApplyNo: w.gmo_apply_no,
    gmoStatusCode: w.gmo_transfer_status_code,
    gmoStatusName: w.gmo_transfer_status_name,
    lastPolledAt: w.last_polled_at,
  }))

  const withApplyNo = items.filter((i) => i.hasApplyNo)
  const withoutApplyNo = items.filter((i) => !i.hasApplyNo)

  return {
    generatedAt: now,
    processing: {
      total: items.length,
      withApplyNo: {
        total: withApplyNo.length,
        buckets: bucketAges(withApplyNo.map((i) => i.ageHours), DEFAULT_AGE_BUCKETS),
      },
      withoutApplyNo: {
        total: withoutApplyNo.length,
        buckets: bucketAges(withoutApplyNo.map((i) => i.ageHours), DEFAULT_AGE_BUCKETS),
      },
      // 古い順上位（requested_at asc で取ってきているので先頭が古い）
      oldest: items.slice(0, OLDEST_LIMIT),
    },
    recallFailedCount,
    submitUnknownLast24h,
  }
}
