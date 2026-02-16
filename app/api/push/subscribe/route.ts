import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { subscription, userType } = body;

        const VALID_USER_TYPES = ['worker', 'facility_admin'] as const;

        if (!subscription || !userType) {
            return NextResponse.json(
                { error: 'Missing required fields: subscription and userType are required' },
                { status: 400 }
            );
        }

        if (!VALID_USER_TYPES.includes(userType)) {
            return NextResponse.json(
                { error: 'Invalid userType: must be "worker" or "facility_admin"' },
                { status: 400 }
            );
        }

        const { endpoint, keys } = subscription;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json(
                { error: 'Invalid subscription: endpoint, p256dh, and auth are required' },
                { status: 400 }
            );
        }

        const { p256dh, auth } = keys;

        // セッションからユーザー情報を取得
        const session = await getServerSession(authOptions);

        // ユーザーIDの取得（認証されていない場合はnull）
        let userId: number | null = null;
        let adminId: number | null = null;

        if (session?.user) {
            const parsedId = parseInt(session.user.id as string, 10);
            if (!isNaN(parsedId)) {
                if (userType === 'worker') {
                    userId = parsedId;
                } else if (userType === 'facility_admin') {
                    adminId = parsedId;
                }
            } else {
                console.warn('Push subscribe: session.user.id is not a valid number:', session.user.id);
            }
        }

        // 既存の購読を更新、なければ作成
        const pushSubscription = await prisma.pushSubscription.upsert({
            where: { endpoint },
            update: {
                p256dh,
                auth,
                user_id: userId,
                admin_id: adminId,
                user_type: userType,
                user_agent: request.headers.get('user-agent') || null,
                updated_at: new Date(),
            },
            create: {
                endpoint,
                p256dh,
                auth,
                user_id: userId,
                admin_id: adminId,
                user_type: userType,
                user_agent: request.headers.get('user-agent') || null,
            },
        });

        return NextResponse.json({
            success: true,
            id: pushSubscription.id
        });
    } catch (error) {
        console.error('Push subscribe error:', error);
        return NextResponse.json(
            { error: 'Failed to save subscription' },
            { status: 500 }
        );
    }
}
