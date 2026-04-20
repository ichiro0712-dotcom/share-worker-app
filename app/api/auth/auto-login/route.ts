import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/logger';
import { issueSessionCookie } from '@/src/lib/auth/session-cookie';

/**
 * サーバーサイド自動ログインエンドポイント
 *
 * アプリ内ブラウザ（Gmail等）からの遷移時にCookieが共有されない問題に対応。
 * auto_login_tokenを検証し、NextAuth JWTセッションCookieをサーバーサイドで設定して
 * 目的のページにリダイレクトする。
 *
 * GET /api/auth/auto-login?token=xxx&email=xxx&redirect=/
 */

function secureRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const email = request.nextUrl.searchParams.get('email');
  const redirect = request.nextUrl.searchParams.get('redirect') || '/';

  // パラメータ不足時はログインページへ
  if (!token || !email) {
    return secureRedirect(
      new URL('/login?verified=true', request.nextUrl.origin)
    );
  }

  try {
    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.warn('[AutoLogin] User not found:', email);
      return secureRedirect(
        new URL('/login?verified=true', request.nextUrl.origin)
      );
    }

    // auto_login_token の検証
    if (
      user.auto_login_token !== token ||
      !user.auto_login_token_expires ||
      user.auto_login_token_expires < new Date()
    ) {
      console.warn('[AutoLogin] Token invalid or expired for user:', user.id);
      // トークン無効/期限切れ → ログインページへ（認証は完了済みなのでverified=trueを付与）
      return secureRedirect(
        new URL('/login?verified=true', request.nextUrl.origin)
      );
    }

    // トークンを消費（ワンタイム使用）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        auto_login_token: null,
        auto_login_token_expires: null,
      },
    });

    // リダイレクト先のバリデーション（オープンリダイレクト防止）
    const isRelativeUrl = redirect.startsWith('/') && !redirect.startsWith('//');
    const safeRedirect = isRelativeUrl ? redirect : '/';

    const response = NextResponse.redirect(
      new URL(safeRedirect, request.nextUrl.origin)
    );

    await issueSessionCookie(response, {
      id: user.id,
      email: user.email,
      name: user.name,
    });

    console.log('[AutoLogin] Success for user:', user.id);

    // ログ記録
    logActivity({
      userType: 'WORKER',
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      targetType: 'User',
      targetId: user.id,
      requestData: { method: 'auto_login_server_side' },
      result: 'SUCCESS',
    }).catch(() => {});

    return response;
  } catch (error) {
    console.error('[AutoLogin] Error:', error);
    return secureRedirect(
      new URL('/login?verified=true', request.nextUrl.origin)
    );
  }
}
