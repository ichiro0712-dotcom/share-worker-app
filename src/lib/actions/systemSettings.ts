'use server';

import { prisma } from '@/lib/prisma';
import {
  SYSTEM_SETTING_DEFAULTS,
  SYSTEM_SETTING_DESCRIPTIONS,
} from '@/src/lib/constants/systemSettings';

/**
 * システム設定を取得
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (setting) {
      return setting.value;
    }

    // デフォルト値があればそれを返す
    return SYSTEM_SETTING_DEFAULTS[key] ?? null;
  } catch (error) {
    console.error('[getSystemSetting] Error:', error);
    return SYSTEM_SETTING_DEFAULTS[key] ?? null;
  }
}

/**
 * システム設定を取得（ブール値として）
 */
export async function getSystemSettingBoolean(key: string): Promise<boolean> {
  const value = await getSystemSetting(key);
  return value === 'true';
}

/**
 * システム設定を取得（数値として）
 */
export async function getSystemSettingNumber(key: string): Promise<number | null> {
  const value = await getSystemSetting(key);
  if (value === null) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * 全システム設定を取得
 */
export async function getAllSystemSettings(): Promise<Record<string, string>> {
  try {
    const settings = await prisma.systemSetting.findMany();

    // デフォルト値をベースに、DB値で上書き
    const result: Record<string, string> = { ...SYSTEM_SETTING_DEFAULTS };
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }

    return result;
  } catch (error) {
    console.error('[getAllSystemSettings] Error:', error);
    return SYSTEM_SETTING_DEFAULTS;
  }
}

/**
 * システム設定を更新
 */
export async function updateSystemSetting(
  key: string,
  value: string,
  updatedBy?: { type: string; id: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value,
        updated_by_type: updatedBy?.type,
        updated_by_id: updatedBy?.id,
      },
      create: {
        key,
        value,
        description: SYSTEM_SETTING_DESCRIPTIONS[key] ?? '',
        updated_by_type: updatedBy?.type,
        updated_by_id: updatedBy?.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[updateSystemSetting] Error:', error);
    return { success: false, error: '設定の更新に失敗しました' };
  }
}

/**
 * 複数のシステム設定を一括更新
 */
export async function updateSystemSettings(
  settings: Record<string, string>,
  updatedBy?: { type: string; id: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates = Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: {
          value,
          updated_by_type: updatedBy?.type,
          updated_by_id: updatedBy?.id,
        },
        create: {
          key,
          value,
          description: SYSTEM_SETTING_DESCRIPTIONS[key] ?? '',
          updated_by_type: updatedBy?.type,
          updated_by_id: updatedBy?.id,
        },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  } catch (error) {
    console.error('[updateSystemSettings] Error:', error);
    return { success: false, error: '設定の更新に失敗しました' };
  }
}
