import { NextRequest, NextResponse } from 'next/server';
import { getMinimumWageHistory } from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * GET: 最低賃金の履歴を取得
 */
export async function GET(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const prefecture = url.searchParams.get('prefecture') || undefined;
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    const history = await getMinimumWageHistory(prefecture, limit);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage/history] GET error:', error);
    return NextResponse.json(
      { error: '履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
