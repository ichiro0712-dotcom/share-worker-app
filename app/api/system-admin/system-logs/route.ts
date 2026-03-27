import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

// マスカレードトークンなどの機密情報をredactする
function redactSensitiveDetails(details: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!details) return null;
    const redacted = { ...details };
    // トークン情報をredact
    if ('token' in redacted) {
        redacted.token = '***REDACTED***';
    }
    return redacted;
}

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

        const action = searchParams.get('action');
        const targetType = searchParams.get('target_type');
        const adminIdParam = searchParams.get('admin_id');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');

        // クエリパラメータのバリデーション
        const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
        const parsedAdminId = adminIdParam ? parseInt(adminIdParam) : null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (action && action !== 'ALL') {
            where.action = action;
        }

        if (targetType && targetType !== 'ALL') {
            where.target_type = targetType;
        }

        if (parsedAdminId && !isNaN(parsedAdminId)) {
            where.admin_id = parsedAdminId;
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
            prisma.systemLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.systemLog.count({ where }),
        ]);

        // 管理者名を結合
        const adminIds = Array.from(new Set(logs.map(l => l.admin_id)));
        const admins = await prisma.systemAdmin.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, name: true, email: true },
        });
        const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

        const enrichedLogs = logs.map(log => ({
            ...log,
            details: redactSensitiveDetails(log.details as Record<string, unknown> | null),
            admin_name: adminMap[log.admin_id]?.name || `ID:${log.admin_id}`,
            admin_email: adminMap[log.admin_id]?.email || null,
        }));

        // アクション一覧を取得（フィルタ用）
        const distinctActions = await prisma.systemLog.findMany({
            select: { action: true },
            distinct: ['action'],
            orderBy: { action: 'asc' },
        });

        // 対象タイプ一覧を取得
        const distinctTargetTypes = await prisma.systemLog.findMany({
            select: { target_type: true },
            distinct: ['target_type'],
            orderBy: { target_type: 'asc' },
        });

        // 管理者一覧を取得（フィルタ用）
        const allAdmins = await prisma.systemAdmin.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({
            logs: enrichedLogs,
            totalPages: Math.ceil(total / limit),
            total,
            availableActions: distinctActions.map(a => a.action),
            availableTargetTypes: distinctTargetTypes.map(t => t.target_type),
            availableAdmins: allAdmins,
        });
    } catch (error) {
        console.error('Failed to fetch system logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
