import { NextResponse } from 'next/server';
import { getMinimumWageHistory } from '@/src/lib/actions/minimumWage';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * GET: 最低賃金の履歴をCSVでエクスポート
 */
export async function GET() {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const history = await getMinimumWageHistory(undefined, 1000);

    // CSV生成
    const headers = ['都道府県', '時給', '適用開始日', '適用終了日', 'アーカイブ日時'];
    const rows = history.map(h => [
      h.prefecture,
      h.hourlyWage.toString(),
      formatDate(h.effectiveFrom),
      h.effectiveTo ? formatDate(h.effectiveTo) : '',
      formatDate(h.archivedAt),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\r\n');

    // ファイル名に日付を含める
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = encodeURIComponent(`最低賃金_履歴_${dateStr}.csv`);

    return new Response('\uFEFF' + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API /api/system-admin/minimum-wage/history/export] GET error:', error);
    return NextResponse.json(
      { error: '履歴のエクスポートに失敗しました' },
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
