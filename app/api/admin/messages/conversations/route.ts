import { NextRequest } from 'next/server';
import { getGroupedWorkerConversations } from '@/src/lib/actions';
import { withFacilityAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const facilityId = parseInt(searchParams.get('facilityId') || '0');

    return withFacilityAuth(facilityId, async (validatedFacilityId) => {
        return await getGroupedWorkerConversations(validatedFacilityId);
    });
}
