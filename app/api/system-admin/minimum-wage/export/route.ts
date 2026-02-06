import { NextResponse } from 'next/server';
import { getAllMinimumWagesForAdmin } from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { generateMinimumWageCsv } from '@/src/lib/prefecture-utils';

/**
 * GET: 最低賃金データをCSVでエクスポート
 */
export async function GET() {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const wages = await getAllMinimumWagesForAdmin();

    const csvContent = generateMinimumWageCsv(
      wages.map(w => ({
        prefecture: w.prefecture,
        hourlyWage: w.hourlyWage,
        effectiveFrom: w.effectiveFrom,
      }))
    );

    // ファイル名に日付を含める
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = encodeURIComponent(`最低賃金_${dateStr}.csv`);

    return new Response('\uFEFF' + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage/export] GET error:', error);
    return NextResponse.json(
      { error: 'CSVエクスポートに失敗しました' },
      { status: 500 }
    );
  }
}
