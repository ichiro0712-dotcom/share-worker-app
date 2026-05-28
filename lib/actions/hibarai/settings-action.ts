'use server'

import { Prisma } from '@prisma/client'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'
import { createHibaraiAuditLog } from './audit'
import { FEE_SETTING_KEY, GMO_THRESHOLDS_KEY, type GmoBalanceThresholds } from './settings'

export type SaveHibaraiSettingsInput = {
  withdrawalFeeJpy: number
  gmoThresholds: GmoBalanceThresholds
}

/**
 * 日払い全体設定（手数料・GMO残高アラート閾値）を保存する。
 * System Admin 認証必須。変更は監査ログに記録する。
 */
export async function saveHibaraiSettings(
  input: SaveHibaraiSettingsInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isHibaraiEnabled()) return { ok: false, error: 'Feature disabled' }
  const session = await getSystemAdminSessionData()
  if (!session?.adminId) return { ok: false, error: '認証が必要です' }

  const fee = input.withdrawalFeeJpy
  // 手数料0は無料出金になり得るため正の整数のみ許可
  if (!Number.isInteger(fee) || fee < 1 || fee > 100000) {
    return { ok: false, error: '手数料は1〜100000の整数で入力してください' }
  }
  const t = input.gmoThresholds
  for (const v of [t.caution, t.warning, t.critical]) {
    if (!Number.isFinite(v) || v < 0 || !Number.isSafeInteger(v)) {
      return { ok: false, error: '閾値は0以上の整数で入力してください' }
    }
  }
  if (!(t.caution >= t.warning && t.warning >= t.critical)) {
    return { ok: false, error: '閾値は 注意 ≥ 警告 ≥ 危険 の順にしてください' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const adminId = session.adminId
      const upsert = (key: string, value: string, description: string) =>
        tx.systemSetting.upsert({
          where: { key },
          create: { key, value, description, updated_by_type: 'SYSTEM_ADMIN', updated_by_id: adminId },
          update: { value, updated_by_type: 'SYSTEM_ADMIN', updated_by_id: adminId },
        })
      await upsert(FEE_SETTING_KEY, String(fee), '日払い 振込手数料(円)')
      await upsert(GMO_THRESHOLDS_KEY, JSON.stringify(t), '日払い GMO残高アラート閾値(円)')

      await createHibaraiAuditLog(tx, {
        actorType: 'SYSTEM_ADMIN',
        actorId: String(adminId),
        action: 'HIBARAI_SETTINGS_UPDATED',
        targetType: 'SystemSetting',
        payload: { withdrawalFeeJpy: fee, gmoThresholds: t } as Prisma.InputJsonValue,
        result: 'SUCCESS',
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存に失敗しました' }
  }
}
