import { z } from 'zod'
import { getErrorMessage, logTrace } from '@/lib/logger'
import { GmoApiError, GmoAuthError, GmoNetworkError } from './errors'
import { isValidIdempotencyKey } from './idempotency'
import {
  AccountsResponse,
  AccountsResponseSchema,
  BalanceResponse,
  BalanceResponseSchema,
  OAuthTokenResponse,
  OAuthTokenResponseSchema,
  TransferFeeRequest,
  TransferFeeRequestSchema,
  TransferFeeResponse,
  TransferFeeResponseSchema,
  TransferRequest,
  TransferRequestSchema,
  TransferRequestResponse,
  TransferRequestResponseSchema,
  TransferRequestResultResponse,
  TransferRequestResultResponseSchema,
  TransferStatusQuery,
  TransferStatusQuerySchema,
  TransferStatusResponse,
  TransferStatusResponseSchema,
} from './types'

export type GmoAccountType = 'corporate' | 'private'

export interface GmoConfig {
  baseUrl: string
  clientId?: string
  clientSecret?: string
  accountType?: GmoAccountType
  fetchImpl?: typeof fetch
}

type HttpMethod = 'GET' | 'POST'

interface RequestOptions {
  token?: string
  idempotencyKey?: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

/**
 * GMOあおぞらネット銀行APIの呼び出し境界を表すインターフェース。
 */
export interface GmoClient {
  /**
   * 口座一覧を取得する。
   */
  listAccounts(token: string): Promise<AccountsResponse>

  /**
   * 口座残高を取得する。
   */
  getBalance(token: string, accountId?: string): Promise<BalanceResponse>

  /**
   * 振込依頼を作成する。
   */
  requestTransfer(
    token: string,
    idempotencyKey: string,
    payload: TransferRequest
  ): Promise<TransferRequestResponse>

  /**
   * 振込状況を照会する。
   */
  getTransferStatus(token: string, query: TransferStatusQuery): Promise<TransferStatusResponse>

  /**
   * 振込依頼結果を照会する。
   */
  getTransferRequestResult(
    token: string,
    accountId: string,
    applyNo: string
  ): Promise<TransferRequestResultResponse>

  /**
   * 振込手数料を事前照会する。
   */
  getTransferFee(token: string, payload: TransferFeeRequest): Promise<TransferFeeResponse>

  /**
   * OAuth認可コードをトークンへ交換する。
   */
  exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse>

  /**
   * リフレッシュトークンからアクセストークンを再発行する。
   */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse>
}

/**
 * GMOあおぞらネット銀行の実APIをfetchで呼び出すクライアント。
 */
export class RealGmoClient implements GmoClient {
  private readonly apiBaseUrl: string
  private readonly authBaseUrl: string
  private readonly fetcher: typeof fetch
  private readonly accountType: GmoAccountType

  constructor(private readonly config: GmoConfig) {
    this.accountType = config.accountType ?? 'corporate'
    this.apiBaseUrl = buildApiBaseUrl(config.baseUrl, this.accountType)
    this.authBaseUrl = buildAuthBaseUrl(config.baseUrl)
    this.fetcher = config.fetchImpl ?? fetch
  }

  /**
   * 口座一覧を取得する。
   */
  async listAccounts(token: string): Promise<AccountsResponse> {
    return this.request('GET', '/accounts', AccountsResponseSchema, { token })
  }

  /**
   * 口座残高を取得する。
   */
  async getBalance(token: string, accountId?: string): Promise<BalanceResponse> {
    return this.request('GET', '/accounts/balances', BalanceResponseSchema, {
      token,
      query: { accountId },
    })
  }

  /**
   * 振込依頼を作成する。
   */
  async requestTransfer(
    token: string,
    idempotencyKey: string,
    payload: TransferRequest
  ): Promise<TransferRequestResponse> {
    if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new GmoApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Invalid GMO Idempotency-Key')
    }

    const parsedPayload = parseOutgoingPayload(TransferRequestSchema, payload, 'Invalid GMO transfer request')
    return this.request('POST', '/transfer/request', TransferRequestResponseSchema, {
      token,
      idempotencyKey,
      body: parsedPayload,
    })
  }

  /**
   * 振込状況を照会する。
   */
  async getTransferStatus(token: string, query: TransferStatusQuery): Promise<TransferStatusResponse> {
    const parsedQuery = parseOutgoingPayload(TransferStatusQuerySchema, query, 'Invalid GMO transfer status query')
    return this.request('GET', '/transfer/status', TransferStatusResponseSchema, {
      token,
      query: parsedQuery,
    })
  }

  /**
   * 振込依頼結果を照会する。
   */
  async getTransferRequestResult(
    token: string,
    accountId: string,
    applyNo: string
  ): Promise<TransferRequestResultResponse> {
    return this.request('GET', '/transfer/request-result', TransferRequestResultResponseSchema, {
      token,
      query: { accountId, applyNo },
    })
  }

  /**
   * 振込手数料を事前照会する。
   */
  async getTransferFee(token: string, payload: TransferFeeRequest): Promise<TransferFeeResponse> {
    const parsedPayload = parseOutgoingPayload(TransferFeeRequestSchema, payload, 'Invalid GMO transfer fee request')
    return this.request('POST', '/transfer/transferfee', TransferFeeResponseSchema, {
      token,
      body: parsedPayload,
    })
  }

  /**
   * OAuth認可コードをトークンへ交換する。
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })
    this.appendOAuthClientCredentials(form)
    return this.requestToken(form)
  }

  /**
   * リフレッシュトークンからアクセストークンを再発行する。
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    this.appendOAuthClientCredentials(form)
    return this.requestToken(form)
  }

  /**
   * JSON APIエンドポイントを呼び出し、レスポンスをZodで検証する。
   */
  private async request<T>(
    method: HttpMethod,
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = new URL(`${this.apiBaseUrl}${path}`)
    appendQueryParams(url, options.query)

    const headers: HeadersInit = {
      Accept: 'application/json',
    }

    if (options.token) headers['x-access-token'] = options.token

    const init: RequestInit = {
      method,
      headers,
    }

    if (method === 'POST' && options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey
    }

    if (method === 'POST' && options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    try {
      const response = await this.fetcher(url, init)
      const responseBody = await readResponseBody(response)

      if (!response.ok) throw buildApiError(response.status, response.statusText, responseBody)

      const parsed = schema.safeParse(responseBody)
      if (!parsed.success) {
        throw new GmoApiError(
          response.status,
          'VALIDATION_ERROR',
          'GMO API response validation failed',
          parsed.error.flatten()
        )
      }

      return parsed.data
    } catch (error) {
      logClientError(path, error)
      if (error instanceof GmoApiError) throw error
      throw new GmoNetworkError('NETWORK_ERROR', getErrorMessage(error), error)
    }
  }

  /**
   * OAuthトークンエンドポイントを呼び出し、レスポンスをZodで検証する。
   */
  private async requestToken(form: URLSearchParams): Promise<OAuthTokenResponse> {
    const url = `${this.authBaseUrl}/token`

    try {
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      })
      const responseBody = await readResponseBody(response)

      if (!response.ok) throw buildApiError(response.status, response.statusText, responseBody)

      const parsed = OAuthTokenResponseSchema.safeParse(responseBody)
      if (!parsed.success) {
        throw new GmoApiError(
          response.status,
          'VALIDATION_ERROR',
          'GMO OAuth response validation failed',
          parsed.error.flatten()
        )
      }

      return parsed.data
    } catch (error) {
      logClientError('/auth/token', error)
      if (error instanceof GmoApiError) throw error
      throw new GmoNetworkError('NETWORK_ERROR', getErrorMessage(error), error)
    }
  }

  /**
   * OAuthリクエストへクライアント認証情報を追加する。
   */
  private appendOAuthClientCredentials(form: URLSearchParams): void {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new GmoAuthError(0, 'CONFIG_ERROR', 'GMO OAuth client credentials are missing')
    }

    form.set('client_id', this.config.clientId)
    form.set('client_secret', this.config.clientSecret)
  }
}

/**
 * 接続情報なしで開発できるGMOダミークライアント。
 */
export class DummyGmoClient implements GmoClient {
  /**
   * 1件のダミー口座を返す。
   */
  async listAccounts(_token: string): Promise<AccountsResponse> {
    return AccountsResponseSchema.parse({
      accounts: [
        {
          accountId: '101011234567',
          branchCode: '101',
          branchName: 'ダミー支店',
          accountTypeCode: '1',
          accountNumber: '1234567',
          accountName: 'プラスタスタス カ',
          accountNameKana: 'プラスタスタス カ',
          transferLimitAmount: '5000000',
        },
      ],
    })
  }

  /**
   * 500万円のダミー残高を返す。
   */
  async getBalance(_token: string, accountId = '101011234567'): Promise<BalanceResponse> {
    return BalanceResponseSchema.parse({
      balances: [
        {
          accountId,
          balance: '5000000',
          withdrawableAmount: '5000000',
          currencyCode: 'JPY',
        },
      ],
    })
  }

  /**
   * 成功扱いのダミー振込受付結果を返す。
   */
  async requestTransfer(
    _token: string,
    idempotencyKey: string,
    payload: TransferRequest
  ): Promise<TransferRequestResponse> {
    if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new GmoApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Invalid GMO Idempotency-Key')
    }

    const parsedPayload = TransferRequestSchema.parse(payload)
    return TransferRequestResponseSchema.parse({
      applyNo: createDummyApplyNo(),
      resultCode: '1',
      applyEndDatetime: new Date().toISOString(),
      accountId: parsedPayload.accountId,
    })
  }

  /**
   * 成功ステータスのダミー振込状況を返す。
   */
  async getTransferStatus(_token: string, query: TransferStatusQuery): Promise<TransferStatusResponse> {
    const parsedQuery = TransferStatusQuerySchema.parse(query)
    return createDummyTransferStatusResponse(parsedQuery.accountId, parsedQuery.applyNo)
  }

  /**
   * 成功ステータスのダミー振込依頼結果を返す。
   */
  async getTransferRequestResult(
    _token: string,
    accountId: string,
    applyNo: string
  ): Promise<TransferRequestResultResponse> {
    return createDummyTransferStatusResponse(accountId, applyNo)
  }

  /**
   * 1件143円としてダミー振込手数料を返す。
   */
  async getTransferFee(_token: string, payload: TransferFeeRequest): Promise<TransferFeeResponse> {
    const parsedPayload = TransferFeeRequestSchema.parse(payload)
    const transferFeeDetails = parsedPayload.transfers.map((transfer) => ({
      itemId: transfer.itemId,
      transferAmount: transfer.transferAmount,
      transferFee: '143',
      beneficiaryBankCode: transfer.beneficiaryBankCode,
      beneficiaryBranchCode: transfer.beneficiaryBranchCode,
      accountTypeCode: transfer.accountTypeCode,
      accountNumber: transfer.accountNumber,
      beneficiaryName: transfer.beneficiaryName,
    }))

    return TransferFeeResponseSchema.parse({
      totalCount: String(transferFeeDetails.length),
      totalAmount: parsedPayload.totalAmount,
      totalFee: String(transferFeeDetails.length * 143),
      transferFeeDetails,
    })
  }

  /**
   * ダミーOAuthトークンを返す。
   */
  async exchangeCodeForToken(_code: string, _redirectUri: string): Promise<OAuthTokenResponse> {
    return createDummyTokenResponse()
  }

  /**
   * ダミーOAuthトークンを再発行する。
   */
  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokenResponse> {
    return createDummyTokenResponse()
  }
}

/**
 * 環境変数に基づいてGMOクライアントを生成する。
 */
export function createGmoClient(): GmoClient {
  if (process.env.GMO_AOZORA_MODE === 'real') {
    return new RealGmoClient({
      baseUrl: readRequiredEnv('GMO_AOZORA_BASE_URL'),
      clientId: readRequiredEnv('GMO_AOZORA_CLIENT_ID'),
      clientSecret: readRequiredEnv('GMO_AOZORA_CLIENT_SECRET'),
      accountType: readAccountTypeEnv(),
    })
  }

  return new DummyGmoClient()
}

/**
 * GMO APIレスポンス本文をJSONとして読む。
 */
async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return {
      errorCode: `HTTP_${response.status}`,
      errorMessage: text,
    }
  }
}

/**
 * GMO APIのHTTPエラーレスポンスをカスタムエラーへ変換する。
 */
function buildApiError(statusCode: number, statusText: string, body: unknown): GmoApiError {
  const parsed = z.object({
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    errorDetails: z.unknown().optional(),
  }).passthrough().safeParse(body)

  const errorCode = parsed.success ? parsed.data.errorCode ?? `HTTP_${statusCode}` : `HTTP_${statusCode}`
  const message = parsed.success ? parsed.data.errorMessage ?? statusText : statusText
  const details = parsed.success ? parsed.data.errorDetails ?? body : body

  if (statusCode === 401 || statusCode === 403) {
    return new GmoAuthError(statusCode, errorCode, message, details)
  }

  return new GmoApiError(statusCode, errorCode, message, details)
}

/**
 * 送信前ペイロードをZodで検証する。
 */
function parseOutgoingPayload<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, payload: unknown, message: string): T {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new GmoApiError(400, 'VALIDATION_ERROR', message, parsed.error.flatten())
  }
  return parsed.data
}

/**
 * URLへundefinedを除いたquery paramsを付与する。
 */
function appendQueryParams(url: URL, query?: Record<string, string | number | boolean | undefined>): void {
  if (!query) return

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
}

/**
 * GMO APIのベースURLを口座種別と環境に応じて解決する。
 */
function buildApiBaseUrl(baseUrl: string, accountType: GmoAccountType): string {
  const trimmed = trimTrailingSlash(baseUrl)
  if (/\/(?:ganb\/api\/(?:corporation|personal)|corporate|personal)\/v1$/.test(trimmed)) {
    return trimmed
  }

  const host = safeUrlHost(trimmed)
  if (host.includes('sunabar')) {
    return `${trimmed}${accountType === 'private' ? '/personal/v1' : '/corporate/v1'}`
  }

  return `${trimmed}${accountType === 'private' ? '/ganb/api/personal/v1' : '/ganb/api/corporation/v1'}`
}

/**
 * GMO OAuthのベースURLを解決する。
 */
function buildAuthBaseUrl(baseUrl: string): string {
  try {
    return `${new URL(baseUrl).origin}/ganb/api/auth/v1`
  } catch {
    return `${trimTrailingSlash(baseUrl)}/ganb/api/auth/v1`
  }
}

/**
 * 末尾スラッシュを除去する。
 */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * URL文字列からhostを安全に取り出す。
 */
function safeUrlHost(value: string): string {
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

/**
 * 必須環境変数を読む。
 */
function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new GmoApiError(0, 'CONFIG_ERROR', `${name} is required for GMO real mode`)
  return value
}

/**
 * GMO口座種別の環境変数を読む。
 */
function readAccountTypeEnv(): GmoAccountType {
  return process.env.GMO_AOZORA_ACCOUNT_TYPE === 'private' ? 'private' : 'corporate'
}

/**
 * クライアント内部エラーを既存loggerへ記録する。
 */
function logClientError(path: string, error: unknown): void {
  try {
    logTrace({
      action: 'GMO_API_CLIENT_ERROR',
      data: {
        path,
        message: getErrorMessage(error),
        statusCode: error instanceof GmoApiError ? error.statusCode : undefined,
        errorCode: error instanceof GmoApiError ? error.errorCode : undefined,
      },
    })
  } catch {
    console.error('[GMO_API_CLIENT_ERROR]', path, error)
  }
}

/**
 * ダミー振込受付番号を生成する。
 */
function createDummyApplyNo(): string {
  return Date.now().toString().slice(-16).padStart(16, '0')
}

/**
 * ダミー振込状況レスポンスを生成する。
 */
function createDummyTransferStatusResponse(accountId: string, applyNo = createDummyApplyNo()): TransferStatusResponse {
  return TransferStatusResponseSchema.parse({
    accountId,
    transferDetails: [
      {
        accountId,
        applyNo,
        transferStatus: 20,
        transferAccepts: [
          {
            accountId,
            applyNo,
            applyStatus: 6,
            applyEndDatetime: new Date().toISOString(),
            transferDesignatedDate: new Date().toISOString().slice(0, 10),
            transferDateHolidayCode: '1',
            totalCount: '1',
            totalAmount: '1000',
            totalFee: '143',
            transferStatus: 20,
            transferResponses: [
              {
                itemId: '1',
                transferAmount: '1000',
                transferFee: '143',
                transferStatus: 20,
                transferDetailStatus: '20',
                beneficiaryBankCode: '0001',
                beneficiaryBranchCode: '001',
                accountTypeCode: '1',
                accountNumber: '1234567',
                beneficiaryName: 'サトウ ミサキ',
              },
            ],
          },
        ],
      },
    ],
  })
}

/**
 * ダミーOAuthトークンレスポンスを生成する。
 */
function createDummyTokenResponse(): OAuthTokenResponse {
  return OAuthTokenResponseSchema.parse({
    access_token: 'dummy-access-token',
    refresh_token: 'dummy-refresh-token',
    token_type: 'Bearer',
    expires_in: 2592000,
    scope: 'openid offline_access corp:account corp:transfer',
  })
}
