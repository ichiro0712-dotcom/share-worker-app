import { NextResponse } from 'next/server';
import { getDashboardAlerts } from '@/src/lib/system-actions';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // システム管理者認証チェック
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
        const alerts = await getDashboardAlerts();
        return NextResponse.json(alerts);
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}
