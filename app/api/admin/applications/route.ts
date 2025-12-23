import { NextRequest, NextResponse } from 'next/server';
import { getJobsWithApplications } from '@/src/lib/actions';

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
    const status = searchParams.get('status') as 'all' | 'PUBLISHED' | 'STOPPED' | 'COMPLETED' || 'all';
    const query = searchParams.get('query') || undefined;

    // データ取得
    const result = await getJobsWithApplications(facilityId, {
      page,
      limit,
      status,
      query,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[API /api/admin/applications] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}
