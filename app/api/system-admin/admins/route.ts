import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSystemAdminAuth, requireSuperAdminAuth } from '@/lib/system-admin-session-server';

export async function GET() {
    try {
        // 管理者一覧はsuper_adminのみ
        await requireSuperAdminAuth();

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
        const auth = await requireSystemAdminAuth();

        const { id, notification_email } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
        }

        // admin権限の場合は自分自身の通知メールのみ変更可能
        if (auth.role !== 'super_admin' && auth.adminId !== id) {
            return NextResponse.json({ error: 'この操作には特権管理者権限が必要です' }, { status: 403 });
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
