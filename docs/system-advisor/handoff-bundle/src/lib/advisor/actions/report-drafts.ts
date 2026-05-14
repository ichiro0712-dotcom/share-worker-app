'use server'

/**
 * レポートドラフト用 Server Actions
 *
 * Canvas (右ペイン) が呼ぶ。System Admin 認証必須。
 * - getDraftForSession: 現在のドラフト取得 (1秒に1回程度ポーリングする想定)
 * - clearDraftForSession: ドラフトを削除 (ユーザーの手動リセット用)
 *
 * Gemini への生成リクエストは負荷が大きいので、Server Action ではなく
 * /api/advisor/report/generate (REST) で受ける。
 */

import { requireAdvisorAuth } from '../auth'
import {
  deleteDraft,
  getDraftBySession,
  upsertDraft,
  type ReportDraftSnapshot,
} from '../persistence/report-drafts'

export interface ClientDraftSummary {
  id: string
  sessionId: string
  title: string | null
  goal: string | null
  dataSources: string[]
  metricKeys: string[]
  rangeStart: string | null
  rangeEnd: string | null
  outline: string | null
  notes: string | null
  /** ユーザー初回要望 */
  originalRequest: string | null
  /** ドラフト本体 Markdown */
  skeletonMarkdown: string | null
  status: string
  resultMarkdown: string | null
  resultModel: string | null
  errorMessage: string | null
  generationCount: number
  generatedAt: string | null
  updatedAt: string
}

function toClient(d: ReportDraftSnapshot): ClientDraftSummary {
  return {
    id: d.id,
    sessionId: d.sessionId,
    title: d.title,
    goal: d.goal,
    dataSources: d.dataSources,
    metricKeys: d.metricKeys,
    rangeStart: d.rangeStart,
    rangeEnd: d.rangeEnd,
    outline: d.outline,
    notes: d.notes,
    originalRequest: d.originalRequest,
    skeletonMarkdown: d.skeletonMarkdown,
    status: d.status,
    resultMarkdown: d.resultMarkdown,
    resultModel: d.resultModel,
    errorMessage: d.errorMessage,
    generationCount: d.generationCount,
    generatedAt: d.generatedAt,
    updatedAt: d.updatedAt,
  }
}

export async function getDraftForSession(sessionId: string): Promise<ClientDraftSummary | null> {
  const auth = await requireAdvisorAuth()
  if (!sessionId) return null
  const draft = await getDraftBySession(sessionId)
  if (!draft) return null
  // 別 admin のドラフトは見せない
  if (draft.adminId !== auth.adminId) return null
  return toClient(draft)
}

/**
 * ドラフトの編集可能フィールドをクライアントから一括で直接更新する。
 * Claude を介さない (LLM 経由だと指示が反映されない事故が起きるため)。
 *
 * Canvas の「ドラフト更新」ボタン押下時に呼ばれる。フィールド毎の保存ではなく
 * 全フィールドを一括で送って 1 回の upsert で書き込む。
 */
export async function updateDraftBulk(input: {
  sessionId: string
  title?: string | null
  goal?: string | null
  rangeStart?: string | null
  rangeEnd?: string | null
  dataSources?: string[]
  metricKeys?: string[]
  outline?: string | null
  notes?: string | null
  /** ドラフト本体 Markdown (手動編集用) */
  skeletonMarkdown?: string | null
}): Promise<{ ok: boolean; reason?: string; draft?: ClientDraftSummary }> {
  const auth = await requireAdvisorAuth()
  if (!input.sessionId) return { ok: false, reason: 'sessionId が空です' }
  const existing = await getDraftBySession(input.sessionId)
  if (!existing) return { ok: false, reason: 'ドラフトが存在しません' }
  if (existing.adminId !== auth.adminId) return { ok: false, reason: '権限がありません' }

  // 日付バリデーション (空文字は null へ正規化)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const normalizeDate = (v: string | null | undefined): string | null | undefined => {
    if (v === undefined) return undefined
    if (v === null) return null
    const trimmed = v.trim()
    if (trimmed.length === 0) return null
    if (!DATE_RE.test(trimmed)) return undefined
    return trimmed
  }
  const rangeStart = normalizeDate(input.rangeStart)
  const rangeEnd = normalizeDate(input.rangeEnd)
  if (input.rangeStart && rangeStart === undefined) {
    return { ok: false, reason: '開始日は YYYY-MM-DD 形式で入力してください' }
  }
  if (input.rangeEnd && rangeEnd === undefined) {
    return { ok: false, reason: '終了日は YYYY-MM-DD 形式で入力してください' }
  }

  // 空文字 → null 正規化 (テキスト系)
  const norm = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim().length === 0 ? null : v

  const next = await upsertDraft({
    sessionId: input.sessionId,
    adminId: auth.adminId,
    title: norm(input.title),
    goal: norm(input.goal),
    outline: norm(input.outline),
    notes: norm(input.notes),
    rangeStart,
    rangeEnd,
    dataSources: input.dataSources,
    metricKeys: input.metricKeys,
    skeletonMarkdown: norm(input.skeletonMarkdown),
  })
  return { ok: true, draft: toClient(next) }
}

export async function clearDraftForSession(sessionId: string): Promise<{ ok: boolean }> {
  const auth = await requireAdvisorAuth()
  if (!sessionId) return { ok: false }
  const draft = await getDraftBySession(sessionId)
  if (!draft) return { ok: true } // 既にない
  if (draft.adminId !== auth.adminId) return { ok: false }
  await deleteDraft(sessionId)
  return { ok: true }
}

