/**
 * Advisor データクリーンアップ cron エンドポイント
 *
 * 保持期間ポリシー (2026-05-04 確定):
 *   - しおりなしセッションの Draft / Versions: 30 日触られなければ削除
 *   - Audit ログ: 90 日経過したものは削除 (ただし report_* イベントは 180 日保持)
 *   - 失効済み共有 URL の token / shared_at / shared_until は cleanup 対象 (掃除のため null 化)
 *
 * 認証:
 *   Authorization: Bearer ${ADVISOR_CRON_SECRET}
 *
 * 想定スケジュール:
 *   毎日 04:00 JST (= 19:00 UTC) — vercel.json で設定
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RETENTION_DRAFT_DAYS = 30
const RETENTION_AUDIT_GENERAL_DAYS = 90
const RETENTION_AUDIT_REPORT_DAYS = 180

function isAuthorized(req: Request): boolean {
  const expected = process.env.ADVISOR_CRON_SECRET
  if (!expected) {
    return process.env.NODE_ENV !== 'production'
  }
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}

interface CleanupResult {
  startedAt: string
  completedAt: string
  deletedDrafts: number
  deletedVersions: number
  deletedAuditLogs: number
  expiredSharesCleared: number
}

async function runCleanup(): Promise<CleanupResult> {
  const now = new Date()
  const startedAt = now.toISOString()

  const draftCutoff = new Date(now.getTime() - RETENTION_DRAFT_DAYS * 24 * 60 * 60 * 1000)
  const auditGeneralCutoff = new Date(now.getTime() - RETENTION_AUDIT_GENERAL_DAYS * 24 * 60 * 60 * 1000)
  const auditReportCutoff = new Date(now.getTime() - RETENTION_AUDIT_REPORT_DAYS * 24 * 60 * 60 * 1000)

  // 1. しおりなしセッションの id 集合を取得 (cron での全件削除を避けるため明示)
  //    bookmarked = false かつ updated_at < draftCutoff な session が対象
  const targetSessions = await prisma.advisorChatSession.findMany({
    where: {
      bookmarked: false,
      updated_at: { lt: draftCutoff },
    },
    select: { id: true },
  })
  const sessionIds = targetSessions.map((s) => s.id)

  let deletedDrafts = 0
  let deletedVersions = 0

  if (sessionIds.length > 0) {
    // 2. 対象セッションに紐づくドラフト + そのドラフトに紐づくバージョンを削除。
    //    ただしドラフト/バージョン自体が直近 30 日以内に触られていれば残す (作成直後に
    //    cron に消されないようにするため updated_at / created_at もチェック)。
    const targetDrafts = await prisma.advisorReportDraft.findMany({
      where: {
        session_id: { in: sessionIds },
        updated_at: { lt: draftCutoff },
      },
      select: { id: true },
    })
    const draftIds = targetDrafts.map((d) => d.id)

    if (draftIds.length > 0) {
      const versionDel = await prisma.advisorReportVersion.deleteMany({
        where: {
          draft_id: { in: draftIds },
          created_at: { lt: draftCutoff },
        },
      })
      deletedVersions = versionDel.count

      const draftDel = await prisma.advisorReportDraft.deleteMany({
        where: {
          id: { in: draftIds },
          updated_at: { lt: draftCutoff },
        },
      })
      deletedDrafts = draftDel.count
    }
  }

  // 3. Audit ログ削除 (event_type と payload.kind で「report 系か」を判定)
  //    report_* (kind が "report_" で始まる) は 180 日保持、それ以外は 90 日。
  //    event_type=tool_call で report 関連は別途扱うが、現状は payload.kind 基準で十分。
  const generalAuditDel = await prisma.advisorAuditLog.deleteMany({
    where: {
      created_at: { lt: auditGeneralCutoff },
      // payload.kind が report_ で始まらないもの (= report 系以外)
      NOT: {
        payload: {
          path: ['kind'],
          string_starts_with: 'report_',
        },
      },
    },
  })
  const reportAuditDel = await prisma.advisorAuditLog.deleteMany({
    where: {
      created_at: { lt: auditReportCutoff },
      payload: {
        path: ['kind'],
        string_starts_with: 'report_',
      },
    },
  })
  const deletedAuditLogs = generalAuditDel.count + reportAuditDel.count

  // 4. 期限切れの共有 URL を停止 (掃除): shared_until < now の token を null 化
  const expiredShare = await prisma.advisorReportVersion.updateMany({
    where: {
      shared_until: { lt: now },
      shared_at: { not: null },
    },
    data: { shared_at: null, shared_until: null, share_token: null },
  })

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    deletedDrafts,
    deletedVersions,
    deletedAuditLogs,
    expiredSharesCleared: expiredShare.count,
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCleanup()
    return NextResponse.json({ ok: true, result })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// Vercel Cron が GET でも呼ぶことに対応
export async function GET(req: Request) {
  return POST(req)
}
