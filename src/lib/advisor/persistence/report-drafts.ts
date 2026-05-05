/**
 * Advisor Report Draft の永続化レイヤー
 *
 * 1 セッションに対して 0 or 1 件のドラフトが紐づく。
 * - LLM (Anthropic) は `update_report_draft` ツール経由でフィールドを更新
 * - 「レポート作成」ボタンは `/api/advisor/report/generate` を叩いて
 *   このドラフトを Gemini に投げて Markdown を生成、`result_markdown` に保存する
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type ReportDraftStatus = 'drafting' | 'generating' | 'completed' | 'failed'

export interface ReportDraftSnapshot {
  id: string
  sessionId: string
  adminId: number
  title: string | null
  goal: string | null
  dataSources: string[]
  /** data_sources に query_metric が含まれている場合の取得対象 metric キー */
  metricKeys: string[]
  rangeStart: string | null
  rangeEnd: string | null
  outline: string | null
  notes: string | null
  /** ユーザーの初回要望 (生のメッセージ本文)。Claude が修正時の文脈として参照する */
  originalRequest: string | null
  /** レポート本体のドラフト Markdown (0 埋めの表骨格 + 章立て) */
  skeletonMarkdown: string | null
  status: ReportDraftStatus
  resultMarkdown: string | null
  resultModel: string | null
  errorMessage: string | null
  generationCount: number
  generatedAt: string | null
  createdAt: string
  updatedAt: string
}

function toSnapshot(d: {
  id: string
  session_id: string
  admin_id: number
  title: string | null
  goal: string | null
  data_sources: Prisma.JsonValue | null
  metric_keys: Prisma.JsonValue | null
  range_start: string | null
  range_end: string | null
  outline: string | null
  notes: string | null
  original_request: string | null
  skeleton_markdown: string | null
  status: string
  result_markdown: string | null
  result_model: string | null
  error_message: string | null
  generation_count: number
  generated_at: Date | null
  created_at: Date
  updated_at: Date
}): ReportDraftSnapshot {
  return {
    id: d.id,
    sessionId: d.session_id,
    adminId: d.admin_id,
    title: d.title,
    goal: d.goal,
    dataSources: Array.isArray(d.data_sources)
      ? (d.data_sources as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    metricKeys: Array.isArray(d.metric_keys)
      ? (d.metric_keys as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    rangeStart: d.range_start,
    rangeEnd: d.range_end,
    outline: d.outline,
    notes: d.notes,
    originalRequest: d.original_request,
    skeletonMarkdown: d.skeleton_markdown,
    status: d.status as ReportDraftStatus,
    resultMarkdown: d.result_markdown,
    resultModel: d.result_model,
    errorMessage: d.error_message,
    generationCount: d.generation_count,
    generatedAt: d.generated_at?.toISOString() ?? null,
    createdAt: d.created_at.toISOString(),
    updatedAt: d.updated_at.toISOString(),
  }
}

export async function getDraftBySession(sessionId: string): Promise<ReportDraftSnapshot | null> {
  const d = await prisma.advisorReportDraft.findUnique({
    where: { session_id: sessionId },
  })
  return d ? toSnapshot(d) : null
}

export async function getDraftById(id: string): Promise<ReportDraftSnapshot | null> {
  const d = await prisma.advisorReportDraft.findUnique({ where: { id } })
  return d ? toSnapshot(d) : null
}

export interface UpsertDraftInput {
  sessionId: string
  adminId: number
  title?: string | null
  goal?: string | null
  dataSources?: string[]
  metricKeys?: string[]
  rangeStart?: string | null
  rangeEnd?: string | null
  outline?: string | null
  notes?: string | null
  /** ユーザー初回要望 (新規ドラフト作成時のみ書き込む想定。後続更新では undefined を渡す) */
  originalRequest?: string | null
  /** ドラフト本体 Markdown (Claude or 手動編集が書き換える) */
  skeletonMarkdown?: string | null
}

/**
 * 1 セッションに 1 ドラフトの upsert。
 * 部分更新を許容 (undefined は変更しない)。
 */
export async function upsertDraft(input: UpsertDraftInput): Promise<ReportDraftSnapshot> {
  const dataForUpdate: Prisma.AdvisorReportDraftUpdateInput = {}
  if (input.title !== undefined) dataForUpdate.title = input.title
  if (input.goal !== undefined) dataForUpdate.goal = input.goal
  if (input.dataSources !== undefined)
    dataForUpdate.data_sources = input.dataSources as unknown as Prisma.InputJsonValue
  if (input.metricKeys !== undefined)
    dataForUpdate.metric_keys = input.metricKeys as unknown as Prisma.InputJsonValue
  if (input.rangeStart !== undefined) dataForUpdate.range_start = input.rangeStart
  if (input.rangeEnd !== undefined) dataForUpdate.range_end = input.rangeEnd
  if (input.outline !== undefined) dataForUpdate.outline = input.outline
  if (input.notes !== undefined) dataForUpdate.notes = input.notes
  if (input.originalRequest !== undefined) dataForUpdate.original_request = input.originalRequest
  if (input.skeletonMarkdown !== undefined) dataForUpdate.skeleton_markdown = input.skeletonMarkdown
  // status は内部更新のみ (ドラフトを更新したら drafting に戻す)
  dataForUpdate.status = 'drafting'

  const d = await prisma.advisorReportDraft.upsert({
    where: { session_id: input.sessionId },
    create: {
      session_id: input.sessionId,
      admin_id: input.adminId,
      title: input.title ?? null,
      goal: input.goal ?? null,
      data_sources: (input.dataSources ?? []) as unknown as Prisma.InputJsonValue,
      metric_keys: (input.metricKeys ?? []) as unknown as Prisma.InputJsonValue,
      range_start: input.rangeStart ?? null,
      range_end: input.rangeEnd ?? null,
      outline: input.outline ?? null,
      notes: input.notes ?? null,
      original_request: input.originalRequest ?? null,
      skeleton_markdown: input.skeletonMarkdown ?? null,
      status: 'drafting',
    },
    update: dataForUpdate,
  })
  return toSnapshot(d)
}

export async function markDraftGenerating(id: string): Promise<void> {
  await prisma.advisorReportDraft.update({
    where: { id },
    data: { status: 'generating', error_message: null },
  })
}

export async function saveDraftResult(input: {
  id: string
  resultMarkdown: string
  resultModel: string
}): Promise<ReportDraftSnapshot> {
  const d = await prisma.advisorReportDraft.update({
    where: { id: input.id },
    data: {
      status: 'completed',
      result_markdown: input.resultMarkdown,
      result_model: input.resultModel,
      error_message: null,
      generated_at: new Date(),
      generation_count: { increment: 1 },
    },
  })
  return toSnapshot(d)
}

export async function saveDraftError(input: {
  id: string
  errorMessage: string
}): Promise<ReportDraftSnapshot> {
  const d = await prisma.advisorReportDraft.update({
    where: { id: input.id },
    data: { status: 'failed', error_message: input.errorMessage },
  })
  return toSnapshot(d)
}

export async function deleteDraft(sessionId: string): Promise<void> {
  await prisma.advisorReportDraft.deleteMany({ where: { session_id: sessionId } })
}
