/**
 * POST /api/advisor/report/notify-gchat
 *
 * リクエスト: { sessionId: string }
 * レスポンス: { ok: true } | { ok: false, error }
 *
 * 認証: System Admin
 *
 * 指定セッションの最新レポート (AdvisorReportDraft.result_markdown) を
 * Google Chat の Incoming Webhook に投稿する。
 *
 * P1-3 実装後は versionId 単位のエンドポイントに置き換え予定。
 * 現状は session 単位 = ドラフトの最新生成版を送る。
 */

import { NextResponse } from 'next/server'
import { requireAdvisorAuth, isAdvisorEnabled } from '@/src/lib/advisor/auth'
import { getDraftBySession } from '@/src/lib/advisor/persistence/report-drafts'
import {
  notifyGoogleChat,
  isGoogleChatConfigured,
} from '@/src/lib/advisor/reports/notify-google-chat'
import { recordAudit } from '@/src/lib/advisor/persistence/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RequestBody {
  sessionId?: string
}

function getBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (explicit) return explicit.replace(/\/$/, '')
  // フォールバック: リクエストの host から推測
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(req: Request) {
  if (!isAdvisorEnabled()) {
    return NextResponse.json({ error: 'Advisor は現在無効化されています' }, { status: 503 })
  }

  let auth
  try {
    auth = await requireAdvisorAuth()
  } catch {
    return NextResponse.json({ error: 'システム管理者認証が必要です' }, { status: 401 })
  }

  const status = isGoogleChatConfigured()
  if (!status.ready) {
    return NextResponse.json({ ok: false, error: status.reason }, { status: 400 })
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const sessionId = body.sessionId?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
  }

  const draft = await getDraftBySession(sessionId)
  if (!draft) {
    return NextResponse.json(
      { ok: false, error: 'このセッションにはレポートドラフトがありません' },
      { status: 404 }
    )
  }
  if (draft.adminId !== auth.adminId) {
    return NextResponse.json(
      { ok: false, error: 'このドラフトを操作する権限がありません' },
      { status: 403 }
    )
  }
  if (!draft.resultMarkdown) {
    return NextResponse.json(
      { ok: false, error: '生成済みのレポートがありません' },
      { status: 400 }
    )
  }

  const baseUrl = getBaseUrl(req)
  const fullViewUrl = `${baseUrl}/system-admin/advisor?c=${encodeURIComponent(sessionId)}`
  const versionLabel = `v${draft.generationCount}`

  const result = await notifyGoogleChat({
    title: draft.title,
    rangeStart: draft.rangeStart,
    rangeEnd: draft.rangeEnd,
    versionLabel,
    fullViewUrl,
    markdown: draft.resultMarkdown,
  })

  await recordAudit({
    adminId: auth.adminId,
    sessionId,
    eventType: result.ok ? 'chat_response' : 'error',
    payload: {
      kind: 'report_notify',
      target: 'google_chat',
      ok: result.ok,
      status: result.status,
      bodySnippet: result.bodySnippet ?? null,
      generationCount: draft.generationCount,
    },
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Google Chat への投稿に失敗しました (status=${result.status})`,
        details: result.bodySnippet,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
