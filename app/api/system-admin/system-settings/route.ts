import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSystemSettings,
  updateSystemSettings,
} from '@/src/lib/actions/systemSettings';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

// GET: 全システム設定を取得
export async function GET() {
  // システム管理者認証チェック
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const settings = await getAllSystemSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API /api/system-admin/system-settings] GET error:', error);
    return NextResponse.json(
      { error: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: システム設定を更新
export async function POST(request: NextRequest) {
  // システム管理者認証チェック
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const settings = await request.json();

    const result = await updateSystemSettings(settings, {
      type: 'SYSTEM_ADMIN',
      id: session.adminId || 0,
    });

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || '設定の更新に失敗しました' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API /api/system-admin/system-settings] POST error:', error);
    return NextResponse.json(
      { error: '設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}
