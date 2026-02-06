import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMinimumWagesForAdmin,
  upsertMinimumWage,
  getMissingPrefectures,
} from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * GET: 全都道府県の最低賃金を取得（管理画面用）
 */
export async function GET() {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const wages = await getAllMinimumWagesForAdmin();
    const missingPrefectures = await getMissingPrefectures();

    return NextResponse.json({
      wages,
      missingPrefectures,
    });
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage] GET error:', error);
    return NextResponse.json(
      { error: '最低賃金の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * POST: 単一の都道府県の最低賃金を更新
 */
export async function POST(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prefecture, hourlyWage, effectiveFrom } = body;

    if (!prefecture || !hourlyWage || !effectiveFrom) {
      return NextResponse.json(
        { error: '都道府県、時給、適用開始日は必須です' },
        { status: 400 }
      );
    }

    const result = await upsertMinimumWage(
      prefecture,
      hourlyWage,
      new Date(effectiveFrom),
      {
        type: 'SYSTEM_ADMIN',
        id: session.adminId || 0,
      }
    );

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || '更新に失敗しました' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage] POST error:', error);
    return NextResponse.json(
      { error: '最低賃金の更新に失敗しました' },
      { status: 500 }
    );
  }
}
