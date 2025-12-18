'use server';

import { prisma } from '@/lib/prisma';

// 固定の担当者リスト（A〜Jさん）
const DEBUG_USERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export type DebugUser = typeof DEBUG_USERS[number];

/**
 * 指定ユーザーのチェック状態を取得
 */
export async function getDebugCheckProgress(userName: DebugUser): Promise<Record<string, boolean>> {
  const records = await prisma.debugCheckProgress.findMany({
    where: { user_name: userName },
  });

  const result: Record<string, boolean> = {};
  for (const record of records) {
    result[record.item_key] = record.checked;
  }
  return result;
}

/**
 * 全ユーザーのチェック状態を取得（進捗一覧表示用）
 */
export async function getAllUsersProgress(): Promise<Record<DebugUser, number>> {
  const counts = await prisma.debugCheckProgress.groupBy({
    by: ['user_name'],
    where: { checked: true },
    _count: { id: true },
  });

  const result: Record<string, number> = {};
  for (const user of DEBUG_USERS) {
    result[user] = 0;
  }
  for (const count of counts) {
    result[count.user_name] = count._count.id;
  }
  return result as Record<DebugUser, number>;
}

/**
 * チェック状態を更新（トグル）
 */
export async function toggleDebugCheck(
  userName: DebugUser,
  itemKey: string,
  checked: boolean
): Promise<{ success: boolean }> {
  try {
    if (checked) {
      // チェックON → レコード作成（upsert）
      await prisma.debugCheckProgress.upsert({
        where: {
          user_name_item_key: {
            user_name: userName,
            item_key: itemKey,
          },
        },
        update: { checked: true },
        create: {
          user_name: userName,
          item_key: itemKey,
          checked: true,
        },
      });
    } else {
      // チェックOFF → レコード削除
      await prisma.debugCheckProgress.deleteMany({
        where: {
          user_name: userName,
          item_key: itemKey,
        },
      });
    }
    return { success: true };
  } catch (error) {
    console.error('toggleDebugCheck error:', error);
    return { success: false };
  }
}

/**
 * 指定ユーザーの全チェックをリセット
 */
export async function resetUserProgress(userName: DebugUser): Promise<{ success: boolean }> {
  try {
    await prisma.debugCheckProgress.deleteMany({
      where: { user_name: userName },
    });
    return { success: true };
  } catch (error) {
    console.error('resetUserProgress error:', error);
    return { success: false };
  }
}

/**
 * 全ユーザーの全チェックをリセット（データクリーンアップ用）
 */
export async function resetAllUsersProgress(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const result = await prisma.debugCheckProgress.deleteMany({});
    return { success: true, deletedCount: result.count };
  } catch (error) {
    console.error('resetAllUsersProgress error:', error);
    return { success: false, deletedCount: 0 };
  }
}
