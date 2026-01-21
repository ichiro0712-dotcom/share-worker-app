import { NextRequest, NextResponse } from 'next/server';
import { getShiftsForFacility } from '@/src/lib/actions';
import { withFacilityAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const facilityId = parseInt(searchParams.get('facilityId') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    return withFacilityAuth(facilityId, async (validatedFacilityId) => {
        return await getShiftsForFacility(validatedFacilityId, startDate, endDate);
    });
}
