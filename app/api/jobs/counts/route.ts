import { NextRequest, NextResponse } from 'next/server';
import { getJobListTypeCounts } from '@/src/lib/actions/job-worker';

// キャッシュ設定
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const counts = await getJobListTypeCounts();

    return NextResponse.json(counts, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[API /api/jobs/counts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job counts' },
      { status: 500 }
    );
  }
}
