import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import {
  buildWithdrawalStatusWhere,
  getAdminWithdrawals,
  resolveWithdrawalOrderBy,
} from '@/lib/actions/hibarai/admin-withdrawals'
import { buildWithdrawalsCsv } from '@/lib/actions/hibarai/withdrawals-csv'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 1回のエクスポート上限。現状の規模では十分。
const EXPORT_LIMIT = 50000

export async function GET(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })

  const session = await getSystemAdminSessionData()
  if (!session) {
    return NextResponse.redirect(new URL('/system-admin/login', request.url))
  }

  const params = new URL(request.url).searchParams
  const orderBy = resolveWithdrawalOrderBy(params.get('sort'), params.get('order'))
  const where = buildWithdrawalStatusWhere(params.get('status'))

  const { rows } = await getAdminWithdrawals(EXPORT_LIMIT, orderBy, where)

  // Excelで文字化けしないよう UTF-8 BOM を先頭に付与。
  const body = `﻿${buildWithdrawalsCsv(rows)}`
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const filename = `hibarai-withdrawals-${stamp}.csv`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
