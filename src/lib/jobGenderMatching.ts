/**
 * 求人の性別指定とワーカーの性別をマッチング判定するヘルパー
 *
 * 仕様:
 * - 求人の gender_requirement が NULL: 全ワーカー対象
 * - gender_requirement = 'MALE_ONLY': User.gender = '男性' のみ
 * - gender_requirement = 'FEMALE_ONLY': User.gender = '女性' のみ
 * - 性別未登録(NULL)/その他: 性別指定のある求人は表示・応募不可
 */

import type { Prisma } from '@prisma/client';

/**
 * Prismaの where 句に AND で結合する性別フィルタを生成
 * 一覧クエリで使用
 */
export function buildGenderFilterWhere(
  userGender: string | null | undefined
): Prisma.JobWhereInput {
  if (userGender === '男性') {
    return { OR: [{ gender_requirement: null }, { gender_requirement: 'MALE_ONLY' }] };
  }
  if (userGender === '女性') {
    return { OR: [{ gender_requirement: null }, { gender_requirement: 'FEMALE_ONLY' }] };
  }
  return { gender_requirement: null };
}

/**
 * 個別求人 vs ユーザー性別の応募可否判定
 * 詳細ページ・応募サーバーアクションで使用
 */
export function canApplyByGender(
  jobGenderRequirement: string | null | undefined,
  userGender: string | null | undefined
): { allowed: boolean; reason?: string } {
  if (!jobGenderRequirement) return { allowed: true };
  if (jobGenderRequirement === 'MALE_ONLY' && userGender === '男性') return { allowed: true };
  if (jobGenderRequirement === 'FEMALE_ONLY' && userGender === '女性') return { allowed: true };
  return {
    allowed: false,
    reason: 'この求人は応募条件を満たしていないため応募不可です',
  };
}
