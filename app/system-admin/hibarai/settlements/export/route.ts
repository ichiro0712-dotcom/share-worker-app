import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server'
import { getJSTSettlementMonthStart } from '@/lib/actions/hibarai/utils'
import {
  buildSettlementCsv,
  getSettlementReconciliation,
  parseSettlementMonthParam,
} from '@/lib/actions/hibarai/settlement-reconciliation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })

  const session = await getSystemAdminSessionData()
  if (!session) {
    return NextResponse.redirect(new URL('/system-admin/login', request.url))
  }

  const monthParam = new URL(request.url).searchParams.get('month')
  const monthStart = parseSettlementMonthParam(monthParam) ?? getJSTSettlementMonthStart()

  const data = await getSettlementReconciliation(monthStart)
  // Excelで文字化けしないよう UTF-8 BOM を先頭に付与。
  const body = `﻿${buildSettlementCsv(data.rows)}`
  const filename = `hibarai-settlement-${data.monthParam}.csv`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
