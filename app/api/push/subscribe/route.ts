import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

const CURRENT_SUBSCRIPTION_VERSION = "2";
const SUBSCRIPTION_MAX_AGE_DAYS = 30;

function shouldRepair(sub: any): { repair: boolean; reason?: 'age' | 'version' | 'failures' } {
    // T1: subscription age > 30 days
    const ageMs = Date.now() - new Date(sub.updated_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > SUBSCRIPTION_MAX_AGE_DAYS) return { repair: true, reason: 'age' };

    // T2: version mismatch
    if (sub.subscription_version !== CURRENT_SUBSCRIPTION_VERSION) return { repair: true, reason: 'version' };

    // T3: consecutive failures >= 3 within 72h
    if (sub.consecutive_failures >= 3 && sub.last_failure_at) {
        const failureAgeMs = Date.now() - new Date(sub.last_failure_at).getTime();
        if (failureAgeMs < 72 * 60 * 60 * 1000) return { repair: true, reason: 'failures' };
    }

    return { repair: false };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { subscription, userType, replaceEndpoint } = body;

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

        // userTypeに応じたセッション認証
        let userId: number | null = null;
        let adminId: number | null = null;

        if (userType === 'worker') {
            const session = await getServerSession(authOptions);
            if (!session?.user?.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const parsedId = parseInt(session.user.id as string, 10);
            if (isNaN(parsedId)) {
                return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
            }
            userId = parsedId;
        } else if (userType === 'facility_admin') {
            const adminSession = await getFacilityAdminSessionData();
            if (!adminSession?.adminId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            adminId = adminSession.adminId;
        }

        // replaceEndpoint: 修復フロー（古いサブスクリプションを削除して新しいものに置き換え）
        if (replaceEndpoint) {
            const result = await prisma.$transaction(async (tx) => {
                // 古いエンドポイントを削除（自己削除防止）
                await tx.pushSubscription.deleteMany({
                    where: {
                        endpoint: replaceEndpoint,
                        NOT: { endpoint },
                    },
                });

                // 新しいサブスクリプションをupsert
                return tx.pushSubscription.upsert({
                    where: { endpoint },
                    update: {
                        p256dh,
                        auth,
                        user_id: userId,
                        admin_id: adminId,
                        user_type: userType,
                        user_agent: request.headers.get('user-agent') || null,
                        subscription_version: CURRENT_SUBSCRIPTION_VERSION,
                        consecutive_failures: 0,
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
                        subscription_version: CURRENT_SUBSCRIPTION_VERSION,
                    },
                });
            });

            return NextResponse.json({
                success: true,
                id: result.id,
                needs_repair: false,
            });
        }

        // 通常の同期フロー：既存の購読を更新、なければ作成
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
                subscription_version: CURRENT_SUBSCRIPTION_VERSION,
            },
        });

        const repairCheck = shouldRepair(pushSubscription);

        return NextResponse.json({
            success: true,
            id: pushSubscription.id,
            needs_repair: repairCheck.repair,
            repair_reason: repairCheck.reason,
        });
    } catch (error) {
        console.error('Push subscribe error:', error);
        return NextResponse.json(
            { error: 'Failed to save subscription' },
            { status: 500 }
        );
    }
}
