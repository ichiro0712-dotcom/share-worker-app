import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

// デフォルトLINEタグ（初回シード用 - 現在ハードコードされている値）
const DEFAULT_LINE_TAGS = [
  {
    key: 'google',
    label: 'Google広告',
    url: 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd',
    sort_order: 1,
    is_default: true,
  },
  {
    key: 'meta',
    label: 'Meta広告',
    url: 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd',
    sort_order: 2,
    is_default: false,
  },
];

// keyのバリデーション: 英小文字・数字・アンダースコアのみ
function isValidKey(key: string): boolean {
  return /^[a-z0-9_]+$/.test(key) && key.length > 0 && key.length <= 50;
}

// label/urlの長さバリデーション (#9)
function validateLabelLength(label: string): boolean {
  return label.length > 0 && label.length <= 100;
}

function validateUrlLength(url: string): boolean {
  return url.length > 0 && url.length <= 2000;
}

// GET: LINEタグ一覧を取得
export async function GET() {
  try {
    let tags = await prisma.lpLineTag.findMany({
      orderBy: { sort_order: 'asc' },
    });

    // タグが空の場合、デフォルトをシード（#5: レースコンディション対策）
    if (tags.length === 0) {
      try {
        await prisma.lpLineTag.createMany({
          data: DEFAULT_LINE_TAGS,
          skipDuplicates: true,
        });
      } catch (seedError) {
        // 並行GETによるユニーク制約違反は無視（別リクエストがシード済み）
        console.warn('Auto-seed skipped (likely concurrent request):', seedError);
      }
      tags = await prisma.lpLineTag.findMany({
        orderBy: { sort_order: 'asc' },
      });
    }

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Failed to fetch line tags:', error);
    return NextResponse.json(
      { error: 'LINEタグの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: LINEタグの作成・更新・削除
export async function POST(request: NextRequest) {
  // #1: 認証チェック
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { key, label, url } = body;

        if (!key || !label || !url) {
          return NextResponse.json(
            { error: 'キー、表示名、URLは必須です' },
            { status: 400 }
          );
        }

        if (!isValidKey(key)) {
          return NextResponse.json(
            { error: 'キーは英小文字・数字・アンダースコアのみ使用できます' },
            { status: 400 }
          );
        }

        // #9: 長さバリデーション
        if (!validateLabelLength(label)) {
          return NextResponse.json(
            { error: '表示名は100文字以内で入力してください' },
            { status: 400 }
          );
        }

        if (!validateUrlLength(url)) {
          return NextResponse.json(
            { error: 'URLは2000文字以内で入力してください' },
            { status: 400 }
          );
        }

        if (!url.startsWith('https://')) {
          return NextResponse.json(
            { error: 'URLはhttps://で始まる必要があります' },
            { status: 400 }
          );
        }

        // ユニークチェック
        const existing = await prisma.lpLineTag.findUnique({
          where: { key },
        });
        if (existing) {
          return NextResponse.json(
            { error: `キー「${key}」は既に使用されています` },
            { status: 400 }
          );
        }

        // 最大sort_orderを取得
        const maxSortOrder = await prisma.lpLineTag.aggregate({
          _max: { sort_order: true },
        });

        const tag = await prisma.lpLineTag.create({
          data: {
            key,
            label,
            url,
            sort_order: (maxSortOrder._max.sort_order || 0) + 1,
          },
        });

        return NextResponse.json({ success: true, tag });
      }

      case 'update': {
        const { id, key, label, url, is_default } = body;

        if (!id) {
          return NextResponse.json(
            { error: 'IDが必要です' },
            { status: 400 }
          );
        }

        const updateData: Record<string, unknown> = {};

        if (key !== undefined) {
          if (!isValidKey(key)) {
            return NextResponse.json(
              { error: 'キーは英小文字・数字・アンダースコアのみ使用できます' },
              { status: 400 }
            );
          }
          // ユニークチェック（自分以外）
          const existing = await prisma.lpLineTag.findFirst({
            where: { key, NOT: { id } },
          });
          if (existing) {
            return NextResponse.json(
              { error: `キー「${key}」は既に使用されています` },
              { status: 400 }
            );
          }
          updateData.key = key;
        }

        if (label !== undefined) {
          // #9: 長さバリデーション
          if (!validateLabelLength(label)) {
            return NextResponse.json(
              { error: '表示名は100文字以内で入力してください' },
              { status: 400 }
            );
          }
          updateData.label = label;
        }
        if (url !== undefined) {
          // #9: 長さバリデーション
          if (!validateUrlLength(url)) {
            return NextResponse.json(
              { error: 'URLは2000文字以内で入力してください' },
              { status: 400 }
            );
          }
          if (!url.startsWith('https://')) {
            return NextResponse.json(
              { error: 'URLはhttps://で始まる必要があります' },
              { status: 400 }
            );
          }
          updateData.url = url;
        }

        // #2: デフォルト設定をトランザクション化
        if (is_default === true) {
          const tag = await prisma.$transaction(async (tx) => {
            await tx.lpLineTag.updateMany({
              where: { is_default: true },
              data: { is_default: false },
            });
            updateData.is_default = true;
            return tx.lpLineTag.update({
              where: { id },
              data: updateData,
            });
          });
          return NextResponse.json({ success: true, tag });
        }

        const tag = await prisma.lpLineTag.update({
          where: { id },
          data: updateData,
        });

        return NextResponse.json({ success: true, tag });
      }

      case 'delete': {
        const { id } = body;

        if (!id) {
          return NextResponse.json(
            { error: 'IDが必要です' },
            { status: 400 }
          );
        }

        // 最後の1件は削除不可
        const count = await prisma.lpLineTag.count();
        if (count <= 1) {
          return NextResponse.json(
            { error: '最後のタグは削除できません' },
            { status: 400 }
          );
        }

        const tag = await prisma.lpLineTag.findUnique({
          where: { id },
        });
        if (!tag) {
          return NextResponse.json(
            { error: 'タグが見つかりません' },
            { status: 404 }
          );
        }

        await prisma.lpLineTag.delete({
          where: { id },
        });

        // 削除されたタグがデフォルトだった場合、先頭をデフォルトに
        if (tag.is_default) {
          const first = await prisma.lpLineTag.findFirst({
            orderBy: { sort_order: 'asc' },
          });
          if (first) {
            await prisma.lpLineTag.update({
              where: { id: first.id },
              data: { is_default: true },
            });
          }
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: '不明なアクションです' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Line tag operation failed:', error);
    return NextResponse.json(
      { error: '操作に失敗しました' },
      { status: 500 }
    );
  }
}
