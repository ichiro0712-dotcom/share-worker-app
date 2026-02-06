import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/src/lib/auth/email-verification';

/**
 * メール認証エンドポイント（サーバーサイドリダイレクト方式）
 *
 * フロー:
 * 1. メールリンク: /api/auth/verify?token=xxx
 * 2. トークン検証 → email_verified = true に更新
 * 3. 成功: /api/auth/auto-login にリダイレクト（サーバーサイドでCookie設定 → プロフィール編集へ）
 * 4. 失敗: /auth/verify?status=error にリダイレクト（エラー画面表示）
 *
 * モバイルアプリ内ブラウザ（Gmail, LINE等）でもクライアントJSに依存せず動作する。
 */

function secureRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const origin = request.nextUrl.origin;

  if (!token) {
    return secureRedirect(
      new URL('/auth/verify?status=error&message=認証トークンが指定されていません', origin)
    );
  }

  try {
    const result = await verifyEmailToken(token);

    if (!result.success) {
      // エラーの種類に応じてステータスを分ける
      const status = result.error?.includes('期限') ? 'expired' : 'error';
      const message = encodeURIComponent(result.error || '認証に失敗しました');
      return secureRedirect(
        new URL(`/auth/verify?status=${status}&message=${message}`, origin)
      );
    }

    // 認証成功 → サーバーサイド自動ログインへリダイレクト
    if (result.email && result.autoLoginToken) {
      const autoLoginUrl = new URL('/api/auth/auto-login', origin);
      autoLoginUrl.searchParams.set('token', result.autoLoginToken);
      autoLoginUrl.searchParams.set('email', result.email);
      autoLoginUrl.searchParams.set('redirect', '/mypage/profile');
      return secureRedirect(autoLoginUrl);
    }

    // autoLoginTokenがない場合（通常起こらないが安全策）
    return secureRedirect(
      new URL('/auth/verify?status=verified', origin)
    );
  } catch (error) {
    console.error('[Verify] Error:', error);
    return secureRedirect(
      new URL('/auth/verify?status=error&message=システムエラーが発生しました', origin)
    );
  }
}
