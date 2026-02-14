import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase';
import { scanHtmlForTags } from '@/lib/lp-tag-utils';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

/**
 * GET: LP の HTML を取得（管理画面用）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { id } = await params;
  const lpNumber = parseInt(id, 10);
  if (isNaN(lpNumber)) {
    return NextResponse.json({ error: '無効なLP番号です' }, { status: 400 });
  }

  const lp = await prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });
  if (!lp) {
    return NextResponse.json({ error: 'LPが見つかりません' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${lpNumber}/index.html`;

  try {
    const response = await fetch(`${storageUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ error: 'HTMLファイルが見つかりません' }, { status: 404 });
    }
    const html = await response.text();

    return NextResponse.json({
      html,
      lpNumber: lp.lp_number,
      name: lp.name,
    });
  } catch (error) {
    console.error('[LP HTML API] Error fetching HTML:', error);
    return NextResponse.json({ error: 'HTMLの取得に失敗しました' }, { status: 500 });
  }
}

/**
 * PUT: LP の HTML を保存（管理画面用）
 * 自動タグ埋め込みは実行しない（ユーザーの編集を尊重）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { id } = await params;
  const lpNumber = parseInt(id, 10);
  if (isNaN(lpNumber)) {
    return NextResponse.json({ error: '無効なLP番号です' }, { status: 400 });
  }

  const lp = await prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });
  if (!lp) {
    return NextResponse.json({ error: 'LPが見つかりません' }, { status: 404 });
  }

  let body: { html?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無効なリクエストです' }, { status: 400 });
  }

  const html = body.html;
  if (!html || typeof html !== 'string') {
    return NextResponse.json({ error: 'HTMLが必要です' }, { status: 400 });
  }

  // サイズ制限（5MB）
  if (html.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'HTMLが大きすぎます（上限5MB）' }, { status: 400 });
  }

  // 最低限のHTML構造チェック（開始タグの形式を確認）
  if (!/<html[\s>]/i.test(html) && !/<body[\s>]/i.test(html)) {
    return NextResponse.json({ error: '有効なHTMLではありません（<html>または<body>タグが必要です）' }, { status: 400 });
  }

  try {
    // Supabase Storageに上書き保存
    const result = await uploadFile(
      STORAGE_BUCKETS.LP_ASSETS,
      `${lpNumber}/index.html`,
      Buffer.from(html, 'utf-8'),
      'text/html; charset=utf-8'
    );

    if ('error' in result) {
      console.error('[LP HTML API] Storage error:', result.error);
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
    }

    // タグ有無を再スキャンしてDBフラグを更新
    const checks = scanHtmlForTags(html);
    try {
      await prisma.landingPage.update({
        where: { lp_number: lpNumber },
        data: {
          has_gtm: checks.has_gtm,
          has_tracking: checks.has_tracking,
          updated_at: new Date(),
        },
      });
    } catch (dbError) {
      console.error('[LP HTML API] DB update failed (HTML is saved):', dbError);
      return NextResponse.json({
        success: true,
        checks,
        warning: 'HTMLは保存されましたが、タグフラグの更新に失敗しました',
      });
    }

    return NextResponse.json({
      success: true,
      checks,
    });
  } catch (error) {
    console.error('[LP HTML API] Error saving HTML:', error);
    return NextResponse.json({ error: 'HTMLの保存に失敗しました' }, { status: 500 });
  }
}
