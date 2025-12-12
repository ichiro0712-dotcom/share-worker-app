import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webPush from 'web-push';

// VAPID設定
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@example.com';

webPush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

export async function POST(request: NextRequest) {
    try {
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

        const payload = JSON.stringify({
            title: title || 'S WORKS',
            body: message || '新しいお知らせがあります',
            url: url || '/',
        });

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
                        payload
                    );
                    return { success: true, endpoint: sub.endpoint };
                } catch (error: any) {
                    // 無効な購読は削除
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        await prisma.pushSubscription.delete({
                            where: { id: sub.id },
                        });
                    }
                    return { success: false, endpoint: sub.endpoint, error: error.message };
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
