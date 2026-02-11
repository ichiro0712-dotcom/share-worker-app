import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * ローカル開発専用: 認証メールの内容をプレビューするAPI
 * 本番環境では動作しない（NODE_ENV !== 'development' の場合404を返す）
 */
export async function GET(request: NextRequest) {
  // 本番環境では完全に無効化
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email parameter required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      verification_token: true,
      verification_token_expires: true,
      email_verified: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.email_verified) {
    return NextResponse.json({
      status: 'already_verified',
      message: 'このユーザーは既にメール認証済みです。',
      verifyUrl: null,
      emailHtml: null,
    });
  }

  if (!user.verification_token) {
    return NextResponse.json({
      status: 'no_token',
      message: '認証トークンが見つかりません。',
      verifyUrl: null,
      emailHtml: null,
    });
  }

  const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const verificationUrl = `${APP_URL}/api/auth/verify?token=${user.verification_token}`;
  const name = user.name || 'TASTASユーザー';

  const emailHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 20px;">メールアドレスの確認</h2>

        <p>${name} 様</p>

        <p>+TASTASへのご登録ありがとうございます。</p>

        <p>下記のボタンをクリックして、メールアドレスの確認を完了してください。</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none;
                      padding: 14px 28px; border-radius: 6px; font-weight: bold;">
                メールアドレスを確認する
            </a>
        </div>

        <p style="font-size: 14px; color: #666;">
            ボタンがクリックできない場合は、以下のURLをブラウザにコピー＆ペーストしてください：<br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
        </p>

        <p style="font-size: 14px; color: #666; margin-top: 20px;">
            ※このリンクは24時間有効です。<br>
            ※このメールに心当たりがない場合は、お手数ですが削除してください。
        </p>
    </div>

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        <p>このメールは +TASTAS より自動送信されています。</p>
    </div>
</body>
</html>`;

  return NextResponse.json({
    status: 'pending',
    verifyUrl: verificationUrl,
    emailHtml,
    tokenExpires: user.verification_token_expires,
  });
}
