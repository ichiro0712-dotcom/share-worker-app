/**
 * レート制限
 *
 * - admin_id × 1時間あたり N リクエスト
 * - admin_id × 1日あたり M リクエスト
 *
 * Redis なしの DB ベース実装。`AdvisorChatMessage.created_at` を集計する。
 * 軽量クエリ (admin_id × created_at index) なのでパフォーマンス問題はない想定。
 */

import { countUserMessagesByAdmin } from './persistence/messages';

const PER_HOUR_DEFAULT = 60;
const PER_DAY_DEFAULT = 500;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSec?: number;
  hourCount: number;
  dayCount: number;
  hourLimit: number;
  dayLimit: number;
}

export async function checkRateLimit(adminId: number): Promise<RateLimitResult> {
  const perHour = parseInt(process.env.ADVISOR_RATE_LIMIT_PER_HOUR ?? '') || PER_HOUR_DEFAULT;
  const perDay = parseInt(process.env.ADVISOR_RATE_LIMIT_PER_DAY ?? '') || PER_DAY_DEFAULT;

  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [hourCount, dayCount] = await Promise.all([
    countUserMessagesByAdmin({ adminId, since: oneHourAgo }),
    countUserMessagesByAdmin({ adminId, since: oneDayAgo }),
  ]);

  if (hourCount >= perHour) {
    return {
      allowed: false,
      reason: `1時間あたりの上限 ${perHour} 件に到達しました`,
      retryAfterSec: 60 * 60,
      hourCount,
      dayCount,
      hourLimit: perHour,
      dayLimit: perDay,
    };
  }
  if (dayCount >= perDay) {
    return {
      allowed: false,
      reason: `1日あたりの上限 ${perDay} 件に到達しました`,
      retryAfterSec: 24 * 60 * 60,
      hourCount,
      dayCount,
      hourLimit: perHour,
      dayLimit: perDay,
    };
  }
  return { allowed: true, hourCount, dayCount, hourLimit: perHour, dayLimit: perDay };
}
