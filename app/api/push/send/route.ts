import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webPush from 'web-push';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { getVersionForLog } from '@/lib/version';

// VAPID設定をリクエスト時に遅延初期化
let vapidConfigured = false;

function ensureVapidConfig() {
    if (vapidConfigured) return true;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@tastas.jp';

    if (!publicKey || !privateKey) {
        return false;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        // システム管理者認証チェック
        const session = await getSystemAdminSessionData();
        if (!session?.isLoggedIn) {
            return NextResponse.json(
                { error: 'Unauthorized: system admin only' },
                { status: 401 }
            );
        }

        // VAPID設定をリクエスト時に確認
        if (!ensureVapidConfig()) {
            return NextResponse.json(
                { error: 'VAPID keys are not configured' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { userId, userType, title, message, url } = body;

        // 対象ユーザーの購読情報を取得
        const subscriptions = await prisma.pushSubscription.findMany({
            where: userType === 'worker'
                ? { user_id: userId, user_type: 'worker' }
                : { admin_id: userId, user_type: 'facility_admin' },
        });

        if (subscriptions.length === 0) {
            // 購読なしでもログに記録
            const versionInfo = getVersionForLog();
            await prisma.notificationLog.create({
                data: {
                    notification_key: 'SYSTEM_ADMIN_TEST_PUSH',
                    channel: 'PUSH',
                    target_type: userType === 'worker' ? 'WORKER' : 'FACILITY',
                    recipient_id: userId,
                    recipient_name: '',
                    push_title: title || '+タスタス',
                    push_body: message || '新しいお知らせがあります',
                    push_url: url || '/',
                    status: 'FAILED',
                    error_message: 'DB上にプッシュ購読情報がありません',
                    app_version: versionInfo.app_version,
                    deployment_id: versionInfo.deployment_id,
                },
            }).catch((e) => console.error('[Push] Log save failed:', e));

            return NextResponse.json(
                { error: 'プッシュ通知の購読がDBに登録されていません。ユーザーがサイトにアクセスすると自動で再登録されます。' },
                { status: 404 }
            );
        }

        const tag = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const payload = JSON.stringify({
            title: title || '+タスタス',
            body: message || '新しいお知らせがあります',
            url: url || '/',
            tag,
        });

        const pushOptions = {
            TTL: 24 * 60 * 60,
            urgency: 'high' as const,
        };

        // 全デバイスに通知を送信
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const platform = sub.endpoint.includes('apple')
                    ? 'iOS'
                    : sub.endpoint.includes('fcm')
                    ? 'FCM'
                    : 'other';
                try {
                    const response = await webPush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        },
                        payload,
                        pushOptions
                    );
                    const statusCode = response?.statusCode ?? null;
                    const accepted = statusCode === null || (statusCode >= 200 && statusCode < 300);
                    // Reset failure counter on success (only if there were previous failures)
                    if (sub.consecutive_failures > 0) {
                        await prisma.pushSubscription.update({
                            where: { id: sub.id },
                            data: { consecutive_failures: 0, last_failure_at: null },
                        }).catch(() => {});
                    }
                    return {
                        success: accepted,
                        accepted,
                        endpoint: sub.endpoint,
                        platform,
                        contentEncoding: 'aes128gcm',
                        statusCode,
                    };
                } catch (error: any) {
                    // 無効な購読は削除（404: Not Found, 410: Gone, 403: Forbidden/VAPID不一致）
                    if (error.statusCode === 404 || error.statusCode === 410 || error.statusCode === 403) {
                        await prisma.pushSubscription.delete({
                            where: { id: sub.id },
                        }).catch((delErr: any) => {
                            console.warn(`[Push] Failed to delete stale subscription ${sub.id}:`, delErr.message);
                        });
                    } else {
                        // Track non-fatal failures
                        await prisma.pushSubscription.update({
                            where: { id: sub.id },
                            data: {
                                consecutive_failures: { increment: 1 },
                                last_failure_at: new Date(),
                            },
                        }).catch(() => {});
                    }
                    return {
                        success: false,
                        accepted: false,
                        endpoint: sub.endpoint,
                        platform,
                        contentEncoding: 'aes128gcm',
                        statusCode: error.statusCode ?? null,
                        error: error.message,
                    };
                }
            })
        );

        // 送信結果をログに記録
        const successCount = results.filter(
            r => r.status === 'fulfilled' && (r.value as any).success
        ).length;
        const failCount = results.length - successCount;
        const versionInfoResult = getVersionForLog();
        await prisma.notificationLog.create({
            data: {
                notification_key: 'SYSTEM_ADMIN_TEST_PUSH',
                channel: 'PUSH',
                target_type: userType === 'worker' ? 'WORKER' : 'FACILITY',
                recipient_id: userId,
                recipient_name: '',
                push_title: title || '+タスタス',
                push_body: message || '新しいお知らせがあります',
                push_url: url || '/',
                status: failCount === results.length ? 'FAILED' : 'SENT',
                error_message: failCount > 0 ? `${successCount}/${results.length}デバイスに送信成功` : null,
                app_version: versionInfoResult.app_version,
                deployment_id: versionInfoResult.deployment_id,
            },
        }).catch((e) => console.error('[Push] Log save failed:', e));

        return NextResponse.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Push send error:', error);
        return NextResponse.json(
            { error: 'Failed to send notification' },
            { status: 500 }
        );
    }
}
