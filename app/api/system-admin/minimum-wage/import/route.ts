import { NextRequest, NextResponse } from 'next/server';
import { importMinimumWages } from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { decodeCsvBuffer } from '@/src/lib/prefecture-utils';

/**
 * POST: CSVから最低賃金を一括インポート
 */
export async function POST(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const effectiveFromStr = formData.get('effectiveFrom') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'CSVファイルが必要です' },
        { status: 400 }
      );
    }

    if (!effectiveFromStr) {
      return NextResponse.json(
        { error: '適用開始日が必要です' },
        { status: 400 }
      );
    }

    const effectiveFrom = new Date(effectiveFromStr);
    if (isNaN(effectiveFrom.getTime())) {
      return NextResponse.json(
        { error: '適用開始日の形式が不正です' },
        { status: 400 }
      );
    }

    // ファイル内容を読み取り（UTF-8 / Shift-JIS 自動判定）
    const buffer = await file.arrayBuffer();
    const csvContent = decodeCsvBuffer(buffer);

    const result = await importMinimumWages(
      csvContent,
      effectiveFrom,
      {
        type: 'SYSTEM_ADMIN',
        id: session.adminId || 0,
      }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        imported: result.imported,
        errors: result.errors,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          errors: result.errors,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage/import] POST error:', error);
    return NextResponse.json(
      { error: 'CSVインポートに失敗しました' },
      { status: 500 }
    );
  }
}
