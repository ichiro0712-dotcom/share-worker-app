/**
 * ユーザー操作ログ記録システム
 *
 * 2種類のログ記録:
 * - logTrace(): Vercel Logsのみ（全操作用、3日で消える）
 * - logActivity(): Vercel Logs + DB保存（重要操作用、長期保存）
 *
 * バージョン情報:
 * - 各ログにGit Commit SHAとDeployment IDを自動付与
 * - デバッグ時にどのバージョンで問題が発生したか特定可能
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getVersionForLog } from '@/lib/version'
import { getDeviceInfoAndIp, simplifyDeviceInfo } from '@/src/lib/device-info'

// ========== 型定義 ==========

export type UserType = 'WORKER' | 'FACILITY' | 'SYSTEM_ADMIN' | 'GUEST'
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
  | 'SYSTEM_SETTING_UPDATE'    // システム設定更新
  | 'SYSTEM_SETTING_UPDATE_FAILED' // システム設定更新失敗
  // ========== 勤怠管理系 ==========
  | 'ATTENDANCE_CHECK_IN'            // 出勤打刻
  | 'ATTENDANCE_CHECK_IN_FAILED'     // 出勤打刻失敗
  | 'ATTENDANCE_CHECK_OUT'           // 退勤打刻
  | 'ATTENDANCE_CHECK_OUT_FAILED'    // 退勤打刻失敗
  | 'ATTENDANCE_MODIFY_CREATE'       // 勤怠変更申請作成
  | 'ATTENDANCE_MODIFY_CREATE_FAILED'// 勤怠変更申請作成失敗
  | 'ATTENDANCE_MODIFY_RESUBMIT'     // 勤怠変更申請再提出
  | 'ATTENDANCE_MODIFY_RESUBMIT_FAILED' // 勤怠変更申請再提出失敗
  | 'ATTENDANCE_MODIFY_APPROVE'     // 勤怠変更申請承認
  | 'ATTENDANCE_MODIFY_APPROVE_FAILED' // 勤怠変更申請承認失敗
  | 'ATTENDANCE_MODIFY_REJECT'      // 勤怠変更申請却下
  | 'ATTENDANCE_MODIFY_REJECT_FAILED' // 勤怠変更申請却下失敗
  | 'QR_CODE_REGENERATE'            // QRコード再生成
  | 'QR_CODE_REGENERATE_FAILED'     // QRコード再生成失敗
  | 'EMERGENCY_CODE_UPDATE'         // 緊急コード更新
  | 'EMERGENCY_CODE_UPDATE_FAILED'  // 緊急コード更新失敗
  // ========== CSV出力系 ==========
  | 'CSV_EXPORT_CLIENT'        // 取引先情報CSV出力
  | 'CSV_EXPORT_CLIENT_FAILED' // 取引先情報CSV出力失敗
  | 'CSV_EXPORT_JOB'           // 案件情報CSV出力
  | 'CSV_EXPORT_JOB_FAILED'    // 案件情報CSV出力失敗
  | 'CSV_EXPORT_SHIFT'         // シフト情報CSV出力
  | 'CSV_EXPORT_SHIFT_FAILED'  // シフト情報CSV出力失敗
  | 'CSV_EXPORT_STAFF'         // スタッフ情報CSV出力
  | 'CSV_EXPORT_STAFF_FAILED'  // スタッフ情報CSV出力失敗
  | 'CSV_EXPORT_ATTENDANCE'    // 勤怠情報CSV出力
  | 'CSV_EXPORT_ATTENDANCE_FAILED' // 勤怠情報CSV出力失敗
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

  // デバイス情報とIPアドレスの自動取得（未指定時のみ）
  let userAgent = params.userAgent
  let ipAddress = params.ipAddress
  let deviceInfo = null

  if (!userAgent || !ipAddress) {
    try {
      // headers()を1回だけ呼び出して両方取得（最適化）
      const { deviceInfo: autoDeviceInfo, ipAddress: autoIpAddress } = await getDeviceInfoAndIp()

      if (!userAgent) {
        userAgent = autoDeviceInfo.userAgent
        deviceInfo = simplifyDeviceInfo(autoDeviceInfo)
      }
      if (!ipAddress) {
        ipAddress = autoIpAddress
      }
    } catch (error) {
      // headers()が使えないコンテキストでは無視（クライアントコンポーネント等）
      // エラーログは出さない（正常な動作）
    }
  }

  // センシティブデータをマスク
  const sanitizedRequestData = sanitizeData(params.requestData)

  // デバイス情報をrequest_dataに追加（取得できた場合）
  const enrichedRequestData = deviceInfo
    ? { ...sanitizedRequestData, device: deviceInfo }
    : sanitizedRequestData

  const logData = {
    timestamp,
    user_type: params.userType,
    user_id: params.userId,
    user_email: params.userEmail,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    request_data: enrichedRequestData,
    result: params.result || 'SUCCESS',
    error_message: params.errorMessage,
    url: params.url,
    user_agent: userAgent,
    ip_address: ipAddress,
  }

  // 1. Vercel Logs に出力（リアルタイム確認用）
  const logLevel = params.result === 'ERROR' ? 'error' : 'log'
  console[logLevel](`[ACTIVITY] ${params.action}`, JSON.stringify(logData))

  // 2. DB に保存（長期保存用）
  try {
    // バージョン情報を取得
    const versionInfo = getVersionForLog()

    await prisma.userActivityLog.create({
      data: {
        user_type: params.userType,
        user_id: params.userId,
        user_email: params.userEmail,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId,
        request_data: enrichedRequestData as Prisma.InputJsonValue | undefined,
        response_data: params.responseData as Prisma.InputJsonValue | undefined,
        result: params.result || 'SUCCESS',
        error_message: params.errorMessage,
        error_stack: params.errorStack,
        url: params.url,
        user_agent: userAgent,
        ip_address: ipAddress,
        // バージョン情報を自動付与
        app_version: versionInfo.app_version,
        deployment_id: versionInfo.deployment_id,
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
    'emergency_code',    // 緊急コード
    'emergencycode',     // 緊急コード（キャメルケース）
    'qr_token',          // QRトークン
    'qrtoken',           // QRトークン（キャメルケース）
    'qr_secret',         // QRシークレット
    'qrsecret',          // QRシークレット（キャメルケース）
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
