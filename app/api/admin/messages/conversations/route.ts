import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGroupedWorkerConversations } from '@/src/lib/actions';

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

        const conversations = await getGroupedWorkerConversations(facilityId);

        return NextResponse.json(conversations, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[API /api/admin/messages/conversations] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conversations' },
            { status: 500 }
        );
    }
}
