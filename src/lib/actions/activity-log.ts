'use server';

import { prisma } from '@/lib/prisma';
import { getDeviceInfo, getClientIpAddress, simplifyDeviceInfo } from '../device-info';

/**
 * ユーザー操作ログの保存
 */
interface LogActivityParams {
  // 誰が
  userType: 'WORKER' | 'FACILITY' | 'GUEST';
  userId?: number;
  userEmail?: string;

  // 何をした
  action: string;
  targetType?: string;
  targetId?: number;

  // どんなデータ
  requestData?: Record<string, any>;
  responseData?: Record<string, any>;

  // 結果
  result?: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  errorStack?: string;

  // コンテキスト
  url?: string;
}

/**
 * 操作ログを保存（デバイス情報・IPアドレスを自動取得）
 */
export async function logUserActivity(params: LogActivityParams) {
  try {
    // デバイス情報を取得
    const deviceInfo = await getDeviceInfo();
    const ipAddress = await getClientIpAddress();

    // バージョン情報を取得（環境変数から）
    const appVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;

    // 簡略化されたデバイス情報をrequest_dataに追加
    const enrichedRequestData = {
      ...params.requestData,
      device: simplifyDeviceInfo(deviceInfo),
    };

    await prisma.userActivityLog.create({
      data: {
        user_type: params.userType,
        user_id: params.userId,
        user_email: params.userEmail,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId,
        request_data: enrichedRequestData,
        response_data: params.responseData,
        result: params.result || 'SUCCESS',
        error_message: params.errorMessage,
        error_stack: params.errorStack,
        url: params.url,
        user_agent: deviceInfo.userAgent,
        ip_address: ipAddress,
        app_version: appVersion,
        deployment_id: deploymentId,
      },
    });
  } catch (error) {
    // ログ保存に失敗してもアプリケーションのエラーにしない
    console.error('Failed to log user activity:', error);
  }
}

/**
 * ログインアクティビティを記録
 */
export async function logLogin(params: {
  userType: 'WORKER' | 'FACILITY';
  userId: number;
  userEmail: string;
}) {
  await logUserActivity({
    userType: params.userType,
    userId: params.userId,
    userEmail: params.userEmail,
    action: 'LOGIN',
    result: 'SUCCESS',
  });
}

/**
 * ログアウトアクティビティを記録
 */
export async function logLogout(params: {
  userType: 'WORKER' | 'FACILITY';
  userId: number;
  userEmail: string;
}) {
  await logUserActivity({
    userType: params.userType,
    userId: params.userId,
    userEmail: params.userEmail,
    action: 'LOGOUT',
    result: 'SUCCESS',
  });
}

/**
 * プロフィール更新アクティビティを記録
 */
export async function logProfileUpdate(params: {
  userType: 'WORKER' | 'FACILITY';
  userId: number;
  userEmail: string;
  changes: Record<string, any>;
}) {
  await logUserActivity({
    userType: params.userType,
    userId: params.userId,
    userEmail: params.userEmail,
    action: 'PROFILE_UPDATE',
    requestData: { changes: params.changes },
    result: 'SUCCESS',
  });
}

/**
 * 求人応募アクティビティを記録
 */
export async function logJobApplication(params: {
  userId: number;
  userEmail: string;
  jobId: number;
  workDateId: number;
}) {
  await logUserActivity({
    userType: 'WORKER',
    userId: params.userId,
    userEmail: params.userEmail,
    action: 'JOB_APPLY',
    targetType: 'Job',
    targetId: params.jobId,
    requestData: {
      work_date_id: params.workDateId,
    },
    result: 'SUCCESS',
  });
}

/**
 * エラーアクティビティを記録
 */
export async function logError(params: {
  userType: 'WORKER' | 'FACILITY' | 'GUEST';
  userId?: number;
  userEmail?: string;
  action: string;
  errorMessage: string;
  errorStack?: string;
  url?: string;
}) {
  await logUserActivity({
    userType: params.userType,
    userId: params.userId,
    userEmail: params.userEmail,
    action: params.action,
    result: 'ERROR',
    errorMessage: params.errorMessage,
    errorStack: params.errorStack,
    url: params.url,
  });
}
