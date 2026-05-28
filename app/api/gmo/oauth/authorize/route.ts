import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  GMO_OAUTH_COOKIE_MAX_AGE_SECONDS,
  GMO_OAUTH_NONCE_COOKIE,
  GMO_OAUTH_STATE_COOKIE,
  generateAuthorizeUrl,
} from '@/lib/gmo-aozora/oauth'
import { isHibaraiEnabled } from '@/lib/features'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'

export const runtime = 'nodejs'

export async function GET() {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })

  const session = await getSystemAdminSessionData()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const state = randomToken()
  const nonce = randomToken()
  const response = NextResponse.redirect(generateAuthorizeUrl(state, nonce), { status: 302 })
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: GMO_OAUTH_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  }

  response.cookies.set(GMO_OAUTH_STATE_COOKIE, state, cookieOptions)
  response.cookies.set(GMO_OAUTH_NONCE_COOKIE, nonce, cookieOptions)
  return response
}

function randomToken(): string {
  return randomBytes(32).toString('base64url')
}
