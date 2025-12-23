import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMessagesByWorker } from '@/src/lib/actions';

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

        const { searchParams } = new URL(request.url);
        const workerId = parseInt(searchParams.get('workerId') || '');
        const cursor = searchParams.get('cursor') ? parseInt(searchParams.get('cursor')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const markAsRead = searchParams.get('markAsRead') === 'true';

        if (isNaN(workerId)) {
            return NextResponse.json({ error: 'Invalid workerId' }, { status: 400 });
        }

        const messages = await getMessagesByWorker(facilityId, workerId, { cursor, limit, markAsRead });

        return NextResponse.json(messages, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[API /api/admin/messages/detail] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        );
    }
}
