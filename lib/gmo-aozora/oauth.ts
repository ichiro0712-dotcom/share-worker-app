import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { GmoAuthError } from './errors'

export const GMO_OAUTH_STATE_COOKIE = 'gmo_oauth_state'
export const GMO_OAUTH_NONCE_COOKIE = 'gmo_oauth_nonce'
export const GMO_OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60

const DEFAULT_SCOPES = 'openid offline_access corp:account corp:transfer'

const IdTokenPayloadSchema = z.object({
  iss: z.string().min(1),
  sub: z.string().min(1).optional(),
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  exp: z.number().int(),
  iat: z.number().int().optional(),
  nonce: z.string().min(1),
}).passthrough()

export type IdTokenPayload = z.infer<typeof IdTokenPayloadSchema>

export type GmoOAuthAccountType = 'CORPORATE' | 'PRIVATE'

export function generateAuthorizeUrl(state: string, nonce: string): string {
  const url = new URL(`${getGmoAuthBaseUrl()}/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', readRequiredEnv('GMO_AOZORA_CLIENT_ID'))
  url.searchParams.set('redirect_uri', readRequiredEnv('GMO_AOZORA_REDIRECT_URI'))
  url.searchParams.set('scope', process.env.GMO_AOZORA_SCOPES || DEFAULT_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  return url.toString()
}

export function verifyIdToken(idToken: string, clientSecret: string, nonce: string): IdTokenPayload {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN', 'GMO ID Token format is invalid')
  }

  const header = decodeJwtPart(encodedHeader, z.object({ alg: z.string(), typ: z.string().optional() }))
  if (header.alg !== 'HS256') {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN_ALG', 'GMO ID Token alg must be HS256')
  }

  const expectedSignature = base64UrlEncode(
    createHmac('sha256', clientSecret).update(`${encodedHeader}.${encodedPayload}`).digest()
  )
  if (!safeEqualBase64Url(encodedSignature, expectedSignature)) {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN_SIGNATURE', 'GMO ID Token signature is invalid')
  }

  const payload = decodeJwtPart(encodedPayload, IdTokenPayloadSchema)
  const expectedIssuer = getGmoIssuer()
  const expectedAudience = readRequiredEnv('GMO_AOZORA_CLIENT_ID')
  const nowInSeconds = Math.floor(Date.now() / 1000)

  if (payload.iss !== expectedIssuer) {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN_ISSUER', 'GMO ID Token issuer is invalid')
  }
  if (!audienceIncludes(payload.aud, expectedAudience)) {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN_AUDIENCE', 'GMO ID Token audience is invalid')
  }
  if (payload.exp <= nowInSeconds) {
    throw new GmoAuthError(401, 'EXPIRED_ID_TOKEN', 'GMO ID Token is expired')
  }
  if (payload.nonce !== nonce) {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN_NONCE', 'GMO ID Token nonce is invalid')
  }

  return payload
}

export function getGmoRedirectUri(): string {
  return readRequiredEnv('GMO_AOZORA_REDIRECT_URI')
}

export function getGmoOAuthScope(): string {
  return process.env.GMO_AOZORA_SCOPES || DEFAULT_SCOPES
}

export function getGmoOAuthAccountType(): GmoOAuthAccountType {
  return process.env.GMO_AOZORA_ACCOUNT_TYPE === 'private' ? 'PRIVATE' : 'CORPORATE'
}

export function getGmoClientSecret(): string {
  return readRequiredEnv('GMO_AOZORA_CLIENT_SECRET')
}

function getGmoAuthBaseUrl(): string {
  const baseUrl = readRequiredEnv('GMO_AOZORA_BASE_URL')
  try {
    return `${new URL(baseUrl).origin}/ganb/api/auth/v1`
  } catch {
    return `${baseUrl.replace(/\/+$/, '')}/ganb/api/auth/v1`
  }
}

function getGmoIssuer(): string {
  return process.env.GMO_AOZORA_ISSUER || getGmoAuthBaseUrl()
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new GmoAuthError(0, 'CONFIG_ERROR', `${name} is required for GMO OAuth`)
  return value
}

function decodeJwtPart<T>(value: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  try {
    return schema.parse(JSON.parse(Buffer.from(normalizeBase64Url(value), 'base64').toString('utf8')))
  } catch (error) {
    throw new GmoAuthError(401, 'INVALID_ID_TOKEN_PAYLOAD', 'GMO ID Token payload is invalid', error)
  }
}

function normalizeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
}

function base64UrlEncode(value: Buffer): string {
  return value.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function safeEqualBase64Url(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function audienceIncludes(audience: string | string[], expectedAudience: string): boolean {
  return Array.isArray(audience) ? audience.includes(expectedAudience) : audience === expectedAudience
}
