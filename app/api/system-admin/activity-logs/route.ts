import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // フィルタパラメータ
        const userType = searchParams.get('user_type'); // WORKER | FACILITY | GUEST | ALL
        const result = searchParams.get('result'); // SUCCESS | ERROR | ALL
        const action = searchParams.get('action'); // 特定のアクション
        const search = searchParams.get('search'); // ユーザー名・メール検索
        const userId = searchParams.get('user_id'); // 特定ユーザーの追跡用
        const dateFrom = searchParams.get('date_from'); // 日付範囲（開始）
        const dateTo = searchParams.get('date_to'); // 日付範囲（終了）
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const errorsOnly = searchParams.get('errors_only') === 'true'; // エラーのみ

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        // エラーのみフィルタ（エラー一覧タブ用）
        if (errorsOnly) {
            where.result = 'ERROR';
        } else if (result && result !== 'ALL') {
            where.result = result;
        }

        // ユーザータイプフィルタ
        if (userType && userType !== 'ALL') {
            where.user_type = userType;
        }

        // アクションフィルタ
        if (action && action !== 'ALL') {
            where.action = action;
        }

        // 特定ユーザーの追跡（ユーザー追跡タブ用）
        if (userId) {
            where.user_id = parseInt(userId);
        }

        // 検索（名前・メール）
        if (search) {
            where.OR = [
                { user_email: { contains: search, mode: 'insensitive' } },
            ];
        }

        // 日付範囲フィルタ
        if (dateFrom || dateTo) {
            where.created_at = {};
            if (dateFrom) {
                where.created_at.gte = new Date(dateFrom);
            }
            if (dateTo) {
                // dateTo の終わりまでを含めるために翌日の0時に設定
                const endDate = new Date(dateTo);
                endDate.setDate(endDate.getDate() + 1);
                where.created_at.lt = endDate;
            }
        }

        const [logs, total, errorCount24h] = await Promise.all([
            prisma.userActivityLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.userActivityLog.count({ where }),
            // 直近24時間のエラー数（ダッシュボード表示用）
            prisma.userActivityLog.count({
                where: {
                    result: 'ERROR',
                    created_at: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        // アクション一覧を取得（フィルタ用）
        const distinctActions = await prisma.userActivityLog.findMany({
            select: { action: true },
            distinct: ['action'],
            orderBy: { action: 'asc' },
        });

        return NextResponse.json({
            logs,
            totalPages: Math.ceil(total / limit),
            total,
            errorCount24h,
            availableActions: distinctActions.map(a => a.action),
        });
    } catch (error) {
        console.error('Failed to fetch activity logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
