/**
 * Advisor semantic memory 取り込み cron。
 *
 * しおり (bookmarked=true) されたセッションの最新 AdvisorReportVersion を
 * AdvisorSemanticMemory に upsert する。
 *
 * これにより、新しいチャットで「先月のレポートで言ってた○○」のような
 * 文脈依存質問に LLM が答えられるようになる (system-prompt.ts の dynamicPart で参照)。
 *
 * 認証:
 *   Authorization: Bearer ${ADVISOR_CRON_SECRET}
 *
 * 想定スケジュール:
 *   毎日 04:00 JST (= 19:00 UTC) — vercel.json で設定
 *   advisor-cleanup と同時刻でも構わない (両方とも軽量)。
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertSemanticMemory } from '@/src/lib/advisor/persistence/semantic-memory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CATEGORY = 'advisor_report'
const SOURCE_TYPE = 'report_version'

function isAuthorized(req: Request): boolean {
  const expected = process.env.ADVISOR_CRON_SECRET
  if (!expected) {
    return process.env.NODE_ENV !== 'production'
  }
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}

interface IngestResult {
  startedAt: string
  completedAt: string
  bookmarkedSessions: number
  ingestedReports: number
  skippedNoVersion: number
}

async function runIngest(): Promise<IngestResult> {
  const startedAt = new Date().toISOString()

  // 1. しおり付きセッションを取得 (admin_id とセッション id だけで OK)
  const bookmarkedSessions = await prisma.advisorChatSession.findMany({
    where: { bookmarked: true, is_archived: false },
    select: { id: true, admin_id: true, title: true },
  })

  let ingestedReports = 0
  let skippedNoVersion = 0

  for (const session of bookmarkedSessions) {
    // 2. このセッションのドラフトを取得
    const draft = await prisma.advisorReportDraft.findUnique({
      where: { session_id: session.id },
      select: { id: true, title: true },
    })
    if (!draft) {
      skippedNoVersion++
      continue
    }

    // 3. 最新バージョンを取得
    const latestVersion = await prisma.advisorReportVersion.findFirst({
      where: { draft_id: draft.id },
      orderBy: { version_number: 'desc' },
      select: {
        id: true,
        version_number: true,
        result_markdown: true,
        result_model: true,
        created_at: true,
      },
    })
    if (!latestVersion) {
      skippedNoVersion++
      continue
    }

    // 4. semantic memory に upsert
    await upsertSemanticMemory({
      adminId: session.admin_id,
      category: CATEGORY,
      sourceType: SOURCE_TYPE,
      sourceId: latestVersion.id,
      title: draft.title ?? session.title ?? '(無題のレポート)',
      content: latestVersion.result_markdown,
      metadata: {
        sessionId: session.id,
        sessionTitle: session.title,
        draftId: draft.id,
        versionId: latestVersion.id,
        versionNumber: latestVersion.version_number,
        model: latestVersion.result_model,
        generatedAt: latestVersion.created_at.toISOString(),
      },
    })
    ingestedReports++
  }

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    bookmarkedSessions: bookmarkedSessions.length,
    ingestedReports,
    skippedNoVersion,
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await runIngest()
    return NextResponse.json({ ok: true, result })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// Vercel Cron が GET でも呼ぶ場合に対応
export async function GET(req: Request) {
  return POST(req)
}
