import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import crypto from 'crypto';

// Resend設定（遅延初期化 - APIキーがない場合はnull）
let resend: Resend | null = null;
function getResendClient(): Resend | null {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';
const APP_URL = process.env.NEXTAUTH_URL || 'https://tastas.jp';

// トークン有効期限（24時間）
const TOKEN_EXPIRY_HOURS = 24;

/**
 * セキュアな認証トークンを生成
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * ユーザーに認証トークンを設定し、認証メールを送信
 */
export async function sendVerificationEmail(
  userId: number,
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // トークン生成
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // ユーザーにトークンを保存
    await prisma.user.update({
      where: { id: userId },
      data: {
        verification_token: token,
        verification_token_expires: expiresAt,
      },
    });

    // 認証URL
    const verificationUrl = `${APP_URL}/auth/verify?token=${token}`;

    // メール送信が無効化されている場合はログのみ
    if (process.env.DISABLE_EMAIL_SENDING === 'true') {
      console.log('[Email Verification] Sending disabled, logging only:', {
        to: email,
        verificationUrl,
      });
      return { success: true };
    }

    // メール送信
    const client = getResendClient();
    if (!client) {
      console.log('[Email Verification] Resend API key not configured, skipping email');
      return { success: true };
    }

    const { error } = await client.emails.send({
      from: `+TASTAS <${FROM_EMAIL}>`,
      to: [email],
      subject: '【+TASTAS】メールアドレスの確認',
      html: formatVerificationEmailHtml(name, verificationUrl),
      text: formatVerificationEmailText(name, verificationUrl),
    });

    if (error) {
      console.error('[Email Verification] Failed to send:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email Verification] Sent successfully to:', email);
    return { success: true };
  } catch (error: any) {
    console.error('[Email Verification] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 認証トークンを検証し、ユーザーを認証済みに更新
 */
export async function verifyEmailToken(
  token: string
): Promise<{ success: boolean; error?: string; userId?: number }> {
  try {
    // トークンでユーザーを検索
    const user = await prisma.user.findFirst({
      where: {
        verification_token: token,
        email_verified: false,
      },
    });

    if (!user) {
      return { success: false, error: '無効な認証リンクです。' };
    }

    // 有効期限チェック
    if (user.verification_token_expires && user.verification_token_expires < new Date()) {
      return { success: false, error: '認証リンクの有効期限が切れています。再送信してください。' };
    }

    // 認証済みに更新
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        verification_token: null,
        verification_token_expires: null,
      },
    });

    console.log('[Email Verification] User verified:', user.id);
    return { success: true, userId: user.id };
  } catch (error: any) {
    console.error('[Email Verification] Verification error:', error);
    return { success: false, error: 'システムエラーが発生しました。' };
  }
}

/**
 * 認証メールを再送信
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // メールアドレスでユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // セキュリティのため、ユーザーが存在しない場合もエラーを返さない
      return { success: true };
    }

    if (user.email_verified) {
      return { success: false, error: 'このメールアドレスは既に認証済みです。' };
    }

    // 再送信
    return await sendVerificationEmail(user.id, user.email, user.name);
  } catch (error: any) {
    console.error('[Email Verification] Resend error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 認証メールのHTML本文
 */
function formatVerificationEmailHtml(name: string, verificationUrl: string): string {
  return `
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
}

/**
 * 認証メールのプレーンテキスト本文
 */
function formatVerificationEmailText(name: string, verificationUrl: string): string {
  return `
${name} 様

+TASTASへのご登録ありがとうございます。

下記のURLをクリックして、メールアドレスの確認を完了してください：

${verificationUrl}

※このリンクは24時間有効です。
※このメールに心当たりがない場合は、お手数ですが削除してください。

---
このメールは +TASTAS より自動送信されています。
`;
}
