/**
 * GMO APIから返されたエラーまたはレスポンス検証エラーを表す。
 */
export class GmoApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'GmoApiError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * GMO APIの認証・認可エラーを表す。
 */
export class GmoAuthError extends GmoApiError {
  constructor(statusCode: number, errorCode: string, message: string, details?: unknown) {
    super(statusCode, errorCode, message, details)
    this.name = 'GmoAuthError'
  }
}

/**
 * GMO APIへの通信が成立しなかったネットワークエラーを表す。
 */
export class GmoNetworkError extends GmoApiError {
  constructor(errorCode: string, message: string, details?: unknown) {
    super(0, errorCode, message, details)
    this.name = 'GmoNetworkError'
  }
}
