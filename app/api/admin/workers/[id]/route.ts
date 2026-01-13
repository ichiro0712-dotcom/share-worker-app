import { NextRequest, NextResponse } from 'next/server';
import { getWorkerDetail } from '@/src/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { searchParams } = new URL(request.url);
    const facilityIdParam = searchParams.get('facilityId');
    const workerId = parseInt(params.id, 10);

    if (isNaN(workerId)) {
        return NextResponse.json(
            { error: 'Invalid worker id' },
            { status: 400 }
        );
    }

    if (!facilityIdParam) {
        return NextResponse.json(
            { error: 'facilityId is required' },
            { status: 400 }
        );
    }

    const facilityId = parseInt(facilityIdParam, 10);
    if (isNaN(facilityId)) {
        return NextResponse.json(
            { error: 'facilityId must be a number' },
            { status: 400 }
        );
    }

    try {
        const workerDetail = await getWorkerDetail(workerId, facilityId);

        if (!workerDetail) {
            return NextResponse.json(
                { error: 'Worker not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(workerDetail, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error) {
        console.error('[GET /api/admin/workers/[id]] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch worker detail' },
            { status: 500 }
        );
    }
}
