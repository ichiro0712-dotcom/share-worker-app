import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SYSTEM_SETTING_KEYS } from '@/src/lib/constants/systemSettings';

export const dynamic = 'force-dynamic';

/**
 * Cron APIの認証を検証
 */
function verifyCronAuth(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'development' && !cronSecret) {
        console.warn('[EMAIL_QUOTA] Warning: CRON_SECRET is not set');
        return true;
    }

    if (!cronSecret) return false;

    // Bearer tokenチェック
    const authHeader = request.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) return true;

    // クエリパラメータチェック（Vercel Cron用）
    const url = new URL(request.url);
    if (url.searchParams.get('secret') === cronSecret) return true;

    return false;
}

/**
 * メール送信数集計Cron
 * - notificationLogテーブルから当月のEMAIL送信数を集計
 * - Resend APIヘッダーのキャッシュ値とクロスチェック
 * - 結果をsystemSettingに保存（ダッシュボード表示用）
 */
export async function GET(request: NextRequest) {
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // JST月初を計算
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        const jstNow = new Date(now.getTime() + jstOffset);
        const monthStartUtc = new Date(
            Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1) - jstOffset
        );

        // DB集計: 当月のメール送信数（SENT のみ）
        const dbEmailCount = await prisma.notificationLog.count({
            where: {
                channel: 'EMAIL',
                status: 'SENT',
                created_at: { gte: monthStartUtc },
            },
        });

        // キャッシュ済みResend APIヘッダー値を読み取り
        const cachedQuota = await prisma.systemSetting.findUnique({
            where: { key: SYSTEM_SETTING_KEYS.RESEND_QUOTA_HEADER_CACHE },
        });
        const apiQuotaUsed = cachedQuota ? parseInt(cachedQuota.value, 10) || 0 : 0;

        // 大きい方を有効値とする
        const effectiveCount = Math.max(dbEmailCount, apiQuotaUsed);

        // 集計結果をsystemSettingに保存
        const resultJson = JSON.stringify({
            dbCount: dbEmailCount,
            apiQuotaUsed,
            effectiveCount,
            monthStart: monthStartUtc.toISOString(),
            checkedAt: now.toISOString(),
        });

        await prisma.systemSetting.upsert({
            where: { key: SYSTEM_SETTING_KEYS.RESEND_EMAIL_MONTHLY_COUNT },
            create: {
                key: SYSTEM_SETTING_KEYS.RESEND_EMAIL_MONTHLY_COUNT,
                value: resultJson,
                description: 'Resendメール月間送信数（cron集計結果）',
            },
            update: {
                value: resultJson,
            },
        });

        console.log(`[EMAIL_QUOTA] Aggregated: db=${dbEmailCount}, api=${apiQuotaUsed}, effective=${effectiveCount}`);

        return NextResponse.json({
            success: true,
            dbEmailCount,
            apiQuotaUsed,
            effectiveCount,
            monthStart: monthStartUtc.toISOString(),
        });
    } catch (error) {
        console.error('[EMAIL_QUOTA] Cron error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
