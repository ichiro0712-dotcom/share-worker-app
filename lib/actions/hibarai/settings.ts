// 日払いの全体設定（手数料・GMO残高アラート閾値）の読み取りと、GMO残高取得。
// 'use server' にしない（公開アクションは settings-action.ts のみ）。
import prisma from '@/lib/prisma'
import { createGmoClient } from '@/lib/gmo-aozora'
import { getActiveAccessToken } from './oauth-token'
import { getDefaultWithdrawalFee } from './utils'

export const FEE_SETTING_KEY = 'hibarai_withdrawal_fee_jpy'
export const GMO_THRESHOLDS_KEY = 'hibarai_gmo_balance_thresholds'

export type GmoBalanceThresholds = {
  /** 注意（黄）: 残高がこの額を下回ったら */
  caution: number
  /** 警告（橙） */
  warning: number
  /** 危険（赤） */
  critical: number
}

export type GmoBalanceLevel = 'ok' | 'caution' | 'warning' | 'critical'

export const DEFAULT_GMO_THRESHOLDS: GmoBalanceThresholds = {
  caution: 1_000_000,
  warning: 500_000,
  critical: 200_000,
}

/** 残高と閾値からアラートレベルを判定する（純粋関数）。caution > warning > critical 前提。 */
export function gmoBalanceLevel(balance: number, t: GmoBalanceThresholds): GmoBalanceLevel {
  if (balance < t.critical) return 'critical'
  if (balance < t.warning) return 'warning'
  if (balance < t.caution) return 'caution'
  return 'ok'
}

/** 手数料設定値をパースする（不正なら null）（純粋関数） */
export function parseFee(value: string | null | undefined): number | null {
  // 空文字は Number('')===0 になり手数料0(無料出金)になってしまうため明示的に弾く
  if (value == null || value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** 閾値設定(JSON)をパースする。不正な項目はデフォルトで補完（純粋関数） */
export function parseThresholds(value: string | null | undefined): GmoBalanceThresholds {
  if (!value) return { ...DEFAULT_GMO_THRESHOLDS }
  try {
    const o = JSON.parse(value) as Partial<GmoBalanceThresholds>
    const pick = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)
    return {
      caution: pick(o.caution, DEFAULT_GMO_THRESHOLDS.caution),
      warning: pick(o.warning, DEFAULT_GMO_THRESHOLDS.warning),
      critical: pick(o.critical, DEFAULT_GMO_THRESHOLDS.critical),
    }
  } catch {
    return { ...DEFAULT_GMO_THRESHOLDS }
  }
}

export type HibaraiSettings = {
  withdrawalFeeJpy: number
  gmoThresholds: GmoBalanceThresholds
}

export async function getHibaraiSettings(): Promise<HibaraiSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [FEE_SETTING_KEY, GMO_THRESHOLDS_KEY] } },
    select: { key: true, value: true },
  })
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  return {
    withdrawalFeeJpy: parseFee(byKey.get(FEE_SETTING_KEY)) ?? getDefaultWithdrawalFee(),
    gmoThresholds: parseThresholds(byKey.get(GMO_THRESHOLDS_KEY)),
  }
}

/** 保存済み手数料(parse結果)から実際に使う手数料を決める（純粋）。
 * 0や不正値は無料出金を避けるため fallback(env/既定) を使う。 */
export function resolveEffectiveFee(parsed: number | null, fallback: number): number {
  return parsed != null && parsed >= 1 ? parsed : fallback
}

/** 出金時に使う有効手数料。DB設定(正値) > env > 既定143。 */
export async function getEffectiveWithdrawalFee(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: FEE_SETTING_KEY }, select: { value: true } })
  return resolveEffectiveFee(parseFee(row?.value), getDefaultWithdrawalFee())
}

export type GmoBalanceView = {
  available: boolean
  withdrawableAmount: number | null
  level: GmoBalanceLevel | null
  thresholds: GmoBalanceThresholds
}

/** GMO送金元口座の引き出し可能残高と、アラートレベルを取得する。 */
export async function getGmoRemitterBalance(): Promise<GmoBalanceView> {
  const thresholds = parseThresholds(
    (await prisma.systemSetting.findUnique({ where: { key: GMO_THRESHOLDS_KEY }, select: { value: true } }))?.value
  )
  try {
    const token = await getActiveAccessToken()
    const client = createGmoClient()
    const accountId = process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID
    const res = await client.getBalance(token, accountId)
    const first = res.balances[0]
    if (!first) return { available: false, withdrawableAmount: null, level: null, thresholds }
    const withdrawable = Number(first.withdrawableAmount ?? first.balance)
    const amount = Number.isFinite(withdrawable) ? withdrawable : 0
    return { available: true, withdrawableAmount: amount, level: gmoBalanceLevel(amount, thresholds), thresholds }
  } catch {
    return { available: false, withdrawableAmount: null, level: null, thresholds }
  }
}
