import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // システム管理者認証チェック
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
        const id = parseInt(params.id);
        const body = await request.json();

        const updated = await prisma.notificationSetting.update({
            where: { id },
            data: body,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Failed to update notification setting:', error);
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }
}
