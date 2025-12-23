import { NextRequest, NextResponse } from 'next/server';
import { getFacilityAnnouncements } from '@/src/lib/system-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // クエリパラメータ解析
        const { searchParams } = new URL(request.url);
        const facilityIdParam = searchParams.get('facilityId');

        if (!facilityIdParam) {
            return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });
        }

        const facilityId = parseInt(facilityIdParam);
        if (isNaN(facilityId)) {
            return NextResponse.json({ error: 'Invalid facility ID' }, { status: 400 });
        }

        const announcements = await getFacilityAnnouncements(facilityId);

        return NextResponse.json(announcements, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[API /api/admin/messages/announcements] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch announcements' },
            { status: 500 }
        );
    }
}
