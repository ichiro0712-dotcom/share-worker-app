import { NextRequest } from 'next/server';
import { getJobsWithApplications } from '@/src/lib/actions';
import { withFacilityAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const facilityId = parseInt(searchParams.get('facilityId') || '0');

  return withFacilityAuth(facilityId, async (validatedFacilityId) => {
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as 'all' | 'PUBLISHED' | 'STOPPED' | 'COMPLETED' || 'all';
    const query = searchParams.get('query') || undefined;
    const sort = searchParams.get('sort') || undefined;

    return await getJobsWithApplications(validatedFacilityId, {
      page,
      limit,
      status,
      query,
      sort,
    });
  });
}
