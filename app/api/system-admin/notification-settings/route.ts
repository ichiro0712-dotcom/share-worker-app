import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // システム管理者認証チェック
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
        const settings = await prisma.notificationSetting.findMany({
            orderBy: [
                { target_type: 'asc' },
                { id: 'asc' },
            ],
        });
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Failed to fetch notification settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}
