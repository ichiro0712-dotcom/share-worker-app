import { prisma } from '@/lib/prisma';
import { SYSTEM_SETTING_KEYS } from '@/src/lib/constants/systemSettings';

// Resend Pro plan: 50,000 emails/month
export const RESEND_MONTHLY_LIMIT = 50_000;
export const RESEND_WARNING_THRESHOLD = 0.80;  // 80%
export const RESEND_CRITICAL_THRESHOLD = 0.95; // 95%

/**
 * Resend APIレスポンスヘッダーから月間送信数をキャッシュ
 * Fire-and-forget: メール送信の成功に影響させない
 */
export async function cacheResendQuotaHeader(quotaValue: string): Promise<void> {
    try {
        await prisma.systemSetting.upsert({
            where: { key: SYSTEM_SETTING_KEYS.RESEND_QUOTA_HEADER_CACHE },
            create: {
                key: SYSTEM_SETTING_KEYS.RESEND_QUOTA_HEADER_CACHE,
                value: quotaValue,
                description: 'Resend APIレスポンスヘッダーから取得した月間送信数',
            },
            update: {
                value: quotaValue,
            },
        });
    } catch (err) {
        console.warn('[Resend Quota] Failed to cache quota header:', err);
    }
}
