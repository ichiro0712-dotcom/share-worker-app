import { Prisma } from '@prisma/client'

export function assertHibaraiFeatureEnabled(isEnabled: boolean): void {
  if (!isEnabled) throw new Error('Feature disabled')
}

export function getTodayJSTStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0))
}

export function getJSTMonthStart(now = new Date()): Date {
  const todayStart = getTodayJSTStart(now)
  const jst = new Date(todayStart.getTime() + 9 * 60 * 60 * 1000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1, -9, 0, 0, 0))
}

/**
 * 精算月(settlement_month)用の月初 Date を返す。
 *
 * `@db.Date` は UTC のカレンダー日付として保存されるため、JST の月初を
 * `Date.UTC(jstYear, jstMonth, 1)`（時差補正なし）で組み立てる。
 * getJSTMonthStart() は「JST深夜0時の瞬間」を表す Date を返すため、
 * その UTC 日付は前月末日になり @db.Date 保存には使えない点に注意。
 *
 * チャージ(ATTENDANCE_CONFIRMED)・出金(WITHDRAWAL_*)の双方でこの関数を使い、
 * 精算月の定義を統一する。
 */
export function getJSTSettlementMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

/**
 * 任意の日時が属する JST 月の月初 Date を返す（@db.Date 保存用）。
 * 勤務日(work_date)から精算月を決める用途に使う。
 */
export function toJSTSettlementMonthStart(date: Date): Date {
  return getJSTSettlementMonthStart(date)
}

/**
 * 任意の日時の JST カレンダー日付を @db.Date 保存用の Date で返す。
 * @db.Date は UTC 日付として保存されるため Date.UTC(jstY, jstM, jstD)（時差補正なし）で組む。
 * 生の timestamp をそのまま @db.Date に入れると JST 深夜帯で UTC 前日になる罠を避ける。
 */
export function toJSTDateOnly(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

export function formatJSTDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function readPositiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function getDefaultWithdrawalFee(): number {
  return readPositiveIntEnv('HIBARAI_DEFAULT_FEE_JPY', 143)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function createSupportCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
