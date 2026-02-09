import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STORAGE_BUCKETS } from '@/lib/supabase';

// #6: LINEタグのインメモリキャッシュ（60秒TTL）
let lineTagsCache: { script: string; expiry: number } | null = null;
const LINE_TAGS_CACHE_TTL = 60 * 1000; // 60秒（HTMLキャッシュと同じ）

// LINEタグをDBから取得してscriptタグを生成
async function buildLineTagsScript(): Promise<string> {
  // キャッシュがあり有効期限内ならそのまま返す
  if (lineTagsCache && Date.now() < lineTagsCache.expiry) {
    return lineTagsCache.script;
  }

  try {
    const tags = await prisma.lpLineTag.findMany({
      orderBy: { sort_order: 'asc' },
    });
    if (tags.length === 0) {
      lineTagsCache = { script: '', expiry: Date.now() + LINE_TAGS_CACHE_TTL };
      return '';
    }

    const tagMap: Record<string, string> = {};
    let defaultKey = '';
    for (const tag of tags) {
      tagMap[tag.key] = tag.url;
      if (tag.is_default) defaultKey = tag.key;
    }
    if (!defaultKey) defaultKey = tags[0].key;

    const script = `<script>window.__LP_LINE_TAGS=${JSON.stringify(tagMap)};window.__LP_LINE_TAG_DEFAULT=${JSON.stringify(defaultKey)};</script>`;
    lineTagsCache = { script, expiry: Date.now() + LINE_TAGS_CACHE_TTL };
    return script;
  } catch (error) {
    // #3: エラーをログに記録（サイレント失敗を防止）
    console.error('[LP API] Failed to build LINE tags script:', error);
    return '';
  }
}

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

    // HTMLファイルの場合、LINEタグを動的注入
    if (filePath === 'index.html') {
      let html = await response.text();
      const lineTagsScript = await buildLineTagsScript();
      if (lineTagsScript) {
        // </head>の前に注入（なければ<body>の直後）
        if (html.includes('</head>')) {
          html = html.replace('</head>', lineTagsScript + '</head>');
        } else if (html.includes('<body')) {
          html = html.replace(/<body([^>]*)>/, '<body$1>' + lineTagsScript);
        } else {
          html = lineTagsScript + html;
        }
      }

      const headers: HeadersInit = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=60', // HTMLは1分キャッシュ
      };
      return new NextResponse(html, { headers });
    }

    const body = await response.arrayBuffer();

    // キャッシュヘッダーを設定
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable', // 静的アセットは1年キャッシュ
    };

    return new NextResponse(body, { headers });
  } catch (error) {
    console.error('[LP API] Error fetching file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
