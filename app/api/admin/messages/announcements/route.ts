import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFacilityAnnouncements } from '@/src/lib/system-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const adminSession = cookieStore.get('admin_session');
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sessionData = JSON.parse(adminSession.value);
        const facilityId = sessionData.facilityId;

        if (!facilityId) {
            return NextResponse.json({ error: 'Facility not found' }, { status: 400 });
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
