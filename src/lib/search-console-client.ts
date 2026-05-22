/**
 * Google Search Console クライアント (Advisor 用)
 *
 * 認証は GA4 と同じ Service Account を流用する。
 * - 本番 (Vercel): GA_CREDENTIALS_JSON 環境変数の JSON 全文
 * - ローカル: GOOGLE_APPLICATION_CREDENTIALS のファイルパス
 *
 * 対象サイトは SEARCH_CONSOLE_SITE_URL で指定 (例: "sc-domain:tastas.work" または "https://tastas.work/")。
 *
 * Service Account のメールアドレスを Search Console プロパティの「ユーザーと権限」に
 * 「制限付きユーザー」以上で追加しておく必要がある (= ユーザー作業)。
 */

import { google, type Auth } from 'googleapis'
import path from 'path'

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']

let authClient: Auth.GoogleAuth | null = null

// google.auth.JWT + keyFile 経路は `invalid_grant: account not found` で動かない既知バグがある
// (キー自体は有効だが、JWT クラスが keyFile から拾うときに何かを失敗する)。
// GoogleAuth + keyFile 経路は同じキーで通るので、こちらを使う。
function getAuthClient(): Auth.GoogleAuth {
  if (authClient) return authClient

  const credentialsJson = process.env.GA_CREDENTIALS_JSON
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson) as {
      client_email: string
      private_key: string
    }
    authClient = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: SCOPES,
    })
    return authClient
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS または GA_CREDENTIALS_JSON が未設定です'
    )
  }
  authClient = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), credentialsPath),
    scopes: SCOPES,
  })
  return authClient
}

function getSiteUrl(): string {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL
  if (!siteUrl) {
    throw new Error('SEARCH_CONSOLE_SITE_URL が未設定です')
  }
  return siteUrl
}

export type SearchConsoleDimension = 'query' | 'page' | 'country' | 'device' | 'date'
export type SearchConsoleSearchType = 'web' | 'image' | 'video' | 'news'

export interface SearchConsoleQueryInput {
  startDate: string
  endDate: string
  dimensions?: SearchConsoleDimension[]
  rowLimit?: number
  searchType?: SearchConsoleSearchType
}

export interface SearchConsoleRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleQueryResult {
  rows: SearchConsoleRow[]
  totals: { clicks: number; impressions: number }
  period: { start: string; end: string }
  siteUrl: string
}

/**
 * Search Console の searchanalytics.query を呼ぶ。
 * dimensions が空なら totals (期間全体の合計) のみが返る。
 */
export async function querySearchAnalytics(
  input: SearchConsoleQueryInput
): Promise<SearchConsoleQueryResult> {
  const auth = getAuthClient()
  const siteUrl = getSiteUrl()
  const webmasters = google.webmasters({ version: 'v3', auth })

  const dimensions = input.dimensions ?? []
  const rowLimit = Math.min(input.rowLimit ?? 50, 500)

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions,
      rowLimit,
      searchType: input.searchType ?? 'web',
    },
  })

  const rows = (res.data.rows ?? []).map(
    (r): SearchConsoleRow => ({
      keys: r.keys ?? [],
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    })
  )

  // 期間全体の合計を計算 (dimensions 指定時は rows の合算)
  const totals = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
    }),
    { clicks: 0, impressions: 0 }
  )

  return {
    rows,
    totals,
    period: { start: input.startDate, end: input.endDate },
    siteUrl,
  }
}

/**
 * 動作可否を判定 (env だけ見て、API 呼び出しはしない)。
 */
export function isSearchConsoleConfigured(): { ready: boolean; reason?: string } {
  const hasCreds =
    !!process.env.GA_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  const hasSite = !!process.env.SEARCH_CONSOLE_SITE_URL
  if (!hasCreds) {
    return {
      ready: false,
      reason:
        '認証情報 (GA_CREDENTIALS_JSON または GOOGLE_APPLICATION_CREDENTIALS) が未設定です',
    }
  }
  if (!hasSite) {
    return {
      ready: false,
      reason:
        'SEARCH_CONSOLE_SITE_URL が未設定です (例: sc-domain:tastas.work または https://tastas.work/)',
    }
  }
  return { ready: true }
}
