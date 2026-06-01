// GMO送金元口座の残高アラート: 閾値を下回ったらSystem Admin全員にメール通知する。
// 'use server' にしない（cron からのみ呼ぶ。公開アクションにはしない）。
// 連発防止: レベルごとに1日1回（同一レベルは同一JST日に1通まで）。
import { Prisma } from '@prisma/client'
import { Resend } from 'resend'
import prisma from '@/lib/prisma'
import { cacheResendQuotaHeader } from '@/src/lib/resend-quota'
import { recordHibaraiAudit } from './audit'
import {
  getGmoRemitterBalance,
  type GmoBalanceLevel,
  type GmoBalanceThresholds,
} from './settings'

/** クールダウン状態の保存キー（SystemSetting）。 */
export const GMO_ALERT_STATE_KEY = 'hibarai_gmo_alert_state'

export type AlertLevel = Exclude<GmoBalanceLevel, 'ok'>

/** レベルごとに「最後に通知したJST日付(YYYY-MM-DD)」を保持する。 */
export type GmoAlertState = { sentByLevel: Partial<Record<AlertLevel, string>> }

/**
 * 残高レベルと前回アラート状態から、今回通知すべきかを判定する（純粋関数）。
 * レベルごとに1日1回。回復(ok)しても当日の送信履歴は消さない（閾値付近の振動で連発しないため）。
 * 悪化（例: caution→critical）は、その悪化レベルが当日未送信なら通知される。
 */
export function decideGmoAlert(
  level: GmoBalanceLevel,
  state: GmoAlertState | null,
  todayKey: string,
): { notify: boolean; nextState: GmoAlertState } {
  const current: GmoAlertState = { sentByLevel: { ...(state?.sentByLevel ?? {}) } }
  if (level === 'ok') return { notify: false, nextState: current }
  if (current.sentByLevel[level] === todayKey) return { notify: false, nextState: current }
  return { notify: true, nextState: { sentByLevel: { ...current.sentByLevel, [level]: todayKey } } }
}

/** UTCインスタンスをJSTの YYYY-MM-DD 文字列に変換する（純粋関数）。 */
export function jstDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** アラートレベルの日本語ラベル（純粋関数）。 */
export function gmoAlertLabel(level: AlertLevel): string {
  switch (level) {
    case 'caution':
      return '注意'
    case 'warning':
      return '警告'
    case 'critical':
      return '危険'
  }
}

const LEVEL_COLOR: Record<AlertLevel, string> = {
  caution: '#f59e0b',
  warning: '#ea580c',
  critical: '#dc2626',
}

/** 通知メールの件名・本文を生成する（純粋関数）。 */
export function buildGmoAlertEmail(args: {
  level: AlertLevel
  balance: number
  thresholds: GmoBalanceThresholds
  dashboardUrl: string
}): { subject: string; html: string } {
  const { level, balance, thresholds, dashboardUrl } = args
  const label = gmoAlertLabel(level)
  const color = LEVEL_COLOR[level]
  const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`
  const thresholdJpy = level === 'critical' ? thresholds.critical : level === 'warning' ? thresholds.warning : thresholds.caution

  const subject = `[タスタス] GMO送金元残高アラート（${label}）残高 ${yen(balance)}`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>GMO残高アラート - タスタス</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f3f4f6; padding:20px;">
  <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:${color}; color:#fff; padding:20px;">
      <h1 style="margin:0; font-size:20px;">⚠️ GMO送金元残高アラート（${label}）</h1>
      <p style="margin:8px 0 0; opacity:.9; font-size:14px;">日払いの振込原資が ${label} レベルまで減少しています</p>
    </div>
    <div style="padding:20px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px 0; color:#6b7280;">現在の引き出し可能残高</td>
          <td style="padding:10px 0; text-align:right; font-weight:700; color:${color}; font-size:18px;">${yen(balance)}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px 0; color:#6b7280;">${label}しきい値</td>
          <td style="padding:10px 0; text-align:right;">${yen(thresholdJpy)}</td>
        </tr>
      </table>
      <p style="margin:16px 0 0; font-size:13px; color:#374151;">
        残高が不足すると日払いの振込が失敗します。GMOあおぞらネット銀行の送金元口座へ入金してください。
      </p>
    </div>
    <div style="background:#f9fafb; padding:16px 20px; border-top:1px solid #e5e7eb;">
      <p style="margin:0; font-size:12px; color:#6b7280;">
        詳細は <a href="${dashboardUrl}" style="color:#2563eb;">日払い管理ダッシュボード</a> で確認できます。
      </p>
    </div>
  </div>
</body>
</html>`.trim()

  return { subject, html }
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site'

let resendClient: Resend | null = null
function getResendClient(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

/** SystemSetting に保存されたアラート状態をパースする（不正なら空状態）。 */
export function parseAlertState(value: string | null | undefined): GmoAlertState {
  if (!value) return { sentByLevel: {} }
  try {
    const o = JSON.parse(value) as { sentByLevel?: Record<string, unknown> }
    const raw = o?.sentByLevel
    const out: Partial<Record<AlertLevel, string>> = {}
    if (raw && typeof raw === 'object') {
      for (const lvl of ['caution', 'warning', 'critical'] as const) {
        const v = raw[lvl]
        if (typeof v === 'string') out[lvl] = v
      }
    }
    return { sentByLevel: out }
  } catch {
    return { sentByLevel: {} }
  }
}

export type GmoBalanceAlertResult = {
  ok: boolean
  notified: boolean
  level: GmoBalanceLevel | null
  reason?: string
  recipientCount?: number
}

/**
 * GMO残高をチェックし、必要ならSystem Admin全員へアラートメールを送信する。
 * cron から呼ぶ。クールダウン状態は SystemSetting に保存（直接upsert。hibarai_接頭辞ガードは
 * 汎用 updateSystemSetting 経由のみに効くため cron の直接書き込みには影響しない）。
 *
 * 安全設計:
 * - クールダウン状態は「送信成功後」にのみ前進させる（送信失敗時は次回 cron で再試行される）。
 * - Resend は API エラーを throw せず { error } で返すため、error/data.id を確認して成否判定する。
 * - 重複起動(cronの二重発火)に備え Idempotency-Key を付与し、Resend 側で同一通知の二重送信を防ぐ。
 */
export async function runGmoBalanceAlert(now: Date = new Date()): Promise<GmoBalanceAlertResult> {
  const view = await getGmoRemitterBalance()
  if (!view.available || view.withdrawableAmount == null || view.level == null) {
    return { ok: true, notified: false, level: null, reason: 'balance_unavailable' }
  }

  const dateKey = jstDateKey(now)
  const state = parseAlertState(
    (await prisma.systemSetting.findUnique({ where: { key: GMO_ALERT_STATE_KEY }, select: { value: true } }))?.value,
  )
  const { notify, nextState } = decideGmoAlert(view.level, state, dateKey)
  if (!notify) {
    return { ok: true, notified: false, level: view.level }
  }

  const level = view.level as AlertLevel
  const client = getResendClient()
  if (!client) return { ok: true, notified: false, level, reason: 'resend_unavailable' }

  const admins = await prisma.systemAdmin.findMany({ select: { email: true, notification_email: true } })
  const recipients = Array.from(new Set(admins.map((a) => a.notification_email || a.email).filter(Boolean)))
  if (recipients.length === 0) return { ok: true, notified: false, level, reason: 'no_recipients' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.work'
  const { subject, html } = buildGmoAlertEmail({
    level,
    balance: view.withdrawableAmount,
    thresholds: view.thresholds,
    dashboardUrl: `${appUrl}/system-admin/hibarai`,
  })

  let sent = false
  let errorName: string | null = null
  try {
    const { data, error, headers } = await client.emails.send(
      { from: FROM_EMAIL, to: recipients, subject, html },
      { idempotencyKey: `gmo-balance-alert:${dateKey}:${level}` },
    )
    if (headers?.['x-resend-monthly-quota']) {
      cacheResendQuotaHeader(headers['x-resend-monthly-quota']).catch(() => {})
    }
    if (error) {
      errorName = error.name
      console.error('[GMO_BALANCE_ALERT] Resend returned error:', error)
    } else if (data?.id) {
      sent = true
    }
  } catch (err) {
    errorName = 'exception'
    console.error('[GMO_BALANCE_ALERT] Failed to send email:', err)
  }

  // クールダウン状態は送信成功時のみ前進させる（失敗時は再試行を許す）。
  if (sent) {
    await prisma.systemSetting.upsert({
      where: { key: GMO_ALERT_STATE_KEY },
      create: { key: GMO_ALERT_STATE_KEY, value: JSON.stringify(nextState), description: 'GMO残高アラートのレベル別最終通知日(JST)' },
      update: { value: JSON.stringify(nextState) },
    })
  }

  await recordHibaraiAudit({
    actorType: 'SYSTEM_CRON',
    action: 'GMO_BALANCE_ALERT_SENT',
    targetType: 'GmoBalance',
    targetId: 'remitter',
    payload: {
      level,
      balance: view.withdrawableAmount,
      recipientCount: recipients.length,
      emailSent: sent,
      error: errorName,
    } as Prisma.InputJsonValue,
    result: sent ? 'WARNING' : 'ERROR',
  }).catch(() => {})

  return { ok: true, notified: sent, level, recipientCount: recipients.length }
}
