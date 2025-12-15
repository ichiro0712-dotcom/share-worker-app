import { NextResponse } from 'next/server';
import { getDashboardAlerts } from '@/src/lib/system-actions';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const alerts = await getDashboardAlerts();
        return NextResponse.json(alerts);
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}
