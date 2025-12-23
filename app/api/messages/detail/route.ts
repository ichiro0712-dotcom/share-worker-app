import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMessagesByFacility } from '@/src/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const facilityId = parseInt(searchParams.get('facilityId') || '');
        const cursor = searchParams.get('cursor') ? parseInt(searchParams.get('cursor')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const markAsRead = searchParams.get('markAsRead') === 'true';

        if (isNaN(facilityId)) {
            return NextResponse.json({ error: 'Invalid facilityId' }, { status: 400 });
        }

        const messages = await getMessagesByFacility(facilityId, { cursor, limit, markAsRead });

        return NextResponse.json(messages, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[API /api/messages/detail] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        );
    }
}
