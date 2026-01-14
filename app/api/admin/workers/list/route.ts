import { NextRequest } from 'next/server';
import { getWorkerListForFacility } from '@/src/lib/actions';
import { withFacilityAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const facilityId = parseInt(searchParams.get('facilityId') || '0');

    return withFacilityAuth(facilityId, async (validatedFacilityId) => {
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const status = (searchParams.get('status') || 'all') as any;
        const keyword = searchParams.get('keyword') || '';
        const sort = (searchParams.get('sort') || 'lastWorkDate_desc') as any;
        const jobCategory = (searchParams.get('jobCategory') || 'all') as any;

        return await getWorkerListForFacility(validatedFacilityId, {
            page,
            limit,
            status,
            keyword,
            sort,
            jobCategory,
        });
    });
}
