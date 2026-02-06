import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { cacheResendQuotaHeader } from '@/src/lib/resend-quota';

export const dynamic = 'force-dynamic';

// Resend設定
let resend: Resend | null = null;
function getResendClient(): Resend | null {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';

// システム設定のキー
const LAST_CHECKED_KEY = 'error_alert_last_checked_at';

/**
 * Cron APIの認証を検証
 */
function verifyCronAuth(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'development' && !cronSecret) {
        console.warn('[ERROR_ALERT] Warning: CRON_SECRET is not set. Skipping auth in development.');
        return true;
    }

    if (!cronSecret) {
        console.error('[ERROR_ALERT] Error: CRON_SECRET environment variable is not set');
        return false;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) {
        return true;
    }

    const url = new URL(request.url);
    const querySecret = url.searchParams.get('secret');
    if (querySecret === cronSecret) {
        return true;
    }

    return false;
}

/**
 * エラーダイジェストメールを生成
 */
function generateErrorDigestHtml(errors: {
    id: number;
    action: string;
    error_message: string | null;
    user_type: string;
    user_id: number | null;
    user_email: string | null;
    url: string | null;
    created_at: Date;
}[]): string {
    const errorRows = errors.map(err => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-size: 12px; color: #6b7280;">
                ${err.created_at.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
            </td>
            <td style="padding: 12px;">
                <span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                    ${err.action}
                </span>
            </td>
            <td style="padding: 12px; font-size: 13px; color: #374151; max-width: 300px; word-break: break-all;">
                ${err.error_message || '-'}
            </td>
            <td style="padding: 12px; font-size: 12px; color: #6b7280;">
                ${err.user_type} / ${err.user_id || 'GUEST'}
            </td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>エラーアラート - TASTAS</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; padding: 20px;">
    <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #dc2626; color: white; padding: 20px;">
            <h1 style="margin: 0; font-size: 20px;">⚠️ エラーアラート - TASTAS</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">
                直近5分間で ${errors.length} 件のエラーが検出されました
            </p>
        </div>

        <div style="padding: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151;">日時</th>
                        <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151;">アクション</th>
                        <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151;">エラー内容</th>
                        <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151;">ユーザー</th>
                    </tr>
                </thead>
                <tbody>
                    ${errorRows}
                </tbody>
            </table>
        </div>

        <div style="background: #f9fafb; padding: 16px 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
                詳細は <a href="https://tastas.work/system-admin/dev-portal/logs" style="color: #2563eb;">バグ調査ダッシュボード</a> で確認できます。
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

export async function GET(request: NextRequest) {
    // 認証チェック
    if (!verifyCronAuth(request)) {
        console.warn('[ERROR_ALERT] Unauthorized cron request attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 本番環境のみで実行
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
        console.log('[ERROR_ALERT] Skipping in non-production environment');
        return NextResponse.json({ success: true, skipped: true, reason: 'non-production' });
    }

    try {
        const now = new Date();

        // 1. 最終チェック日時を取得
        const lastCheckedSetting = await prisma.systemSetting.findUnique({
            where: { key: LAST_CHECKED_KEY },
        });

        // 初回実行時は5分前から
        const lastCheckedAt = lastCheckedSetting
            ? new Date(lastCheckedSetting.value)
            : new Date(now.getTime() - 5 * 60 * 1000);

        console.log('[ERROR_ALERT] Checking errors since:', lastCheckedAt.toISOString());

        // 2. 新しいエラーを取得
        const newErrors = await prisma.userActivityLog.findMany({
            where: {
                result: 'ERROR',
                created_at: {
                    gt: lastCheckedAt,
                },
            },
            orderBy: {
                created_at: 'desc',
            },
            take: 50, // 最大50件に制限
        });

        console.log(`[ERROR_ALERT] Found ${newErrors.length} new errors`);

        // 3. エラーがあれば通知
        if (newErrors.length > 0) {
            // 通知先を取得
            const recipients = await prisma.errorAlertRecipient.findMany({
                where: { is_active: true },
            });

            if (recipients.length > 0) {
                const client = getResendClient();

                if (client) {
                    const emailHtml = generateErrorDigestHtml(newErrors);
                    const toAddresses = recipients.map(r => r.email);

                    try {
                        const { headers: resendHeaders } = await client.emails.send({
                            from: FROM_EMAIL,
                            to: toAddresses,
                            subject: `⚠️ [TASTAS] ${newErrors.length}件のエラーが検出されました`,
                            html: emailHtml,
                        });

                        // Resend月間送信数ヘッダーをキャッシュ（fire-and-forget）
                        if (resendHeaders?.['x-resend-monthly-quota']) {
                            cacheResendQuotaHeader(resendHeaders['x-resend-monthly-quota']).catch(() => {});
                        }

                        console.log(`[ERROR_ALERT] Sent alert email to ${toAddresses.length} recipients`);
                    } catch (emailError) {
                        console.error('[ERROR_ALERT] Failed to send email:', emailError);
                    }
                } else {
                    console.warn('[ERROR_ALERT] Resend client not available');
                }
            } else {
                console.log('[ERROR_ALERT] No active recipients configured');
            }
        }

        // 4. 最終チェック日時を更新
        await prisma.systemSetting.upsert({
            where: { key: LAST_CHECKED_KEY },
            create: {
                key: LAST_CHECKED_KEY,
                value: now.toISOString(),
                description: 'エラー通知の最終チェック日時',
            },
            update: {
                value: now.toISOString(),
            },
        });

        return NextResponse.json({
            success: true,
            checked_since: lastCheckedAt.toISOString(),
            errors_found: newErrors.length,
            notified: newErrors.length > 0,
        });
    } catch (error) {
        console.error('[ERROR_ALERT] Cron error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
