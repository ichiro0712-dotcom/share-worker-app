import { NextRequest, NextResponse } from 'next/server';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { getVersionForLog } from '@/lib/version';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';

let resend: Resend | null = null;
function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function POST(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { to, subject, body: emailBody, recipientId, targetType } = body;

    if (!to) {
      return NextResponse.json({ error: 'to is required' }, { status: 400 });
    }

    const client = getResendClient();
    if (!client) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY が設定されていません' },
        { status: 500 }
      );
    }

    const finalSubject = subject || '【テスト】+タスタス メール送信テスト';
    const finalBody = emailBody || `これはシステム管理者からのテストメールです。\n\n送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

    const htmlBody = finalBody.replace(/\n/g, '<br>');
    const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50;">
    <h2 style="color: #2e7d32; margin-top: 0;">テスト通知</h2>
    <p>${htmlBody}</p>
  </div>
  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
    <p>このメールはシステム管理者によるテスト送信です。</p>
  </div>
</body></html>`;

    const { data, error } = await client.emails.send({
      from: `+タスタス <${FROM_EMAIL}>`,
      to: [to],
      subject: finalSubject,
      html,
      text: finalBody,
    });

    const versionInfo = getVersionForLog();

    if (error) {
      if (recipientId) {
        await prisma.notificationLog.create({
          data: {
            notification_key: 'SYSTEM_ADMIN_TEST_EMAIL',
            channel: 'EMAIL',
            target_type: targetType || 'WORKER',
            recipient_id: recipientId,
            recipient_name: '',
            recipient_email: to,
            from_address: FROM_EMAIL,
            to_addresses: [to],
            subject: finalSubject,
            body: finalBody,
            status: 'FAILED',
            error_message: error.message,
            app_version: versionInfo.app_version,
            deployment_id: versionInfo.deployment_id,
          },
        }).catch((e) => console.error('[Test Email] Log save failed:', e));
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (recipientId) {
      await prisma.notificationLog.create({
        data: {
          notification_key: 'SYSTEM_ADMIN_TEST_EMAIL',
          channel: 'EMAIL',
          target_type: targetType || 'WORKER',
          recipient_id: recipientId,
          recipient_name: '',
          recipient_email: to,
          from_address: FROM_EMAIL,
          to_addresses: [to],
          subject: finalSubject,
          body: finalBody,
          status: 'SENT',
          app_version: versionInfo.app_version,
          deployment_id: versionInfo.deployment_id,
        },
      }).catch((e) => console.error('[Test Email] Log save failed:', e));
    }

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (error: any) {
    console.error('[Test Email] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
