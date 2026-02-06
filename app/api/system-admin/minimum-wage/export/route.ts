import { NextResponse } from 'next/server';
import { getAllMinimumWagesForAdmin } from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * GET: 最低賃金データをCSVでエクスポート（現行 + 予定を含む）
 */
export async function GET() {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const views = await getAllMinimumWagesForAdmin();

    // CSVヘッダー
    const header = '都道府県,時給,適用開始日,ステータス';

    // 各都道府県のactive/scheduledをフラットに展開
    const rows: string[] = [];
    for (const view of views) {
      if (view.active) {
        const dateStr = formatDate(new Date(view.active.effectiveFrom));
        rows.push(`${view.prefecture},${view.active.hourlyWage},${dateStr},適用中`);
      }
      if (view.scheduled) {
        const dateStr = formatDate(new Date(view.scheduled.effectiveFrom));
        rows.push(`${view.prefecture},${view.scheduled.hourlyWage},${dateStr},予定`);
      }
    }

    const csvContent = [header, ...rows].join('\r\n');

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

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}
