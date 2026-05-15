'use server'

/**
 * チャット表 (advisor_chat_tables) の共有 URL 関連 Server Action
 *
 * 既存のレポート共有 (src/lib/advisor/actions/report-versions.ts) と同じ設計:
 * - トークンを knowing 制で公開 (URL を知っていれば誰でも閲覧可)
 * - デフォルト 30 日有効
 * - 期限切れは cron (advisor-cleanup) で token を null 化
 */

import { randomBytes } from 'node:crypto'
import { requireAdvisorAuth } from '@/src/lib/advisor/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/src/lib/advisor/persistence/audit'

const SHARE_DURATION_DAYS = 30
const SHARE_DURATION_MS = SHARE_DURATION_DAYS * 24 * 60 * 60 * 1000

export interface TableShareState {
  shared: boolean
  token: string | null
  sharedUntil: string | null
  expired: boolean
}

async function fetchTableForOwner(tableDbId: number, adminId: number) {
  return prisma.advisorChatTable.findFirst({
    where: { id: tableDbId, created_by_id: adminId },
  })
}

/**
 * 表の現在の共有状態を取得。
 */
export async function getTableShareState(
  tableDbId: number
): Promise<{ ok: true; state: TableShareState } | { ok: false; reason: string }> {
  const auth = await requireAdvisorAuth()
  const t = await fetchTableForOwner(tableDbId, auth.adminId)
  if (!t) return { ok: false, reason: '表が見つからない、または権限がありません' }

  const now = Date.now()
  const expired =
    !!t.shared_at && !!t.shared_until && t.shared_until.getTime() < now
  const shared = !!t.shared_at && !!t.shared_until && !expired

  return {
    ok: true,
    state: {
      shared,
      token: shared ? t.share_token : null,
      sharedUntil: t.shared_until?.toISOString() ?? null,
      expired,
    },
  }
}

/**
 * 表の共有 URL を有効化 (まだ無ければ token 発行)。
 */
export async function enableTableShare(
  tableDbId: number
): Promise<
  | { ok: true; token: string; sharedUntil: string }
  | { ok: false; reason: string }
> {
  const auth = await requireAdvisorAuth()
  const t = await fetchTableForOwner(tableDbId, auth.adminId)
  if (!t) return { ok: false, reason: '表が見つからない、または権限がありません' }

  const now = Date.now()
  const stillValid =
    t.share_token &&
    t.shared_at &&
    t.shared_until &&
    t.shared_until.getTime() > now
  if (stillValid && t.share_token && t.shared_until) {
    return {
      ok: true,
      token: t.share_token,
      sharedUntil: t.shared_until.toISOString(),
    }
  }

  // 衝突対策で 5 回までリトライ
  let token: string | null = null
  let attempts = 0
  while (!token && attempts < 5) {
    const candidate = randomBytes(24).toString('base64url')
    const existing = await prisma.advisorChatTable.findUnique({
      where: { share_token: candidate },
    })
    if (!existing) token = candidate
    attempts++
  }
  if (!token) return { ok: false, reason: 'トークン発行に失敗しました' }

  const newUntil = new Date(now + SHARE_DURATION_MS)
  await prisma.advisorChatTable.update({
    where: { id: tableDbId },
    data: {
      share_token: token,
      shared_at: new Date(now),
      shared_until: newUntil,
    },
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: t.session_id,
    eventType: 'chat_response',
    payload: {
      kind: 'chat_table_share_enabled',
      tableId: tableDbId,
      sharedUntil: newUntil.toISOString(),
    },
  })

  return { ok: true, token, sharedUntil: newUntil.toISOString() }
}

/**
 * 表の共有 URL を停止 (token は記録のため残す)。
 */
export async function disableTableShare(
  tableDbId: number
): Promise<{ ok: boolean; reason?: string }> {
  const auth = await requireAdvisorAuth()
  const t = await fetchTableForOwner(tableDbId, auth.adminId)
  if (!t) return { ok: false, reason: '表が見つからない、または権限がありません' }

  await prisma.advisorChatTable.update({
    where: { id: tableDbId },
    data: { shared_at: null, shared_until: null },
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: t.session_id,
    eventType: 'chat_response',
    payload: {
      kind: 'chat_table_share_disabled',
      tableId: tableDbId,
    },
  })

  return { ok: true }
}

/**
 * 公開ページ用: token から表データを取得 (認証不要)。
 * 期限切れや停止中は null を返す。
 */
export async function getSharedTableByToken(token: string): Promise<
  | {
      tableId: string
      purpose: string
      columns: Array<{ key: string; label: string; type?: string }>
      rows: unknown[][]
      rowCount: number
      truncated: boolean
      createdAt: string
      sharedUntil: string
    }
  | null
> {
  const t = await prisma.advisorChatTable.findUnique({
    where: { share_token: token },
  })
  if (!t) return null
  if (!t.shared_at || !t.shared_until) return null
  if (t.shared_until.getTime() < Date.now()) return null

  return {
    tableId: `T-${String(t.id).padStart(3, '0')}`,
    purpose: t.purpose,
    columns: t.columns as unknown as Array<{
      key: string
      label: string
      type?: string
    }>,
    rows: t.rows as unknown as unknown[][],
    rowCount: t.row_count,
    truncated: t.truncated,
    createdAt: t.created_at.toISOString(),
    sharedUntil: t.shared_until.toISOString(),
  }
}
