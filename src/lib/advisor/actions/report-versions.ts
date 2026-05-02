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
 * Gemini Canvas 連携: ユーザーが Gemini Canvas で編集して戻ってきた markdown を
 * 新しいレポートバージョンとして保存する。
 *
 * Anthropic ノードアフィニティ問題で loop=1 が遅い事象の構造的回避策。
 * `saveManualEdit` と違って parentVersionId は不要 (初回バージョンとして保存できる)。
 *
 * sessionId からドラフトを引いて、その時点のスナップショットを残す。
 */
export async function saveGeminiCanvasVersion(input: {
  sessionId: string
  markdown: string
  parentVersionId?: string | null
}): Promise<
  | { ok: true; version: ClientVersionSummary }
  | { ok: false; reason: string }
> {
  const auth = await requireAdvisorAuth()
  if (!input.sessionId) return { ok: false, reason: 'sessionId が必要です' }
  const trimmed = (input.markdown ?? '').trim()
  if (trimmed.length < 50) {
    return { ok: false, reason: '本文が短すぎます (50 文字以上必要)' }
  }
  if (trimmed.length > 200_000) {
    return { ok: false, reason: '本文が大きすぎます (200,000 文字超)' }
  }

  // Draft を sessionId から取得 (auth と一致確認)
  const draft = await getDraftBySession(input.sessionId)
  if (!draft) return { ok: false, reason: 'ドラフトが見つかりません' }
  if (draft.adminId !== auth.adminId) {
    return { ok: false, reason: 'このドラフトを編集する権限がありません' }
  }

  const newVersion = await createReportVersion({
    draftId: draft.id,
    resultMarkdown: trimmed,
    resultModel: 'gemini-canvas',
    draftSnapshot: buildDraftSnapshot(draft),
    source: 'gemini_canvas',
    parentVersionId: input.parentVersionId ?? null,
    inputTokens: null,
    outputTokens: null,
    generatedMs: null,
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId: draft.sessionId,
    eventType: 'chat_response',
    payload: {
      kind: 'report_gemini_canvas',
      draftId: draft.id,
      newVersionId: newVersion.id,
      newVersionNumber: newVersion.versionNumber,
      length: trimmed.length,
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
}

export async function listReportHistory(input?: {
  searchTitle?: string
  limit?: number
  offset?: number
}): Promise<{ rows: ClientHistoryRow[]; total: number }> {
  const auth = await requireAdvisorAuth()
  const result = await listAllVersionsForAdmin({
    adminId: auth.adminId,
    searchTitle: input?.searchTitle,
    limit: input?.limit,
    offset: input?.offset,
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
  }))
  return { rows, total: result.total }
}
