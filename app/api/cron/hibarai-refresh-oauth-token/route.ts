import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import { refreshTokenIfNeeded } from '@/lib/actions/hibarai/oauth-token'
import { recordHibaraiAudit } from '@/lib/actions/hibarai/audit'
import { createSupportCode, getErrorMessage } from '@/lib/actions/hibarai/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await refreshTokenIfNeeded()
    await recordHibaraiAudit({
      actorType: 'SYSTEM_CRON',
      action: 'GMO_OAUTH_TOKEN_REFRESH_CHECKED',
      targetType: 'GmoOAuthToken',
      idempotencyKey: `oauth-refresh-${Date.now()}`,
      payload: { windowHours: 24 } as Prisma.InputJsonValue,
      result: 'SUCCESS',
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const supportCode = createSupportCode('HBO')
    console.error('[HIBARAI_REFRESH_OAUTH_TOKEN_ERROR]', supportCode, getErrorMessage(error))
    await recordHibaraiAudit({
      actorType: 'SYSTEM_CRON',
      action: 'GMO_OAUTH_TOKEN_REFRESH_FAILED',
      targetType: 'GmoOAuthToken',
      idempotencyKey: `oauth-refresh-failed-${supportCode}`,
      payload: { supportCode } as Prisma.InputJsonValue,
      result: 'ERROR',
      errorCode: supportCode,
    }).catch(() => {})
    return NextResponse.json({ supportCode }, { status: 500 })
  }
}

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true
  return new URL(request.url).searchParams.get('secret') === secret
}
