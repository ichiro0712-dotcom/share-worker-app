import { NextRequest, NextResponse } from 'next/server';
import { getShiftsForFacility } from '@/src/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const facilityIdParam = searchParams.get('facilityId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!facilityIdParam) {
            return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });
        }

        const facilityId = parseInt(facilityIdParam);
        if (isNaN(facilityId)) {
            return NextResponse.json({ error: 'Invalid facility ID' }, { status: 400 });
        }

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
        }

        const shifts = await getShiftsForFacility(facilityId, startDate, endDate);

        return NextResponse.json(shifts, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[API /api/admin/shifts] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch shifts' },
            { status: 500 }
        );
    }
}
