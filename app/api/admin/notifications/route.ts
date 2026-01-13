import { NextRequest, NextResponse } from 'next/server';
import { getFacilityNotifications } from '@/src/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const facilityIdParam = searchParams.get('facilityId');

    if (!facilityIdParam) {
        return NextResponse.json(
            { error: 'facilityId is required' },
            { status: 400 }
        );
    }

    const facilityId = parseInt(facilityIdParam, 10);
    if (isNaN(facilityId)) {
        return NextResponse.json(
            { error: 'facilityId must be a number' },
            { status: 400 }
        );
    }

    try {
        const notifications = await getFacilityNotifications(facilityId);
        return NextResponse.json(notifications, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error) {
        console.error('[GET /api/admin/notifications] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}
