import { NextRequest, NextResponse } from 'next/server';
import { getMinimumWageForPrefecture } from '@/src/lib/actions/minimumWage';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

/**
 * GET /api/minimum-wage?prefecture=東京都
 * 都道府県の現行最低賃金を取得（施設管理者向け）
 */
export async function GET(request: NextRequest) {
  const session = await getFacilityAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const prefecture = request.nextUrl.searchParams.get('prefecture');
  if (!prefecture) {
    return NextResponse.json(
      { error: '都道府県パラメータが必要です' },
      { status: 400 }
    );
  }

  try {
    const hourlyWage = await getMinimumWageForPrefecture(prefecture);

    return NextResponse.json({
      hourlyWage,
      prefecture,
    });
  } catch (error) {
    console.error('[API /api/minimum-wage] GET error:', error);
    return NextResponse.json(
      { error: '最低賃金の取得に失敗しました' },
      { status: 500 }
    );
  }
}
