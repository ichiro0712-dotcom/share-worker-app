import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// 認証不要なパス
const publicPaths = [
  '/login',
  '/register',
  '/admin/login',
  '/api/auth',
  '/dev-portal', // 開発用ポータル
  '/password-reset', // パスワードリセット
  '/faq',
  '/terms',
  '/privacy',
  '/contact',
];

// 静的ファイルとAPI認証エンドポイント
const ignoredPaths = [
  '/_next',
  '/favicon.ico',
  '/api/auth',
  '/api/admin',
  '/api/debug', // デバッグ用API
  '/api/error-messages', // エラーメッセージ設定（認証不要）
  '/rogo', // ロゴ画像
  '/images', // 画像ファイル
  '/icons', // アイコン
  '/fonts', // フォント
  '/uploads', // アップロードファイル
  '/sw.js', // Service Worker
  '/workbox', // Workbox
  '/manifest.json', // PWA manifest
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的ファイルや認証APIは無視
  if (ignoredPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 管理者ページは別の認証システム（localStorage）を使用しているためスキップ
  // ただし/admin/loginは公開ページ
  if (pathname.startsWith('/admin') || pathname.startsWith('/system-admin') || pathname.startsWith('/api/system-admin')) {
    return NextResponse.next();
  }

  // 公開ページはそのまま通す
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // NextAuth JWTトークンをチェック
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 未認証の場合はログインページにリダイレクト
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
