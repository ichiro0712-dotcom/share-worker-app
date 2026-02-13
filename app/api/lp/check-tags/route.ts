import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STORAGE_BUCKETS } from '@/lib/supabase';
import { scanHtmlForTags } from '@/lib/lp-tag-utils';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * POST: 指定LP（or全LP）のHTMLをスキャンしてタグ有無フラグを更新
 * body: { lpNumbers?: number[] }  — 省略時は全LP
 */
export async function POST(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  let body: { lpNumbers?: number[] } = {};
  try {
    body = await request.json();
  } catch {
    // bodyなしの場合は全LP
  }

  // lpNumbers バリデーション
  if (body.lpNumbers !== undefined) {
    if (
      !Array.isArray(body.lpNumbers) ||
      body.lpNumbers.length > 100 ||
      !body.lpNumbers.every(n => typeof n === 'number' && Number.isFinite(n))
    ) {
      return NextResponse.json({ error: '無効なlpNumbersです' }, { status: 400 });
    }
  }

  try {
    // 対象LP一覧を取得
    const where = body.lpNumbers?.length
      ? { lp_number: { in: body.lpNumbers } }
      : {}; // 全LP

    const lps = await prisma.landingPage.findMany({
      where,
      select: { lp_number: true, name: true },
      orderBy: { lp_number: 'asc' },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const results: Array<{
      lpNumber: number;
      name: string;
      checks: { has_gtm: boolean; has_line_tag: boolean; has_tracking: boolean } | null;
      error?: string;
    }> = [];

    for (const lp of lps) {
      const storageUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${lp.lp_number}/index.html`;

      try {
        const response = await fetch(storageUrl);
        if (!response.ok) {
          results.push({
            lpNumber: lp.lp_number,
            name: lp.name,
            checks: null,
            error: 'HTMLファイルなし',
          });
          continue;
        }

        const html = await response.text();
        const checks = scanHtmlForTags(html);

        // DBフラグを更新
        await prisma.landingPage.update({
          where: { lp_number: lp.lp_number },
          data: {
            has_gtm: checks.has_gtm,
            has_line_tag: checks.has_line_tag,
            has_tracking: checks.has_tracking,
          },
        });

        results.push({ lpNumber: lp.lp_number, name: lp.name, checks });
      } catch (error) {
        console.error(`[Check Tags] Error for LP ${lp.lp_number}:`, error);
        results.push({
          lpNumber: lp.lp_number,
          name: lp.name,
          checks: null,
          error: 'スキャン失敗',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Check Tags] Error:', error);
    return NextResponse.json({ error: 'タグチェックに失敗しました' }, { status: 500 });
  }
}
