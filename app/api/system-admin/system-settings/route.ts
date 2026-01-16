import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSystemSettings,
  updateSystemSettings,
} from '@/src/lib/actions/systemSettings';

// GET: 全システム設定を取得
export async function GET() {
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
  try {
    const settings = await request.json();

    // TODO: 認証チェック（System Admin のみ）
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.isSystemAdmin) {
    //   return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    // }

    const result = await updateSystemSettings(settings, {
      type: 'SYSTEM_ADMIN',
      id: 0, // TODO: 実際の管理者IDを設定
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
