/**
 * ユーザー操作ログ記録システム
 *
 * 2種類のログ記録:
 * - logTrace(): Vercel Logsのみ（全操作用、3日で消える）
 * - logActivity(): Vercel Logs + DB保存（重要操作用、長期保存）
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// ========== 型定義 ==========

export type UserType = 'WORKER' | 'FACILITY' | 'GUEST'
export type LogResult = 'SUCCESS' | 'ERROR'

export type ActivityAction =
  // ========== 認証系 ==========
  | 'LOGIN'                    // ログイン成功
  | 'LOGIN_FAILED'             // ログイン失敗
  | 'LOGOUT'                   // ログアウト
  | 'REGISTER'                 // 新規登録
  | 'REGISTER_FAILED'          // 新規登録失敗
  | 'PASSWORD_RESET_REQUEST'   // パスワードリセット要求
  | 'PASSWORD_RESET_COMPLETE'  // パスワードリセット完了
  | 'PASSWORD_RESET_FAILED'    // パスワードリセット失敗
  | 'EMAIL_VERIFY'             // メール認証完了
  | 'EMAIL_VERIFY_FAILED'      // メール認証失敗
  // ========== プロフィール系 ==========
  | 'PROFILE_VIEW'             // プロフィール閲覧
  | 'PROFILE_UPDATE'           // プロフィール更新成功
  | 'PROFILE_UPDATE_FAILED'    // プロフィール更新失敗
  | 'PROFILE_IMAGE_UPLOAD'     // プロフィール画像アップロード
  | 'DOCUMENT_UPLOAD'          // 書類アップロード（身分証・通帳等）
  // ========== 求人応募系 ==========
  | 'JOB_VIEW'                 // 求人詳細閲覧
  | 'JOB_APPLY'                // 求人応募成功
  | 'JOB_APPLY_FAILED'         // 求人応募失敗
  | 'JOB_APPLY_MULTIPLE'       // 複数日程一括応募
  | 'JOB_CANCEL'               // 応募キャンセル（マッチング済み）
  | 'JOB_CANCEL_FAILED'        // 応募キャンセル失敗
  | 'JOB_WITHDRAW'             // 応募取り下げ（審査中）
  | 'OFFER_ACCEPT'             // オファー受諾
  | 'OFFER_ACCEPT_FAILED'      // オファー受諾失敗
  | 'OFFER_DECLINE'            // オファー辞退
  // ========== マッチング系 ==========
  | 'MATCH_CONFIRM'            // マッチング確定
  | 'MATCH_REJECT'             // マッチング却下（施設側）
  // ========== メッセージ系 ==========
  | 'MESSAGE_SEND'             // メッセージ送信成功
  | 'MESSAGE_SEND_FAILED'      // メッセージ送信失敗
  | 'MESSAGE_READ'             // メッセージ既読
  // ========== レビュー系 ==========
  | 'REVIEW_SUBMIT'            // レビュー投稿成功
  | 'REVIEW_SUBMIT_FAILED'     // レビュー投稿失敗
  // ========== ブックマーク系 ==========
  | 'BOOKMARK_ADD'             // ブックマーク追加
  | 'BOOKMARK_REMOVE'          // ブックマーク削除
  // ========== 施設管理者系 ==========
  | 'FACILITY_LOGIN'           // 施設管理者ログイン
  | 'FACILITY_LOGIN_FAILED'    // 施設管理者ログイン失敗
  | 'JOB_CREATE'               // 求人作成
  | 'JOB_CREATE_FAILED'        // 求人作成失敗
  | 'JOB_UPDATE'               // 求人更新
  | 'JOB_DELETE'               // 求人削除
  | 'JOB_PUBLISH'              // 求人公開
  | 'JOB_STOP'                 // 求人停止
  | 'APPLICATION_APPROVE'      // 応募承認
  | 'APPLICATION_REJECT'       // 応募却下
  | 'FACILITY_CANCEL'          // 施設からのキャンセル
  | 'FACILITY_UPDATE'          // 施設情報更新
  | 'FACILITY_ACCOUNT_CREATE'  // 施設アカウント追加
  | 'FACILITY_ACCOUNT_UPDATE'  // 施設アカウント更新
  | 'FACILITY_ACCOUNT_DELETE'  // 施設アカウント削除
  | 'JOB_TEMPLATE_CREATE'      // 求人テンプレート作成
  | 'JOB_TEMPLATE_UPDATE'      // 求人テンプレート更新
  | 'OFFER_TEMPLATE_CREATE'    // オファーテンプレート作成
  | 'OFFER_TEMPLATE_UPDATE'    // オファーテンプレート更新
  | 'OFFER_TEMPLATE_DELETE'    // オファーテンプレート削除
  | 'REVIEW_CREATE'            // レビュー作成
  | 'REVIEW_TEMPLATE_CREATE'   // レビューテンプレート作成
  | 'REVIEW_TEMPLATE_UPDATE'   // レビューテンプレート更新
  | 'REVIEW_TEMPLATE_DELETE'   // レビューテンプレート削除
  | 'BOOKMARK_CREATE'          // ブックマーク作成
  | 'BOOKMARK_DELETE'          // ブックマーク削除
  | 'NOTIFICATION_READ'        // 通知既読
  // ========== システム管理者系 ==========
  | 'SYSTEM_ADMIN_LOGIN'       // システム管理者ログイン
  | 'SYSTEM_ADMIN_LOGIN_FAILED'// システム管理者ログイン失敗
  | 'USER_SUSPEND'             // ユーザー停止
  | 'USER_UNSUSPEND'           // ユーザー停止解除
  | 'FACILITY_SUSPEND'         // 施設停止
  // ========== トレース用（DBには保存しない） ==========
  | 'PAGE_VIEW'                // ページ閲覧
  | 'SEARCH'                   // 検索実行
  | 'FILTER_CHANGE'            // フィルター変更

export interface ActivityLogParams {
  userType: UserType
  userId?: number | null
  userEmail?: string | null
  action: ActivityAction | string
  targetType?: string | null
  targetId?: number | null
  requestData?: Record<string, unknown> | null
  responseData?: Record<string, unknown> | null
  result?: LogResult
  errorMessage?: string | null
  errorStack?: string | null
  url?: string | null
  userAgent?: string | null
  ipAddress?: string | null
}

export interface TraceLogParams {
  action: string
  userId?: number | null
  userType?: UserType
  data?: Record<string, unknown>
  url?: string
}

// ========== 軽量ログ（Vercel Logsのみ） ==========

/**
 * 軽量トレースログ（Vercel Logsのみ）
 * 全操作の記録用。DBには保存しない。
 *
 * @example
 * logTrace({ action: 'PAGE_VIEW', url: '/jobs/123' })
 * logTrace({ action: 'SEARCH', data: { keyword: '介護', prefecture: '東京都' } })
 */
export function logTrace(params: TraceLogParams): void {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    ...params,
  }

  console.log(`[TRACE] ${params.action}`, JSON.stringify(logData))
}

// ========== 重要ログ（Vercel Logs + DB） ==========

/**
 * 重要操作ログ（Vercel Logs + DB保存）
 * デバッグ・調査用に長期保存する。
 *
 * @example
 * await logActivity({
 *   userType: 'WORKER',
 *   userId: 123,
 *   userEmail: 'user@example.com',
 *   action: 'PROFILE_UPDATE',
 *   targetType: 'User',
 *   targetId: 123,
 *   requestData: { name: '田中太郎', phone: '090-1234-5678' },
 *   result: 'SUCCESS',
 * })
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  const timestamp = new Date().toISOString()

  // センシティブデータをマスク
  const sanitizedRequestData = sanitizeData(params.requestData)

  const logData = {
    timestamp,
    user_type: params.userType,
    user_id: params.userId,
    user_email: params.userEmail,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    request_data: sanitizedRequestData,
    result: params.result || 'SUCCESS',
    error_message: params.errorMessage,
    url: params.url,
  }

  // 1. Vercel Logs に出力（リアルタイム確認用）
  const logLevel = params.result === 'ERROR' ? 'error' : 'log'
  console[logLevel](`[ACTIVITY] ${params.action}`, JSON.stringify(logData))

  // 2. DB に保存（長期保存用）
  try {
    await prisma.userActivityLog.create({
      data: {
        user_type: params.userType,
        user_id: params.userId,
        user_email: params.userEmail,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId,
        request_data: sanitizedRequestData as Prisma.InputJsonValue | undefined,
        response_data: params.responseData as Prisma.InputJsonValue | undefined,
        result: params.result || 'SUCCESS',
        error_message: params.errorMessage,
        error_stack: params.errorStack,
        url: params.url,
        user_agent: params.userAgent,
        ip_address: params.ipAddress,
      },
    })
  } catch (dbError) {
    // DB保存失敗してもアプリケーションは止めない
    console.error('[ACTIVITY_LOG_ERROR] Failed to save to DB:', dbError)
  }
}

// ========== ヘルパー関数 ==========

/**
 * センシティブデータをマスクする
 * パスワード、トークンなどをログに残さない
 */
function sanitizeData(data: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!data) return null

  const sensitiveKeys = [
    'password',
    'password_hash',
    'token',
    'secret',
    'authorization',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
  ]

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeData(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * エラーからスタックトレースを取得
 */
export function getErrorStack(error: unknown): string | null {
  if (error instanceof Error) {
    return error.stack || null
  }
  return null
}

/**
 * エラーメッセージを取得
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}
