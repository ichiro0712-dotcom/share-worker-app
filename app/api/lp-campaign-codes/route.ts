import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ランダム6文字を生成
function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET: キャンペーンコード一覧を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lpId = searchParams.get('lpId');
    const genreId = searchParams.get('genreId');
    const code = searchParams.get('code');

    // 単一コードの取得（コード検証用）
    if (code) {
      const campaignCode = await prisma.lpCampaignCode.findUnique({
        where: { code },
        include: { genre: true },
      });

      if (!campaignCode) {
        return NextResponse.json({ valid: false });
      }

      return NextResponse.json({
        valid: true,
        code: campaignCode,
        genrePrefix: campaignCode.genre.prefix,
        genreName: campaignCode.genre.name,
      });
    }

    // LP別のコード一覧
    const where: { lp_id?: string; genre_id?: number; is_active?: boolean } = {};
    if (lpId) where.lp_id = lpId;
    if (genreId) where.genre_id = parseInt(genreId);

    const codes = await prisma.lpCampaignCode.findMany({
      where,
      include: { genre: true },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Failed to fetch campaign codes:', error);
    return NextResponse.json(
      { error: 'コードの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: キャンペーンコードの作成・更新・削除
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, lpId, genreId, name, memo, isActive } = body;

    switch (action) {
      case 'create': {
        if (!lpId || !genreId) {
          return NextResponse.json(
            { error: 'LP IDとジャンルIDが必要です' },
            { status: 400 }
          );
        }

        // ジャンルを取得
        const genre = await prisma.lpCodeGenre.findUnique({
          where: { id: genreId },
        });

        if (!genre) {
          return NextResponse.json(
            { error: 'ジャンルが見つかりません' },
            { status: 404 }
          );
        }

        // ユニークなコードを生成（衝突回避のため最大10回試行）
        let code: string = '';
        let attempts = 0;
        while (attempts < 10) {
          const randomPart = generateRandomCode();
          code = `${genre.prefix}-${randomPart}`;

          const existing = await prisma.lpCampaignCode.findUnique({
            where: { code },
          });

          if (!existing) break;
          attempts++;
        }

        if (attempts >= 10) {
          return NextResponse.json(
            { error: 'コードの生成に失敗しました。再度お試しください。' },
            { status: 500 }
          );
        }

        const campaignCode = await prisma.lpCampaignCode.create({
          data: {
            code,
            lp_id: lpId,
            genre_id: genreId,
            name: name || `${genre.name} - ${code}`,
            memo,
          },
          include: { genre: true },
        });

        return NextResponse.json({ success: true, code: campaignCode });
      }

      case 'update': {
        if (!id) {
          return NextResponse.json(
            { error: 'IDが必要です' },
            { status: 400 }
          );
        }

        const updateData: { name?: string; memo?: string; is_active?: boolean } = {};
        if (name !== undefined) updateData.name = name;
        if (memo !== undefined) updateData.memo = memo;
        if (isActive !== undefined) updateData.is_active = isActive;

        const campaignCode = await prisma.lpCampaignCode.update({
          where: { id },
          data: updateData,
          include: { genre: true },
        });

        return NextResponse.json({ success: true, code: campaignCode });
      }

      case 'delete': {
        if (!id) {
          return NextResponse.json(
            { error: 'IDが必要です' },
            { status: 400 }
          );
        }

        await prisma.lpCampaignCode.delete({
          where: { id },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: '不明なアクションです' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Campaign code operation failed:', error);
    return NextResponse.json(
      { error: '操作に失敗しました' },
      { status: 500 }
    );
  }
}
