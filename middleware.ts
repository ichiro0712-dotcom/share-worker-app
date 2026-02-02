import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Basic認証チェック（本番環境のみ）
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合はBasic認証をスキップ
  if (!basicAuthUser || !basicAuthPassword) {
    return null;
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    const [user, password] = atob(authValue).split(':');

    if (user === basicAuthUser && password === basicAuthPassword) {
      return null; // 認証成功
    }
  }

  // 認証失敗 - 401を返す
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

// 認証不要なパス
const publicPaths = [
  '/login',
  '/register',
  '/admin/login',
  '/api/auth',
  '/auth', // メール認証関連（/auth/verify, /auth/verify-pending, /auth/resend-verification）
  '/dev-portal', // 開発用ポータル
  '/password-reset', // パスワードリセット
  '/faq',
  '/terms',
  '/privacy',
  '/contact',
  '/public', // SEO用公開ページ
  '/robots.txt', // SEO: robots.txt
  '/sitemap.xml', // SEO: サイトマップ
  '/lp', // LP関連ページ（/lp, /lp/1, /lp/tracking等）
];

// 静的ファイルとAPI認証エンドポイント
const ignoredPaths = [
  '/_next',
  '/favicon.ico',
  '/api/auth',
  '/api/admin',
  '/api/debug', // デバッグ用API
  '/api/dev', // 開発用API（テストメール送信など）
  '/api/error-messages', // エラーメッセージ設定（認証不要）
  '/api/jobs', // 求人一覧API（ログイン前でも表示が必要）
  '/api/lp-tracking', // LPトラッキングAPI（POST: 公開、GET: 管理ページから使用）
  '/api/lp-config', // LP設定API
  '/api/upload', // アップロードAPI（API側で独自認証を実施）
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
  // Basic認証も適用しない（/admin, /system-admin は独自のログイン画面を持つ）
  if (pathname.startsWith('/admin') || pathname.startsWith('/system-admin') || pathname.startsWith('/api/system-admin')) {
    return NextResponse.next();
  }

  // Basic認証チェック（環境変数が設定されている場合のみ）
  // ※ /admin, /system-admin は上で除外済み
  const basicAuthResponse = checkBasicAuth(request);
  if (basicAuthResponse) {
    return basicAuthResponse;
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
