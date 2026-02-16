import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { endpoint } = body;

        if (!endpoint) {
            return NextResponse.json(
                { error: 'Missing endpoint' },
                { status: 400 }
            );
        }

        // worker(NextAuth) または facility_admin(iron-session) のいずれかで認証
        const session = await getServerSession(authOptions);
        const adminSession = await getFacilityAdminSessionData();

        if (session?.user?.id) {
            const userId = parseInt(session.user.id);
            if (!isNaN(userId)) {
                await prisma.pushSubscription.deleteMany({
                    where: { endpoint, user_id: userId },
                });
                return NextResponse.json({ success: true });
            }
        }

        if (adminSession?.adminId) {
            await prisma.pushSubscription.deleteMany({
                where: { endpoint, admin_id: adminSession.adminId },
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        return NextResponse.json(
            { error: 'Failed to unsubscribe' },
            { status: 500 }
        );
    }
}
