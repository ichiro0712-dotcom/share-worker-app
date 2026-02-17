/**
 * LP帰属（Attribution）ユーティリティ
 *
 * 会員登録時にLP情報が取得できなかった場合のIPアドレスフォールバック。
 * 7日以内のLpPageViewから同一IPのレコードを検索し、
 * ユニークなLP IDが1つのみの場合に帰属を推定する。
 *
 * 偽陽性防止:
 * - モバイルキャリアNAT等で同一IPを多数のユーザーが共有するケースを考慮
 * - 同一IPで複数のLPが閲覧されていた場合は帰属しない
 */
import prisma from '@/lib/prisma';

interface LpAttributionResult {
  lpId: string;
  campaignCode: string | null;
  genrePrefix: string | null;
}

/**
 * IPアドレスからLP帰属を推定する
 *
 * @param ipAddress 登録ユーザーのIPアドレス
 * @returns LP帰属情報（推定できた場合）またはnull
 */
export async function findLpByIpAddress(
  ipAddress: string | null
): Promise<LpAttributionResult | null> {
  if (!ipAddress) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const pageViews = await prisma.lpPageView.findMany({
    where: {
      ip_address: ipAddress,
      created_at: { gte: sevenDaysAgo },
    },
    select: {
      lp_id: true,
      campaign_code: true,
    },
    orderBy: { created_at: 'desc' },
  });

  if (pageViews.length === 0) return null;

  // ユニークLP IDが1つのみの場合だけ採用（偽陽性防止）
  const uniqueLpIds = new Set(pageViews.map(pv => pv.lp_id));
  if (uniqueLpIds.size !== 1) return null;

  // 最新のレコードからキャンペーンコードを取得
  const mostRecent = pageViews[0];
  const genrePrefix = mostRecent.campaign_code?.match(/^([A-Z]{3})-/)?.[1] || null;

  return {
    lpId: mostRecent.lp_id,
    campaignCode: mostRecent.campaign_code,
    genrePrefix,
  };
}
