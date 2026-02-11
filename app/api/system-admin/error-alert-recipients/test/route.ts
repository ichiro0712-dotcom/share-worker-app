import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { Resend } from 'resend';

// Resend設定
let resend: Resend | null = null;
function getResendClient(): Resend | null {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';

// POST: テストメールを送信
export async function POST() {
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 有効な通知先を取得
        const recipients = await prisma.errorAlertRecipient.findMany({
            where: { is_active: true },
        });

        if (recipients.length === 0) {
            return NextResponse.json({ error: '有効な通知先がありません' }, { status: 400 });
        }

        const client = getResendClient();
        if (!client) {
            return NextResponse.json({ error: 'メール送信が設定されていません' }, { status: 500 });
        }

        const toAddresses = recipients.map(r => r.email);

        // テストメールを送信
        await client.emails.send({
            from: FROM_EMAIL,
            to: toAddresses,
            subject: '【テスト】タスタス エラー通知設定の確認',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>テスト通知 - タスタス</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #4f46e5; color: white; padding: 20px;">
            <h1 style="margin: 0; font-size: 20px;">✅ テスト通知 - タスタス</h1>
        </div>

        <div style="padding: 20px;">
            <p style="color: #374151; margin: 0 0 16px 0;">
                このメールはエラー通知設定のテストです。
            </p>
            <p style="color: #374151; margin: 0 0 16px 0;">
                このメールが届いていれば、エラー通知の設定は正常に機能しています。
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                本番環境でエラーが発生した場合、このアドレスにダイジェストメールが送信されます。
            </p>
        </div>

        <div style="background: #f9fafb; padding: 16px 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
                送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
            </p>
        </div>
    </div>
</body>
</html>
            `,
        });

        console.log(`[ERROR_ALERT] Test email sent to ${toAddresses.length} recipients`);

        return NextResponse.json({
            success: true,
            sent_to: toAddresses.length,
        });
    } catch (error) {
        console.error('Failed to send test email:', error);
        return NextResponse.json({ error: 'メール送信に失敗しました' }, { status: 500 });
    }
}
