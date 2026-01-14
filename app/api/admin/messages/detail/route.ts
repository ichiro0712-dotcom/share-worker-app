import { NextRequest, NextResponse } from 'next/server';
import { getMessagesByWorker } from '@/src/lib/actions';
import { withFacilityAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const facilityId = parseInt(searchParams.get('facilityId') || '0');
    const workerId = parseInt(searchParams.get('workerId') || '');

    if (isNaN(workerId)) {
        return NextResponse.json({ error: 'Invalid workerId' }, { status: 400 });
    }

    return withFacilityAuth(facilityId, async (validatedFacilityId) => {
        const cursor = searchParams.get('cursor') ? parseInt(searchParams.get('cursor')!) : undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const markAsRead = searchParams.get('markAsRead') === 'true';

        return await getMessagesByWorker(validatedFacilityId, workerId, { cursor, limit, markAsRead });
    });
}
