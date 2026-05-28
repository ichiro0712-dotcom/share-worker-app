import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { createGmoClient } from '@/lib/gmo-aozora/client'
import {
  GMO_OAUTH_NONCE_COOKIE,
  GMO_OAUTH_STATE_COOKIE,
  getGmoClientSecret,
  getGmoOAuthAccountType,
  getGmoOAuthScope,
  getGmoRedirectUri,
  verifyIdToken,
  type IdTokenPayload,
} from '@/lib/gmo-aozora/oauth'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'

export const runtime = 'nodejs'

interface LatestAuditLogRow {
  chain_sequence: bigint
  hash_self: string
}

export async function GET(request: NextRequest) {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })

  const session = await getSystemAdminSessionData()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const providerError = requestUrl.searchParams.get('error')
  const cookieState = request.cookies.get(GMO_OAUTH_STATE_COOKIE)?.value
  const cookieNonce = request.cookies.get(GMO_OAUTH_NONCE_COOKIE)?.value

  if (providerError) return clearOAuthCookies(redirectWithOAuthResult(request, 'provider_error'))
  if (!code) return new Response('Missing code', { status: 400 })
  if (!state || !cookieState || state !== cookieState || !cookieNonce) {
    return new Response('Invalid state', { status: 400 })
  }

  try {
    const tokenResponse = await createGmoClient().exchangeCodeForToken(code, getGmoRedirectUri())
    const idTokenPayload = verifyReturnedIdToken(tokenResponse.id_token, cookieNonce)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + tokenResponse.expires_in * 1000)
    const accountType = getGmoOAuthAccountType()

    await prisma.$transaction(async (tx) => {
      await tx.gmoOAuthToken.updateMany({
        where: {
          revoked_at: null,
          account_type: accountType,
        },
        data: {
          revoked_at: now,
        },
      })

      const token = await tx.gmoOAuthToken.create({
        data: {
          scope: tokenResponse.scope || getGmoOAuthScope(),
          account_type: accountType,
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          token_type: tokenResponse.token_type,
          expires_at: expiresAt,
          id_token: tokenResponse.id_token,
          gmo_user_sub: idTokenPayload?.sub,
        },
      })

      await recordOAuthTokenObtainedAuditLog(tx, {
        adminId: session.adminId,
        tokenId: token.id,
        accountType,
        scope: token.scope,
        expiresAt,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
        gmoUserSub: idTokenPayload?.sub ?? null,
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    })

    return clearOAuthCookies(NextResponse.redirect(new URL('/system-admin/hibarai?oauth=success', request.url), { status: 302 }))
  } catch (error) {
    console.error('[GMO_OAUTH_CALLBACK_ERROR]', error)
    return clearOAuthCookies(redirectWithOAuthResult(request, 'error'))
  }
}

function verifyReturnedIdToken(idToken: string | undefined, nonce: string): IdTokenPayload | null {
  if (idToken) return verifyIdToken(idToken, getGmoClientSecret(), nonce)
  if (process.env.GMO_AOZORA_MODE === 'real') {
    throw new Error('GMO OAuth response did not include id_token')
  }
  return null
}

function redirectWithOAuthResult(request: NextRequest, result: string): NextResponse {
  return NextResponse.redirect(new URL(`/system-admin/hibarai?oauth=${result}`, request.url), { status: 302 })
}

function clearOAuthCookies(response: NextResponse): NextResponse {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  }
  response.cookies.set(GMO_OAUTH_STATE_COOKIE, '', cookieOptions)
  response.cookies.set(GMO_OAUTH_NONCE_COOKIE, '', cookieOptions)
  return response
}

async function recordOAuthTokenObtainedAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    adminId?: number
    tokenId: string
    accountType: string
    scope: string
    expiresAt: Date
    ipAddress: string | null
    userAgent: string | null
    gmoUserSub: string | null
  }
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hibarai_audit_global'))`
  const latestRows = await tx.$queryRaw<LatestAuditLogRow[]>`
    SELECT chain_sequence, hash_self
    FROM hibarai_audit_logs
    WHERE chain_scope = 'global'
    ORDER BY chain_sequence DESC
    LIMIT 1
    FOR UPDATE
  `
  const latest = latestRows[0]
  const chainSequence = latest ? latest.chain_sequence + BigInt(1) : BigInt(1)
  const payload = {
    accountType: params.accountType,
    scope: params.scope,
    expiresAt: params.expiresAt.toISOString(),
    gmoUserSub: params.gmoUserSub,
  }
  const hashSelf = createHash('sha256').update(JSON.stringify({
    chainScope: 'global',
    chainSequence: chainSequence.toString(),
    hashPrev: latest?.hash_self ?? null,
    action: 'OAUTH_TOKEN_OBTAINED',
    targetId: params.tokenId,
    payload,
  })).digest('hex')

  await tx.hibaraiAuditLog.create({
    data: {
      actor_type: 'SYSTEM_ADMIN',
      actor_id: params.adminId ? String(params.adminId) : null,
      action: 'OAUTH_TOKEN_OBTAINED',
      target_type: 'GmoOAuthToken',
      target_id: params.tokenId,
      payload,
      result: 'SUCCESS',
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      chain_scope: 'global',
      chain_sequence: chainSequence,
      hash_prev: latest?.hash_self ?? null,
      hash_self: hashSelf,
    },
  })
}

function getClientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null
}
