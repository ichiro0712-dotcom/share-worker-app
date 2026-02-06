import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STORAGE_BUCKETS } from '@/lib/supabase';

// 拡張子からContent-Typeを判定（Supabase Storageが正しいContent-Typeを返さない場合があるため）
function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return types[ext || ''] || 'application/octet-stream';
}

/**
 * LP配信API
 * /api/lp/0 → LP番号0のindex.htmlを配信
 * /api/lp/0/images/hero.jpg → LP番号0の画像を配信
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // パスを解析（例: "0" or "0/images/hero.jpg"）
  const pathParts = id.split('/');
  const lpNumber = parseInt(pathParts[0], 10);

  if (isNaN(lpNumber)) {
    return new NextResponse('Invalid LP number', { status: 400 });
  }

  // DBからLP情報を取得
  const lp = await prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });

  if (!lp) {
    return new NextResponse('LP not found', { status: 404 });
  }

  if (!lp.is_published) {
    return new NextResponse('LP not published', { status: 404 });
  }

  // ファイルパスを構築
  const filePath = pathParts.length > 1
    ? pathParts.slice(1).join('/')
    : 'index.html';

  // Supabase StorageからファイルをプロキシFetch
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${lpNumber}/${filePath}`;

  try {
    const response = await fetch(storageUrl);

    if (!response.ok) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 拡張子からContent-Typeを判定（Supabase Storageの応答に依存しない）
    const contentType = getContentType(filePath);
    const body = await response.arrayBuffer();

    // キャッシュヘッダーを設定
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': filePath === 'index.html'
        ? 'public, max-age=60' // HTMLは1分キャッシュ
        : 'public, max-age=31536000, immutable', // 静的アセットは1年キャッシュ
    };

    return new NextResponse(body, { headers });
  } catch (error) {
    console.error('[LP API] Error fetching file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
