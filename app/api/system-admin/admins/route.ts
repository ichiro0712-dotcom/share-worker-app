import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server';

export async function GET() {
    try {
        await requireSystemAdminAuth();

        const admins = await prisma.systemAdmin.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                notification_email: true,
                role: true,
            },
            orderBy: { created_at: 'desc' },
        });

        return NextResponse.json(admins);
    } catch (error) {
        console.error('[GET /api/system-admin/admins] Error:', error);
        return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        await requireSystemAdminAuth();

        const { id, notification_email } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
        }

        await prisma.systemAdmin.update({
            where: { id },
            data: { notification_email: notification_email || null },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[PATCH /api/system-admin/admins] Error:', error);
        return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }
}
