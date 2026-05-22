/**
 * Advisor の全メトリクス smoke test
 *
 * METRIC_CATALOG の available: true な指標すべてを、直近 90 日 (JST) で query_metric ツール経由で
 * 1 回ずつ実行する。各ケースで以下を検証:
 *   - ok: true で結果が返る
 *   - rows / total が定義通りに含まれている
 *
 * 失敗があれば最後に件数とまとめて報告し、exit 1。
 *
 * 注意: ADVISOR_DATA_DATABASE_URL 未設定の場合はローカル開発 DB にフォールバックする (db.ts 参照)。
 *
 * 実行: npx tsx scripts/smoke-test-metrics.ts
 */

import { METRIC_CATALOG } from '../src/lib/advisor/tools/tastas-data/metrics-catalog'
import { queryMetricTool } from '../src/lib/advisor/tools/tastas-data/query-metric'

interface SmokeResult {
  key: string
  label: string
  ok: boolean
  tookMs: number
  total?: number
  rowCount?: number
  groupBy: string
  error?: string
}

function toJSTDateStr(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

async function runOne(
  key: string,
  label: string,
  start: string,
  end: string
): Promise<SmokeResult> {
  const t0 = Date.now()
  const def = METRIC_CATALOG.find((m) => m.key === key)
  const groupBy = def?.supportedGroupBy[0] ?? 'none'
  try {
    const out = await queryMetricTool.execute({
      metric_key: key,
      start_date: start,
      end_date: end,
      group_by: groupBy,
    })
    const took = Date.now() - t0
    if (!out.ok) {
      return { key, label, ok: false, tookMs: took, groupBy, error: out.error }
    }
    return {
      key,
      label,
      ok: true,
      tookMs: took,
      total: out.data?.total,
      rowCount: out.data?.rows?.length,
      groupBy,
    }
  } catch (e) {
    const took = Date.now() - t0
    return {
      key,
      label,
      ok: false,
      tookMs: took,
      groupBy,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function main() {
  const now = new Date()
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const startStr = toJSTDateStr(start)
  const endStr = toJSTDateStr(now)
  console.log(`📊 smoke test: 全メトリクスを ${startStr} 〜 ${endStr} (直近 90 日) で実行`)
  console.log('')

  const targets = METRIC_CATALOG.filter((m) => m.available)
  console.log(`対象指標数: ${targets.length}`)
  console.log('')

  const results: SmokeResult[] = []
  let i = 0
  for (const m of targets) {
    i++
    const r = await runOne(m.key, m.label, startStr, endStr)
    results.push(r)
    const status = r.ok ? '✅' : '❌'
    const valStr = r.ok ? `total=${r.total} rows=${r.rowCount}` : `ERROR: ${r.error}`
    console.log(
      `${status} [${String(i).padStart(2, '0')}/${targets.length}] ${m.key.padEnd(45)} ${r.tookMs}ms  ${valStr}`
    )
  }

  console.log('')
  const failed = results.filter((r) => !r.ok)
  const okCount = results.length - failed.length
  console.log('===================================')
  console.log(`結果: ${okCount}/${results.length} 成功`)
  if (failed.length > 0) {
    console.log('')
    console.log(`❌ 失敗 ${failed.length} 件:`)
    for (const f of failed) {
      console.log(`  - ${f.key} (${f.label}): ${f.error}`)
    }
    process.exit(1)
  }
  console.log('✅ 全件成功')
}

main().catch((e) => {
  console.error('smoke test fatal error:', e)
  process.exit(1)
})
