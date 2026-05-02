/**
 * AdvisorReportVersion の永続化 (P1-3 + P1-9)
 *
 * バージョン履歴・編集ロックを扱う。Draft 側 (report-drafts.ts) は触らないので
 * 既存コードを破壊しない。バージョン作成時のみ Draft.result_markdown を「最新版キャッシュ」として更新する。
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type ReportVersionSource =
  | 'generated'
  | 'manual_edit'
  | 'llm_edit'
  /** Gemini Canvas 連携 (ユーザーがブラウザの Gemini Canvas で編集 → コピペで戻ってきた) */
  | 'gemini_canvas'

/** バージョン作成時のドラフトのスナップショット (Json で保存) */
export interface ReportDraftSnapshotJson {
  title: string | null
  goal: string | null
  dataSources: string[]
  metricKeys: string[]
  rangeStart: string | null
  rangeEnd: string | null
  outline: string | null
  notes: string | null
}

export interface ReportVersionRow {
  id: string
  draftId: string
  versionNumber: number
  resultMarkdown: string
  resultModel: string
  draftSnapshot: ReportDraftSnapshotJson
  source: ReportVersionSource
  parentVersionId: string | null
  generatedMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  editingLockAdminId: number | null
  editingLockAt: string | null
  createdAt: string
}

const EDITING_LOCK_TTL_MS = 5 * 60 * 1000 // 5 分

function toRow(v: {
  id: string
  draft_id: string
  version_number: number
  result_markdown: string
  result_model: string
  draft_snapshot: Prisma.JsonValue
  source: string
  parent_version_id: string | null
  generated_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  editing_lock_admin_id: number | null
  editing_lock_at: Date | null
  created_at: Date
}): ReportVersionRow {
  return {
    id: v.id,
    draftId: v.draft_id,
    versionNumber: v.version_number,
    resultMarkdown: v.result_markdown,
    resultModel: v.result_model,
    draftSnapshot: (v.draft_snapshot as unknown as ReportDraftSnapshotJson) ?? {
      title: null,
      goal: null,
      dataSources: [],
      metricKeys: [],
      rangeStart: null,
      rangeEnd: null,
      outline: null,
      notes: null,
    },
    source: v.source as ReportVersionSource,
    parentVersionId: v.parent_version_id,
    generatedMs: v.generated_ms,
    inputTokens: v.input_tokens,
    outputTokens: v.output_tokens,
    editingLockAdminId: v.editing_lock_admin_id,
    editingLockAt: v.editing_lock_at?.toISOString() ?? null,
    createdAt: v.created_at.toISOString(),
  }
}

/**
 * 新しいバージョンを 1 行作る。
 * - version_number は draft_id 内の現在の最大値 +1
 * - 同時に Draft.result_markdown を最新版キャッシュとして更新する
 *
 * `parentVersionId` は省略可。LLM/手動編集の場合は派生元バージョンを指定する。
 */
export async function createReportVersion(input: {
  draftId: string
  resultMarkdown: string
  resultModel: string
  draftSnapshot: ReportDraftSnapshotJson
  source: ReportVersionSource
  parentVersionId?: string | null
  generatedMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
}): Promise<ReportVersionRow> {
  const created = await prisma.$transaction(async (tx) => {
    // 現在の最大 version_number を取得
    const max = await tx.advisorReportVersion.findFirst({
      where: { draft_id: input.draftId },
      orderBy: { version_number: 'desc' },
      select: { version_number: true },
    })
    const nextVersion = (max?.version_number ?? 0) + 1

    const v = await tx.advisorReportVersion.create({
      data: {
        draft_id: input.draftId,
        version_number: nextVersion,
        result_markdown: input.resultMarkdown,
        result_model: input.resultModel,
        draft_snapshot: input.draftSnapshot as unknown as Prisma.InputJsonValue,
        source: input.source,
        parent_version_id: input.parentVersionId ?? null,
        generated_ms: input.generatedMs ?? null,
        input_tokens: input.inputTokens ?? null,
        output_tokens: input.outputTokens ?? null,
      },
    })

    // Draft の最新版キャッシュも更新 (status=completed)
    await tx.advisorReportDraft.update({
      where: { id: input.draftId },
      data: {
        status: 'completed',
        result_markdown: input.resultMarkdown,
        result_model: input.resultModel,
        error_message: null,
        generated_at: new Date(),
        generation_count: { increment: 1 },
      },
    })

    return v
  })
  return toRow(created)
}

export async function listVersionsByDraft(draftId: string): Promise<ReportVersionRow[]> {
  const rows = await prisma.advisorReportVersion.findMany({
    where: { draft_id: draftId },
    orderBy: { version_number: 'desc' },
  })
  return rows.map(toRow)
}

export async function getVersionById(id: string): Promise<ReportVersionRow | null> {
  const v = await prisma.advisorReportVersion.findUnique({ where: { id } })
  return v ? toRow(v) : null
}

/** 最新版を 1 件取得 */
export async function getLatestVersion(draftId: string): Promise<ReportVersionRow | null> {
  const v = await prisma.advisorReportVersion.findFirst({
    where: { draft_id: draftId },
    orderBy: { version_number: 'desc' },
  })
  return v ? toRow(v) : null
}

/**
 * 編集ロックを取得 (admin が "編集" ボタンを押したタイミング)。
 * 既存ロックが 5 分以内なら別 admin は取れない。それ以上経っていたら奪取する。
 *
 * 戻り値: ロック取得できたら version、できなければ理由付きで失敗。
 */
export async function acquireEditingLock(input: {
  versionId: string
  adminId: number
}): Promise<{ ok: true; version: ReportVersionRow } | { ok: false; reason: string }> {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const v = await tx.advisorReportVersion.findUnique({ where: { id: input.versionId } })
    if (!v) return { ok: false as const, reason: 'バージョンが存在しません' }

    const lockedBy = v.editing_lock_admin_id
    const lockedAt = v.editing_lock_at
    if (lockedBy && lockedBy !== input.adminId && lockedAt) {
      const elapsed = now.getTime() - lockedAt.getTime()
      if (elapsed < EDITING_LOCK_TTL_MS) {
        return {
          ok: false as const,
          reason: '別の管理者が編集中です (5 分後に自動解除)',
        }
      }
      // 5 分以上経過 → ロック奪取
    }

    const updated = await tx.advisorReportVersion.update({
      where: { id: input.versionId },
      data: {
        editing_lock_admin_id: input.adminId,
        editing_lock_at: now,
      },
    })
    return { ok: true as const, version: toRow(updated) }
  })
}

/** 編集ロック解除 */
export async function releaseEditingLock(input: {
  versionId: string
  adminId: number
}): Promise<void> {
  await prisma.advisorReportVersion.updateMany({
    where: { id: input.versionId, editing_lock_admin_id: input.adminId },
    data: { editing_lock_admin_id: null, editing_lock_at: null },
  })
}

/**
 * 現在ロック中かを判定 (LLM 部分修正前のチェック用)。
 * 5 分超過したロックは無視する。
 */
export async function isLockedByOther(input: {
  versionId: string
  adminId: number
}): Promise<{ locked: boolean; lockedBy?: number }> {
  const v = await prisma.advisorReportVersion.findUnique({
    where: { id: input.versionId },
    select: { editing_lock_admin_id: true, editing_lock_at: true },
  })
  if (!v?.editing_lock_admin_id || !v.editing_lock_at) return { locked: false }
  if (v.editing_lock_admin_id === input.adminId) return { locked: false }
  const elapsed = Date.now() - v.editing_lock_at.getTime()
  if (elapsed >= EDITING_LOCK_TTL_MS) return { locked: false }
  return { locked: true, lockedBy: v.editing_lock_admin_id }
}

/**
 * Draft の現在のスナップショットを抽出 (バージョン作成時に保存する Json)。
 * 引数の draft は report-drafts.ts の ReportDraftSnapshot を想定。
 */
export function buildDraftSnapshot(draft: {
  title: string | null
  goal: string | null
  dataSources: string[]
  metricKeys: string[]
  rangeStart: string | null
  rangeEnd: string | null
  outline: string | null
  notes: string | null
}): ReportDraftSnapshotJson {
  return {
    title: draft.title,
    goal: draft.goal,
    dataSources: draft.dataSources,
    metricKeys: draft.metricKeys,
    rangeStart: draft.rangeStart,
    rangeEnd: draft.rangeEnd,
    outline: draft.outline,
    notes: draft.notes,
  }
}

/** バージョン削除 (admin の手動削除用) */
export async function deleteVersion(versionId: string): Promise<void> {
  await prisma.advisorReportVersion.delete({ where: { id: versionId } })
}

/**
 * admin 所有の全レポートバージョンを横断で一覧。
 * 履歴一覧画面で使う。
 */
export async function listAllVersionsForAdmin(input: {
  adminId: number
  searchTitle?: string
  limit?: number
  offset?: number
}): Promise<{
  rows: Array<
    ReportVersionRow & {
      sessionId: string
      title: string | null
    }
  >
  total: number
}> {
  const limit = Math.min(input.limit ?? 50, 200)
  const offset = input.offset ?? 0

  // Draft 経由で adminId フィルタ。検索は draft.title または version.draft_snapshot.title でもいいが、
  // draft.title (= 最新キャッシュ) で OK にする (簡潔さ優先)。
  const draftWhere: Prisma.AdvisorReportDraftWhereInput = {
    admin_id: input.adminId,
  }
  if (input.searchTitle && input.searchTitle.trim()) {
    draftWhere.title = { contains: input.searchTitle.trim(), mode: 'insensitive' }
  }

  // 該当する draft の id 一覧を取得
  const drafts = await prisma.advisorReportDraft.findMany({
    where: draftWhere,
    select: { id: true, session_id: true, title: true },
  })
  const draftIds = drafts.map((d) => d.id)
  const draftMeta = new Map(drafts.map((d) => [d.id, { sessionId: d.session_id, title: d.title }]))

  if (draftIds.length === 0) {
    return { rows: [], total: 0 }
  }

  const [versions, total] = await Promise.all([
    prisma.advisorReportVersion.findMany({
      where: { draft_id: { in: draftIds } },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.advisorReportVersion.count({ where: { draft_id: { in: draftIds } } }),
  ])

  const rows = versions.map((v) => {
    const meta = draftMeta.get(v.draft_id) ?? { sessionId: '', title: null }
    return {
      ...toRow(v),
      sessionId: meta.sessionId,
      title: meta.title,
    }
  })

  return { rows, total }
}
