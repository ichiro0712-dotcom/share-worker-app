import { NextRequest, NextResponse } from 'next/server';
import { getWorkerListForFacility } from '@/src/lib/actions';

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

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const status = (searchParams.get('status') || 'all') as any;
        const keyword = searchParams.get('keyword') || '';
        const sort = (searchParams.get('sort') || 'lastWorkDate_desc') as any;
        const jobCategory = (searchParams.get('jobCategory') || 'all') as any;

        // データ取得
        const result = await getWorkerListForFacility(facilityId, {
            page,
            limit,
            status,
            keyword,
            sort,
            jobCategory,
        });

        return NextResponse.json(result, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[API /api/admin/workers/list] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch workers' },
            { status: 500 }
        );
    }
}
