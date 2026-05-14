/**
 * AdvisorSemanticMemory の永続化層。
 *
 * しおり (bookmarked=true) されたセッションの最新レポートを cron が取り込み、
 * dynamic system prompt から「過去の重要レポート」として参照される。
 *
 * @related app/api/cron/advisor-semantic-ingest/route.ts (取り込み cron)
 * @related src/lib/advisor/system-prompt.ts (参照側、dynamicPart 構築)
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const CONTENT_TRUNCATE_CHARS = 8_000
const RECENT_LIMIT_DEFAULT = 5

export interface SemanticMemoryRecord {
  id: string
  adminId: number
  category: string
  sourceType: string
  sourceId: string
  title: string
  content: string
  metadata: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}

function toRecord(d: {
  id: string
  admin_id: number
  category: string
  source_type: string
  source_id: string
  title: string
  content: string
  metadata: Prisma.JsonValue | null
  created_at: Date
  updated_at: Date
}): SemanticMemoryRecord {
  return {
    id: d.id,
    adminId: d.admin_id,
    category: d.category,
    sourceType: d.source_type,
    sourceId: d.source_id,
    title: d.title,
    content: d.content,
    metadata: d.metadata,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }
}

/**
 * 1 件の semantic memory を upsert する。
 *
 * unique key = (admin_id, category, source_type, source_id)。
 * 同じ source は更新で上書きする (= レポート再生成で content が最新化される)。
 *
 * content は CONTENT_TRUNCATE_CHARS で truncate (LLM 入力サイズ抑制)。
 */
export async function upsertSemanticMemory(input: {
  adminId: number
  category: string // 'advisor_report' 等
  sourceType: string // 'report_version' 等
  sourceId: string
  title: string
  content: string
  metadata?: Prisma.InputJsonValue
}): Promise<SemanticMemoryRecord> {
  const truncated =
    input.content.length > CONTENT_TRUNCATE_CHARS
      ? input.content.slice(0, CONTENT_TRUNCATE_CHARS) + '\n... (truncated)'
      : input.content

  const d = await prisma.advisorSemanticMemory.upsert({
    where: {
      admin_id_category_source_type_source_id: {
        admin_id: input.adminId,
        category: input.category,
        source_type: input.sourceType,
        source_id: input.sourceId,
      },
    },
    create: {
      admin_id: input.adminId,
      category: input.category,
      source_type: input.sourceType,
      source_id: input.sourceId,
      title: input.title.slice(0, 300),
      content: truncated,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
    update: {
      title: input.title.slice(0, 300),
      content: truncated,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  })
  return toRecord(d)
}

/**
 * admin の最近の semantic memory を取得 (system prompt 埋め込み用)。
 */
export async function getRecentSemanticMemory(opts: {
  adminId: number
  category?: string
  limit?: number
}): Promise<SemanticMemoryRecord[]> {
  const records = await prisma.advisorSemanticMemory.findMany({
    where: {
      admin_id: opts.adminId,
      ...(opts.category ? { category: opts.category } : {}),
    },
    orderBy: { updated_at: 'desc' },
    take: opts.limit ?? RECENT_LIMIT_DEFAULT,
  })
  return records.map(toRecord)
}

/**
 * 指定 source を削除 (しおりが外された / 該当バージョンが消えた時に呼ぶ)。
 */
export async function deleteSemanticMemoryBySource(input: {
  adminId: number
  category: string
  sourceType: string
  sourceId: string
}): Promise<void> {
  await prisma.advisorSemanticMemory.deleteMany({
    where: {
      admin_id: input.adminId,
      category: input.category,
      source_type: input.sourceType,
      source_id: input.sourceId,
    },
  })
}
