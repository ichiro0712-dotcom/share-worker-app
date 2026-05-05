'use server'

/**
 * レポートバージョン操作の Server Actions (P1-3 / P1-9)
 *
 * - listVersionsForSession: Canvas のバージョン切替ドロップダウン用
 * - getVersionDetail: 個別バージョン取得 (履歴一覧 → 個別画面で使う)
 * - lockEditing / releaseEditing: 手動編集モードのロック制御
 * - saveManualEdit: 手動編集を新バージョンとして保存
 * - deleteVersion: 個別削除 (admin 操作)
 *
 * 全て System Admin 認証必須。所有者チェックは Draft.admin_id で判定。
 */

import { requireAdvisorAuth } from '../auth'
import { getDraftBySession, getDraftById } from '../persistence/report-drafts'
import {
  acquireEditingLock,
  releaseEditingLock,
  createReportVersion,
  buildDraftSnapshot,
  listVersionsByDraft,
  getVersionById,
  deleteVersion as deleteVersionRow,
  listAllVersionsForAdmin,
  type ReportVersionRow,
  type ReportVersionSource,
} from '../persistence/report-versions'
import { recordAudit } from '../persistence/audit'

export interface ClientVersionSummary {
  id: string
  versionNumber: number
  source: ReportVersionSource
  resultModel: string
  createdAt: string
  parentVersionId: string | null
  // 編集ロック (current admin 自身が持っている場合のみ true、他 admin の場合は別フィールドで知らせる)
  lockedByMe: boolean
  lockedByOther: boolean
}

export interface ClientVersionDetail extends ClientVersionSummary {
  draftId: string
  resultMarkdown: string
  draftSnapshot: {
    title: string | null
    goal: string | null
    dataSources: string[]
    metricKeys: string[]
    rangeStart: string | null
    rangeEnd: string | null
    outline: string | null
    notes: string | null
  }
  generatedMs: number | null
  inputTokens: number | null
  outputTokens: number | null
}

function toSummary(v: ReportVersionRow, currentAdminId: number): ClientVersionSummary {
  const lockedByMe = !!v.editingLockAdminId && v.editingLockAdminId === currentAdminId
  const lockedByOther = !!v.editingLockAdminId && v.editingLockAdminId !== currentAdminId
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    source: v.source,
    resultModel: v.resultModel,
    createdAt: v.createdAt,
    parentVersionId: v.parentVersionId,
    lockedByMe,
    lockedByOther,
  }
}

function toDetail(
  v: ReportVersionRow,
  currentAdminId: number,
  draftId: string
): ClientVersionDetail {
  return {
    ...toSummary(v, currentAdminId),
    draftId,
    resultMarkdown: v.resultMarkdown,
    draftSnapshot: v.draftSnapshot,
    generatedMs: v.generatedMs,
    inputTokens: v.inputTokens,
    outputTokens: v.outputTokens,
  }
}

/**
 * セッション ID からそのセッションのバージョン一覧を取得 (Canvas 用)。
 */
export async function listVersionsForSession(
  sessionId: string
): Promise<ClientVersionSummary[]> {
  const auth = await requireAdvisorAuth()
  if (!sessionId) return []
  const draft = await getDraftBySession(sessionId)
  if (!draft || draft.adminId !== auth.adminId) return []
  const versions = await listVersionsByDraft(draft.id)
  return versions.map((v) => toSummary(v, auth.adminId))
}

/**
 * 個別バージョン取得。所有者チェックあり。
 */
export async function getVersionDetail(
  versionId: string
): Promise<ClientVersionDetail | null> {
  const auth = await requireAdvisorAuth()
  if (!versionId) return null
  const v = await getVersionById(versionId)
  if (!v) return null
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) return null
  return toDetail(v, auth.adminId, draft.id)
}

/**
 * 編集ロック取得。
 */
export async function lockEditing(
  versionId: string
): Promise<{ ok: true; version: ClientVersionSummary } | { ok: false; reason: string }> {
  const auth = await requireAdvisorAuth()
  const v = await getVersionById(versionId)
  if (!v) return { ok: false, reason: 'バージョンが存在しません' }
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: 'このバージョンを編集する権限がありません' }
  }
  const result = await acquireEditingLock({ versionId, adminId: auth.adminId })
  if (!result.ok) return result
  return { ok: true, version: toSummary(result.version, auth.adminId) }
}

export async function releaseEditing(versionId: string): Promise<{ ok: boolean }> {
  const auth = await requireAdvisorAuth()
  await releaseEditingLock({ versionId, adminId: auth.adminId })
  return { ok: true }
}

/**
 * 手動編集の結果を新バージョンとして保存 (α-2 方針)。
 */
export async function saveManualEdit(input: {
  parentVersionId: string
  newMarkdown: string
}): Promise<
  | { ok: true; version: ClientVersionSummary }
  | { ok: false; reason: string }
> {
  const auth = await requireAdvisorAuth()
  if (!input.parentVersionId) return { ok: false, reason: 'parentVersionId が必要です' }
  if (!input.newMarkdown || input.newMarkdown.trim().length === 0) {
    return { ok: false, reason: '本文が空です' }
  }
  if (input.newMarkdown.length > 200_000) {
    return { ok: false, reason: '本文が大きすぎます (200,000 文字超)' }
  }

  const parent = await getVersionById(input.parentVersionId)
  if (!parent) return { ok: false, reason: '元バージョンが存在しません' }
  const draft = await getDraftById(parent.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: 'このバージョンを編集する権限がありません' }
  }

  // ロック確認: 現在 admin が保有している、または誰も保有していない (5分タイムアウト後) ならOK
  if (parent.editingLockAdminId && parent.editingLockAdminId !== auth.adminId) {
    return { ok: false, reason: '別の管理者が編集中です' }
  }

  const newVersion = await createReportVersion({
    draftId: parent.draftId,
    resultMarkdown: input.newMarkdown,
    resultModel: 'manual',
    draftSnapshot: buildDraftSnapshot(draft),
    source: 'manual_edit',
    parentVersionId: parent.id,
    inputTokens: null,
    outputTokens: null,
    generatedMs: null,
  })

  // ロックは解放
  await releaseEditingLock({ versionId: parent.id, adminId: auth.adminId })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: draft.sessionId,
    eventType: 'chat_response',
    payload: {
      kind: 'report_manual_edit',
      draftId: draft.id,
      parentVersionId: parent.id,
      newVersionId: newVersion.id,
      newVersionNumber: newVersion.versionNumber,
      length: input.newMarkdown.length,
    },
  })

  return { ok: true, version: toSummary(newVersion, auth.adminId) }
}

/**
 * 個別バージョン削除 (履歴一覧画面の admin 操作)。
 */
export async function deleteVersion(
  versionId: string
): Promise<{ ok: boolean; reason?: string }> {
  const auth = await requireAdvisorAuth()
  const v = await getVersionById(versionId)
  if (!v) return { ok: false, reason: 'バージョンが存在しません' }
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: '権限がありません' }
  }
  await deleteVersionRow(versionId)
  await recordAudit({
    adminId: auth.adminId,
    sessionId: draft.sessionId,
    eventType: 'chat_response',
    payload: {
      kind: 'report_version_deleted',
      versionId,
      versionNumber: v.versionNumber,
    },
  })
  return { ok: true }
}

/**
 * admin 横断のレポート履歴一覧 (P1-3 履歴一覧画面用)。
 */
export interface ClientHistoryRow {
  id: string
  versionNumber: number
  source: ReportVersionSource
  createdAt: string
  draftId: string
  sessionId: string
  title: string | null
  rangeStart: string | null
  rangeEnd: string | null
  /** 本文の長さ (chars) — 一覧で全文を持ちたくないので長さだけ返す */
  resultLength: number
  /** セッションのしおり状態 (true なら永続保存) */
  bookmarked: boolean
  /** セッションの updated_at (しおりなしの場合の削除予定日計算に使う) */
  sessionUpdatedAt: string
}

export async function listReportHistory(input?: {
  searchTitle?: string
  limit?: number
  offset?: number
  sortBy?: 'created_desc' | 'bookmark_first'
}): Promise<{ rows: ClientHistoryRow[]; total: number }> {
  const auth = await requireAdvisorAuth()
  const result = await listAllVersionsForAdmin({
    adminId: auth.adminId,
    searchTitle: input?.searchTitle,
    limit: input?.limit,
    offset: input?.offset,
    sortBy: input?.sortBy,
  })
  const rows: ClientHistoryRow[] = result.rows.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    source: v.source,
    createdAt: v.createdAt,
    draftId: v.draftId,
    sessionId: v.sessionId,
    title: v.title ?? v.draftSnapshot.title,
    rangeStart: v.draftSnapshot.rangeStart,
    rangeEnd: v.draftSnapshot.rangeEnd,
    resultLength: v.resultMarkdown.length,
    bookmarked: v.bookmarked,
    sessionUpdatedAt: v.sessionUpdatedAt,
  }))
  return { rows, total: result.total }
}

const SHARE_DURATION_DAYS = 30
const SHARE_DURATION_MS = SHARE_DURATION_DAYS * 24 * 60 * 60 * 1000

/**
 * レポート共有 URL の現状取得 (Canvas で「シェア中か / 残日数」を表示するため)。
 * - shared = true かつ未失効: token + sharedUntil を返す
 * - shared_until が過ぎている場合は shared = false (= 期限切れ表示)
 */
export async function getShareState(
  versionId: string
): Promise<
  | { ok: true; shared: boolean; token: string | null; sharedUntil: string | null; expired: boolean }
  | { ok: false; reason: string }
> {
  const auth = await requireAdvisorAuth()
  const v = await getVersionById(versionId)
  if (!v) return { ok: false, reason: 'バージョンが存在しません' }
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: '権限がありません' }
  }
  const now = Date.now()
  const expired = !!v.sharedAt && !!v.sharedUntil && new Date(v.sharedUntil).getTime() < now
  const shared = !!v.sharedAt && !!v.sharedUntil && !expired
  return {
    ok: true,
    shared,
    token: shared ? v.shareToken : null,
    sharedUntil: v.sharedUntil,
    expired,
  }
}

/**
 * レポート共有 URL を有効化する (まだ token が無ければ発行)。
 * URL を知っている人なら誰でもアクセス可能になる。
 * デフォルトで 30 日間有効、期限切れ時は再発行 (extendShare) で延長可能。
 */
export async function enableShare(
  versionId: string
): Promise<{ ok: true; token: string; sharedUntil: string } | { ok: false; reason: string }> {
  const auth = await requireAdvisorAuth()
  const v = await getVersionById(versionId)
  if (!v) return { ok: false, reason: 'バージョンが存在しません' }
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: '権限がありません' }
  }

  const now = Date.now()
  const stillValid =
    v.shareToken && v.sharedAt && v.sharedUntil &&
    new Date(v.sharedUntil).getTime() > now

  // まだ未失効ならそのまま返す
  if (stillValid && v.shareToken && v.sharedUntil) {
    return { ok: true, token: v.shareToken, sharedUntil: v.sharedUntil }
  }

  // token 未発行 or 停止中 or 失効中 → 必要なら新規発行 + shared_at/shared_until を更新
  const { prisma } = await import('@/lib/prisma')
  const { randomBytes } = await import('node:crypto')

  // token 衝突対策で 5 回までリトライ (既存の token があれば再利用しても良いが、
  // 失効後の再有効化では token を新しくする方がプライバシー的に安全)
  let token: string | null = null
  let attempts = 0
  while (!token && attempts < 5) {
    const candidate = randomBytes(24).toString('base64url')
    try {
      const existing = await prisma.advisorReportVersion.findUnique({
        where: { share_token: candidate },
      })
      if (!existing) token = candidate
    } catch {
      // ignore, retry
    }
    attempts++
  }
  if (!token) return { ok: false, reason: 'トークン発行に失敗しました' }

  const newUntil = new Date(now + SHARE_DURATION_MS)
  await prisma.advisorReportVersion.update({
    where: { id: versionId },
    data: { share_token: token, shared_at: new Date(now), shared_until: newUntil },
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: draft.sessionId,
    eventType: 'chat_response',
    payload: {
      kind: 'report_share_enabled',
      versionId,
      versionNumber: v.versionNumber,
      sharedUntil: newUntil.toISOString(),
    },
  })

  return { ok: true, token, sharedUntil: newUntil.toISOString() }
}

/**
 * 共有 URL の有効期限を延長 (今から +30 日)。token は維持する。
 * 失効済みでも有効化中でも、押せば確実に「あと 30 日」になる。
 */
export async function extendShare(
  versionId: string
): Promise<{ ok: true; sharedUntil: string } | { ok: false; reason: string }> {
  const auth = await requireAdvisorAuth()
  const v = await getVersionById(versionId)
  if (!v) return { ok: false, reason: 'バージョンが存在しません' }
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: '権限がありません' }
  }
  if (!v.shareToken) {
    return { ok: false, reason: 'シェアが有効化されていません (先に有効化してください)' }
  }

  const { prisma } = await import('@/lib/prisma')
  const newUntil = new Date(Date.now() + SHARE_DURATION_MS)
  await prisma.advisorReportVersion.update({
    where: { id: versionId },
    data: { shared_at: v.sharedAt ? new Date(v.sharedAt) : new Date(), shared_until: newUntil },
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: draft.sessionId,
    eventType: 'chat_response',
    payload: {
      kind: 'report_share_extended',
      versionId,
      versionNumber: v.versionNumber,
      sharedUntil: newUntil.toISOString(),
    },
  })

  return { ok: true, sharedUntil: newUntil.toISOString() }
}

/**
 * レポート共有 URL を停止する (shared_at = null)。token は記録のため残す。
 */
export async function disableShare(
  versionId: string
): Promise<{ ok: boolean; reason?: string }> {
  const auth = await requireAdvisorAuth()
  const v = await getVersionById(versionId)
  if (!v) return { ok: false, reason: 'バージョンが存在しません' }
  const draft = await getDraftById(v.draftId)
  if (!draft || draft.adminId !== auth.adminId) {
    return { ok: false, reason: '権限がありません' }
  }

  const { prisma } = await import('@/lib/prisma')
  await prisma.advisorReportVersion.update({
    where: { id: versionId },
    data: { shared_at: null, shared_until: null },
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: draft.sessionId,
    eventType: 'chat_response',
    payload: { kind: 'report_share_disabled', versionId, versionNumber: v.versionNumber },
  })

  return { ok: true }
}
