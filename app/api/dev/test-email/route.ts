import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';

/**
 * メール送信テスト用APIエンドポイント
 * 開発環境でのみ使用可能
 *
 * POST /api/dev/test-email
 * Body: { to: string, subject?: string, body?: string }
 */
export async function POST(request: NextRequest) {
    // 開発環境チェック
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'This endpoint is only available in development' },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const { to, subject, body: emailBody } = body;

        if (!to) {
            return NextResponse.json(
                { error: 'to is required' },
                { status: 400 }
            );
        }

        const testSubject = subject || '【テスト】+TASTAS メール送信テスト';
        const testBody = emailBody || `
これはテストメールです。

+TASTAS からのメール送信が正常に動作しています。

送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
送信先: ${to}
送信元: ${FROM_EMAIL}

---
+TASTAS 運営
        `.trim();

        const { data, error } = await resend.emails.send({
            from: `+TASTAS <${FROM_EMAIL}>`,
            to: [to],
            subject: testSubject,
            html: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50;">
        <h2 style="color: #2e7d32; margin-top: 0;">✅ メール送信テスト成功</h2>
        ${testBody.replace(/\n/g, '<br>')}
    </div>
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        <p>このメールは開発環境からのテスト送信です。</p>
    </div>
</body>
</html>`,
            text: testBody,
        });

        if (error) {
            console.error('[Test Email] Failed:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        console.log('[Test Email] Sent successfully:', data);
        return NextResponse.json({
            success: true,
            messageId: data?.id,
            to,
            from: FROM_EMAIL,
        });
    } catch (error: any) {
        console.error('[Test Email] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * GET: API情報を返す
 */
export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'This endpoint is only available in development' },
            { status: 403 }
        );
    }

    return NextResponse.json({
        endpoint: '/api/dev/test-email',
        method: 'POST',
        description: 'Test email sending with Resend',
        body: {
            to: 'string (required) - recipient email address',
            subject: 'string (optional) - email subject',
            body: 'string (optional) - email body text',
        },
        example: {
            to: 'test@example.com',
            subject: 'テストメール',
            body: 'これはテストです',
        },
        config: {
            from: FROM_EMAIL,
            resendConfigured: !!process.env.RESEND_API_KEY,
        },
    });
}
