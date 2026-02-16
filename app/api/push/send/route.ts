import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webPush from 'web-push';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

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
            return NextResponse.json(
                { error: 'No subscriptions found' },
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
                try {
                    await webPush.sendNotification(
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
                    return { success: true, endpoint: sub.endpoint };
                } catch (error: any) {
                    // 無効な購読は削除（404: Not Found, 410: Gone, 403: Forbidden/VAPID不一致）
                    if (error.statusCode === 404 || error.statusCode === 410 || error.statusCode === 403) {
                        await prisma.pushSubscription.delete({
                            where: { id: sub.id },
                        }).catch((delErr: any) => {
                            console.warn(`[Push] Failed to delete stale subscription ${sub.id}:`, delErr.message);
                        });
                    }
                    return { success: false, endpoint: sub.endpoint, statusCode: error.statusCode, error: error.message };
                }
            })
        );

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
