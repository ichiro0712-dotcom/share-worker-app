import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { createGmoClient } from '@/lib/gmo-aozora/client'
import { getGmoOAuthAccountType, getGmoOAuthScope } from '@/lib/gmo-aozora/oauth'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server'

const ACTIVE_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000
const PROACTIVE_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000

interface GmoOAuthTokenRow {
  id: string
  scope: string
  account_type: 'CORPORATE' | 'PRIVATE'
  access_token: string
  refresh_token: string
  token_type: string
  expires_at: Date
  id_token: string | null
  gmo_user_sub: string | null
  revoked_at: Date | null
  created_at: Date
  updated_at: Date
}

export async function getActiveAccessToken(): Promise<string> {
  assertHibaraiEnabled()

  const token = await prisma.gmoOAuthToken.findFirst({
    where: { revoked_at: null },
    orderBy: { created_at: 'desc' },
  })

  if (!token) throw new Error('GMO OAuth token is not connected')

  if (token.expires_at.getTime() - Date.now() <= ACTIVE_TOKEN_REFRESH_SKEW_MS) {
    const refreshed = await refreshLatestTokenIfExpiringWithin(ACTIVE_TOKEN_REFRESH_SKEW_MS)
    return refreshed.access_token
  }

  return token.access_token
}

export async function refreshTokenIfNeeded(): Promise<void> {
  assertHibaraiEnabled()
  await refreshLatestTokenIfExpiringWithin(PROACTIVE_REFRESH_WINDOW_MS)
}

export async function revokeTokens(): Promise<void> {
  'use server'

  assertHibaraiEnabled()
  await requireSystemAdminAuth()

  await prisma.gmoOAuthToken.updateMany({
    where: { revoked_at: null },
    data: { revoked_at: new Date() },
  })

  revalidatePath('/system-admin/hibarai')
}

export async function getOAuthTokenStatus(): Promise<{
  connected: boolean
  expiresAt: string | null
  daysUntilExpiry: number | null
  scope: string | null
  accountType: string | null
}> {
  assertHibaraiEnabled()
  await requireSystemAdminAuth()

  const token = await prisma.gmoOAuthToken.findFirst({
    where: { revoked_at: null },
    orderBy: { created_at: 'desc' },
    select: {
      expires_at: true,
      scope: true,
      account_type: true,
    },
  })

  if (!token) {
    return {
      connected: false,
      expiresAt: null,
      daysUntilExpiry: null,
      scope: null,
      accountType: null,
    }
  }

  return {
    connected: token.expires_at.getTime() > Date.now(),
    expiresAt: token.expires_at.toISOString(),
    daysUntilExpiry: Math.max(0, Math.ceil((token.expires_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
    scope: token.scope,
    accountType: token.account_type,
  }
}

async function refreshLatestTokenIfExpiringWithin(windowMs: number): Promise<GmoOAuthTokenRow> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gmo_oauth_token_refresh'))`
    const tokens = await tx.$queryRaw<GmoOAuthTokenRow[]>`
      SELECT *
      FROM gmo_oauth_tokens
      WHERE revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `
    const token = tokens[0]
    if (!token) throw new Error('GMO OAuth token is not connected')

    if (token.expires_at.getTime() - Date.now() > windowMs) {
      return token
    }

    const refreshed = await createGmoClient().refreshAccessToken(token.refresh_token)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + refreshed.expires_in * 1000)

    await tx.gmoOAuthToken.update({
      where: { id: token.id },
      data: { revoked_at: now },
    })

    const created = await tx.gmoOAuthToken.create({
      data: {
        scope: refreshed.scope || token.scope || getGmoOAuthScope(),
        account_type: token.account_type || getGmoOAuthAccountType(),
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_type: refreshed.token_type,
        expires_at: expiresAt,
        id_token: refreshed.id_token,
        gmo_user_sub: token.gmo_user_sub,
      },
    })

    return {
      id: created.id,
      scope: created.scope,
      account_type: created.account_type,
      access_token: created.access_token,
      refresh_token: created.refresh_token,
      token_type: created.token_type,
      expires_at: created.expires_at,
      id_token: created.id_token,
      gmo_user_sub: created.gmo_user_sub,
      revoked_at: created.revoked_at,
      created_at: created.created_at,
      updated_at: created.updated_at,
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  })
}

function assertHibaraiEnabled(): void {
  if (!isHibaraiEnabled()) {
    throw new Error('Not found')
  }
}
