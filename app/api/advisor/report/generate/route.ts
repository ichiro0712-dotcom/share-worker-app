/**
 * POST /api/advisor/report/generate
 *
 * リクエスト: { sessionId: string }
 * レスポンス: { draftId, resultMarkdown, model, ... }
 *
 * 認証: System Admin セッション必須
 *
 * チャット側のオーケストレーター (ループ上限) を消費せず、別系統で重い処理を実行する。
 * Gemini で 1 回生成するだけなので Anthropic の tool_use ループは使わない。
 */

import { NextResponse } from 'next/server'
import { requireAdvisorAuth, isAdvisorEnabled } from '@/src/lib/advisor/auth'
import { generateReport } from '@/src/lib/advisor/reports/generate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface RequestBody {
  sessionId?: string
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

  try {
    const result = await generateReport({
      sessionId,
      adminId: auth.adminId,
      abortSignal: req.signal,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // クライアントの fetch 中断 (AbortController.abort) で来た場合は 499 相当を返す
    const aborted =
      req.signal.aborted ||
      (e instanceof Error && e.name === 'AbortError') ||
      msg === 'cancelled by user'
    if (aborted) {
      return NextResponse.json(
        { ok: false, error: 'cancelled by user', cancelled: true },
        { status: 499 }
      )
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
