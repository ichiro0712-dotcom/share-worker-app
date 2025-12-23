import { NextRequest, NextResponse } from 'next/server';
import { getGroupedWorkerConversations } from '@/src/lib/actions';

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
