import { NextRequest, NextResponse } from 'next/server';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import {
    fetchOverviewReport,
    fetchTrafficReport,
    fetchPagesReport,
    fetchLpPerformanceReport,
    fetchComparisonReport,
    testConnection,
} from '@/src/lib/ga-client';

export const dynamic = 'force-dynamic';

const REPORT_TYPES = ['overview', 'traffic', 'pages', 'lp-performance', 'compare', 'test'] as const;
type ReportType = (typeof REPORT_TYPES)[number];

export async function GET(request: NextRequest) {
    // システム管理者認証チェック
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const reportType = searchParams.get('reportType') as ReportType;

        // reportType バリデーション
        if (!reportType || !REPORT_TYPES.includes(reportType)) {
            return NextResponse.json(
                { error: `reportType が不正です。有効値: ${REPORT_TYPES.join(', ')}` },
                { status: 400 }
            );
        }

        // 接続テストは日付不要
        if (reportType === 'test') {
            const result = await testConnection();
            return NextResponse.json(result, {
                headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
            });
        }

        // 日付バリデーション
        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'startDate と endDate が必須です (YYYY-MM-DD形式, JST)' },
                { status: 400 }
            );
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return NextResponse.json(
                { error: '日付形式が不正です。YYYY-MM-DD を使用してください。' },
                { status: 400 }
            );
        }

        // レポート取得
        let data;
        switch (reportType) {
            case 'overview':
                data = await fetchOverviewReport(startDate, endDate);
                break;
            case 'traffic':
                data = await fetchTrafficReport(startDate, endDate);
                break;
            case 'pages':
                data = await fetchPagesReport(startDate, endDate);
                break;
            case 'lp-performance':
                data = await fetchLpPerformanceReport(startDate, endDate);
                break;
            case 'compare':
                data = await fetchComparisonReport(startDate, endDate);
                break;
        }

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        console.error('GA4 Analytics API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'GA4データの取得に失敗しました', details: errorMessage },
            { status: 500 }
        );
    }
}
