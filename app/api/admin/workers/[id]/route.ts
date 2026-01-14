import { NextRequest, NextResponse } from 'next/server';
import { getWorkerDetail } from '@/src/lib/actions';
import { withFacilityAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { searchParams } = new URL(request.url);
    const facilityId = parseInt(searchParams.get('facilityId') || '0');
    const workerId = parseInt(params.id, 10);

    if (isNaN(workerId)) {
        return NextResponse.json(
            { error: 'Invalid worker id' },
            { status: 400 }
        );
    }

    return withFacilityAuth(facilityId, async (validatedFacilityId) => {
        const workerDetail = await getWorkerDetail(workerId, validatedFacilityId);

        if (!workerDetail) {
            throw new Error('Worker not found');
        }

        return workerDetail;
    });
}
