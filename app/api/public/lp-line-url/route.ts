import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * LPのCTA URLを取得する公開API
 * GET /api/public/lp-line-url?lp=5
 *
 * LandingPageテーブルの cta_url を返す
 * 未設定の場合は404を返す
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lpNumber = searchParams.get('lp');

    if (!lpNumber) {
      return NextResponse.json({ error: 'lp parameter required' }, { status: 400 });
    }

    const lpNum = parseInt(lpNumber, 10);

    if (isNaN(lpNum)) {
      return NextResponse.json({ error: 'Invalid lp parameter' }, { status: 400 });
    }

    const lp = await prisma.landingPage.findUnique({
      where: { lp_number: lpNum },
      select: { cta_url: true },
    });

    if (!lp?.cta_url) {
      return NextResponse.json({ error: 'CTA URL not set for this LP' }, { status: 404 });
    }

    return NextResponse.json({
      url: lp.cta_url,
      lpNumber,
    });
  } catch (error) {
    console.error('LP CTA URL API error:', error);
    return NextResponse.json({ error: 'Failed to fetch CTA URL' }, { status: 500 });
  }
}
