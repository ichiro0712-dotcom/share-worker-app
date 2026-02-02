import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // システム管理者認証チェック
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const targetType = searchParams.get('target_type') || 'WORKER';
        const channel = searchParams.get('channel');
        const search = searchParams.get('search');
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
