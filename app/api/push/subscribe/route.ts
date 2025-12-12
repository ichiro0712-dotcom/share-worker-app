import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { subscription, userType } = body;

        if (!subscription || !userType) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const { endpoint, keys } = subscription;
        const { p256dh, auth } = keys;

        // セッションからユーザー情報を取得
        const session = await getServerSession(authOptions);

        // ユーザーIDの取得（認証されていない場合はnull）
        let userId: number | null = null;
        let adminId: number | null = null;

        if (session?.user) {
            if (userType === 'worker') {
                userId = parseInt(session.user.id as string, 10);
            } else if (userType === 'facility_admin') {
                adminId = parseInt(session.user.id as string, 10);
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
