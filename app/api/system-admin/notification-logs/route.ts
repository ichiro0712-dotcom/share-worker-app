import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // super_admin権限チェック
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    if (session.role !== 'super_admin') {
        return NextResponse.json({ error: 'この操作には特権管理者権限が必要です' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const targetType = searchParams.get('target_type') || 'WORKER';
        const channel = searchParams.get('channel');
        const search = searchParams.get('search');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const where: any = {
            target_type: targetType,
        };

        if (channel && channel !== 'ALL') {
            where.channel = channel;
        }

        if (search) {
            where.OR = [
                { recipient_name: { contains: search, mode: 'insensitive' } },
                { recipient_email: { contains: search, mode: 'insensitive' } },
            ];
        }

        // 日付範囲フィルタ（JSTとして解釈）
        if (dateFrom || dateTo) {
            where.created_at = {};
            if (dateFrom) {
                where.created_at.gte = new Date(`${dateFrom}T00:00:00+09:00`);
            }
            if (dateTo) {
                const endDate = new Date(`${dateTo}T00:00:00+09:00`);
                endDate.setDate(endDate.getDate() + 1);
                where.created_at.lt = endDate;
            }
        }

        const [logs, total] = await Promise.all([
            prisma.notificationLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.notificationLog.count({ where }),
        ]);

        return NextResponse.json({
            logs,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        console.error('Failed to fetch notification logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
