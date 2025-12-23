import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getWorkerListForFacility } from '@/src/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // 認証チェック
        const cookieStore = cookies();
        const adminSession = cookieStore.get('admin_session');
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sessionData = JSON.parse(adminSession.value);
        const facilityId = sessionData.facilityId;

        if (!facilityId) {
            return NextResponse.json({ error: 'Facility not found' }, { status: 400 });
        }

        // クエリパラメータ解析
        const { searchParams } = new URL(request.url);
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
