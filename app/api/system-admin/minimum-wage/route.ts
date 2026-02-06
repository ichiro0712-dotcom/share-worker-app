import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMinimumWagesForAdmin,
  upsertMinimumWage,
  deleteScheduledWage,
  getMissingPrefectures,
} from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * GET: 全都道府県の最低賃金を取得（管理画面用）
 * 都道府県ごとに active（現行）と scheduled（予定）を返す
 */
export async function GET() {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const prefectures = await getAllMinimumWagesForAdmin();
    const missingPrefectures = await getMissingPrefectures();

    return NextResponse.json({
      prefectures,
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
 * POST: 単一の都道府県の最低賃金を更新/予定登録
 */
export async function POST(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prefecture, hourlyWage, effectiveFrom } = body;

    if (!prefecture || hourlyWage === undefined || hourlyWage === null || !effectiveFrom) {
      return NextResponse.json(
        { error: '都道府県、時給、適用開始日は必須です' },
        { status: 400 }
      );
    }

    const numericWage = Number(hourlyWage);
    if (!Number.isInteger(numericWage) || numericWage <= 0) {
      return NextResponse.json(
        { error: '時給は正の整数で入力してください' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(effectiveFrom);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: '適用開始日が不正です' },
        { status: 400 }
      );
    }

    const result = await upsertMinimumWage(
      prefecture,
      numericWage,
      parsedDate,
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

/**
 * DELETE: 予定の最低賃金を取消
 */
export async function DELETE(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { error: '有効なIDが必要です' },
        { status: 400 }
      );
    }

    const result = await deleteScheduledWage(numericId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || '取消に失敗しました' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage] DELETE error:', error);
    return NextResponse.json(
      { error: '予定の取消に失敗しました' },
      { status: 500 }
    );
  }
}
