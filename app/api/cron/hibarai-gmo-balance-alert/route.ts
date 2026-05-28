import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import { runGmoBalanceAlert } from '@/lib/actions/hibarai/gmo-balance-alert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true
  return new URL(request.url).searchParams.get('secret') === secret
}

export async function GET(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runGmoBalanceAlert()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[GMO_BALANCE_ALERT] Cron error:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
