import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// デフォルトジャンル（初回シード用）
const DEFAULT_GENRES = [
  { prefix: 'AAA', name: 'LINE', sort_order: 1 },
  { prefix: 'AAB', name: 'Meta広告', sort_order: 2 },
  { prefix: 'AAC', name: 'Facebook', sort_order: 3 },
  { prefix: 'AAD', name: 'Instagram', sort_order: 4 },
  { prefix: 'AAE', name: 'Messenger', sort_order: 5 },
  { prefix: 'AAF', name: 'Audience Network', sort_order: 6 },
  { prefix: 'AAG', name: 'Threads', sort_order: 7 },
  { prefix: 'AAH', name: 'Google広告', sort_order: 8 },
];

// 次のプレフィックスを生成（AAA → AAB → ... → AAZ → ABA → ...）
function getNextPrefix(lastPrefix: string | null): string {
  if (!lastPrefix) return 'AAA';

  const chars = lastPrefix.split('');

  // 末尾から繰り上げ処理
  for (let i = 2; i >= 0; i--) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      break;
    }
  }

  // 全てZの場合（ZZZ → AAAA は対応しない、エラーにする）
  if (chars.join('') === 'AAA' && lastPrefix === 'ZZZ') {
    throw new Error('プレフィックスの上限に達しました');
  }

  return chars.join('');
}

// GET: ジャンル一覧を取得
export async function GET() {
  try {
    let genres = await prisma.lpCodeGenre.findMany({
      orderBy: { sort_order: 'asc' },
    });

    // ジャンルが空の場合、デフォルトをシード
    if (genres.length === 0) {
      await prisma.lpCodeGenre.createMany({
        data: DEFAULT_GENRES,
      });
      genres = await prisma.lpCodeGenre.findMany({
        orderBy: { sort_order: 'asc' },
      });
    }

    return NextResponse.json({ genres });
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    return NextResponse.json(
      { error: 'ジャンルの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: ジャンルの作成・更新・削除
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, name, prefix } = body;

    switch (action) {
      case 'create': {
        // 最後のプレフィックスを取得
        const lastGenre = await prisma.lpCodeGenre.findFirst({
          orderBy: { prefix: 'desc' },
        });
        const newPrefix = getNextPrefix(lastGenre?.prefix || null);

        // 最大sort_orderを取得
        const maxSortOrder = await prisma.lpCodeGenre.aggregate({
          _max: { sort_order: true },
        });

        const genre = await prisma.lpCodeGenre.create({
          data: {
            prefix: newPrefix,
            name,
            sort_order: (maxSortOrder._max.sort_order || 0) + 1,
          },
        });

        return NextResponse.json({ success: true, genre });
      }

      case 'update': {
        if (!id) {
          return NextResponse.json(
            { error: 'IDが必要です' },
            { status: 400 }
          );
        }

        const genre = await prisma.lpCodeGenre.update({
          where: { id },
          data: { name },
        });

        return NextResponse.json({ success: true, genre });
      }

      case 'delete': {
        if (!id && !prefix) {
          return NextResponse.json(
            { error: 'IDまたはプレフィックスが必要です' },
            { status: 400 }
          );
        }

        // 使用中のコードがあるかチェック
        const whereCondition = id ? { id } : { prefix };
        const genre = await prisma.lpCodeGenre.findFirst({
          where: whereCondition,
          include: { campaignCodes: { take: 1 } },
        });

        if (!genre) {
          return NextResponse.json(
            { error: 'ジャンルが見つかりません' },
            { status: 404 }
          );
        }

        if (genre.campaignCodes.length > 0) {
          return NextResponse.json(
            { error: 'このジャンルは使用中のため削除できません' },
            { status: 400 }
          );
        }

        await prisma.lpCodeGenre.delete({
          where: { id: genre.id },
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
    console.error('Genre operation failed:', error);
    return NextResponse.json(
      { error: '操作に失敗しました' },
      { status: 500 }
    );
  }
}
