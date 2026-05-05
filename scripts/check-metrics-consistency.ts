/**
 * Advisor のメトリクス定義整合性チェック (CI 用)
 *
 * 確認すること:
 * 1. METRIC_CATALOG (metrics-catalog.ts) の available: true な key が
 *    query-metric.ts の runMetricQuery switch case にすべて存在すること
 * 2. query-metric.ts の switch case にあるが catalog に無い key が無いこと
 * 3. catalog に supportedGroupBy=['day'] と書かれている指標は
 *    query-metric.ts 側でも groupBy === 'day' の分岐が実装されていること
 *
 * 失敗したら exit 1。CI (npm run check:metrics) で利用。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { METRIC_CATALOG } from '../src/lib/advisor/tools/tastas-data/metrics-catalog'

const ROOT = resolve(__dirname, '..')
const QUERY_METRIC_PATH = resolve(ROOT, 'src/lib/advisor/tools/tastas-data/query-metric.ts')

interface CheckIssue {
  level: 'error' | 'warning'
  message: string
}

function extractSwitchCaseKeys(source: string): Set<string> {
  // runMetricQuery 関数内の `case 'XXX':` を抽出
  const startIdx = source.indexOf('async function runMetricQuery')
  if (startIdx === -1) return new Set()
  const fnSource = source.slice(startIdx)
  const re = /case\s+['"]([A-Z_]+)['"]\s*:/g
  const keys = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(fnSource)) !== null) {
    keys.add(m[1])
  }
  return keys
}

function extractGroupByDayKeys(source: string): Set<string> {
  // 各 case の中で `opts.groupBy === 'day'` 分岐があるかを検出
  const startIdx = source.indexOf('async function runMetricQuery')
  if (startIdx === -1) return new Set()
  const fnSource = source.slice(startIdx)
  // case 'KEY': { ... } の中身単位で分割。簡易パーサ: case 'X': を区切りに
  const blocks = fnSource.split(/case\s+['"]/).slice(1)
  const result = new Set<string>()
  for (const block of blocks) {
    const keyEnd = block.indexOf("'")
    const altEnd = block.indexOf('"')
    const end = keyEnd === -1 ? altEnd : altEnd === -1 ? keyEnd : Math.min(keyEnd, altEnd)
    if (end === -1) continue
    const key = block.slice(0, end)
    const body = block.slice(end)
    // 次の `case '` または default: までを切り出し
    const nextCase = body.search(/(case\s+['"]|default\s*:)/)
    const slice = nextCase === -1 ? body : body.slice(0, nextCase)
    if (slice.includes("opts.groupBy === 'day'") || slice.includes('opts.groupBy === "day"')) {
      result.add(key)
    }
  }
  return result
}

function main() {
  const issues: CheckIssue[] = []

  const querySource = readFileSync(QUERY_METRIC_PATH, 'utf-8')
  const switchKeys = extractSwitchCaseKeys(querySource)
  const groupByDayKeys = extractGroupByDayKeys(querySource)

  const availableCatalogKeys = new Set(METRIC_CATALOG.filter((m) => m.available).map((m) => m.key))
  const allCatalogKeys = new Set(METRIC_CATALOG.map((m) => m.key))

  // Rule 1: catalog (available: true) の key が switch case に存在
  for (const key of availableCatalogKeys) {
    if (!switchKeys.has(key)) {
      issues.push({
        level: 'error',
        message: `[catalog→query] METRIC_CATALOG に available: true で定義されているが query-metric.ts の switch case に実装が無い: ${key}`,
      })
    }
  }

  // Rule 2: switch case にあるが catalog に無い → 削除漏れ
  for (const key of switchKeys) {
    if (!allCatalogKeys.has(key)) {
      issues.push({
        level: 'error',
        message: `[query→catalog] query-metric.ts の switch case にあるが METRIC_CATALOG に存在しない key: ${key}`,
      })
    }
  }

  // Rule 2b: switch case にあるが available: false → catalog の available フラグが嘘
  for (const key of switchKeys) {
    if (allCatalogKeys.has(key) && !availableCatalogKeys.has(key)) {
      issues.push({
        level: 'error',
        message: `[catalog flag] query-metric.ts に実装があるのに METRIC_CATALOG では available: false: ${key}`,
      })
    }
  }

  // Rule 3: supportedGroupBy に 'day' を含む指標は query-metric.ts でも day 分岐が必要
  for (const m of METRIC_CATALOG) {
    if (!m.available) continue
    if (m.supportedGroupBy.includes('day') && !groupByDayKeys.has(m.key)) {
      issues.push({
        level: 'warning',
        message: `[supportedGroupBy] ${m.key}: catalog で 'day' をサポート宣言しているが query-metric.ts に "opts.groupBy === 'day'" 分岐が見つからない (誤検出の可能性あり)`,
      })
    }
  }

  // 結果出力
  if (issues.length === 0) {
    console.log(`✅ Advisor metrics consistency: OK`)
    console.log(`   - catalog entries: ${METRIC_CATALOG.length} (available: ${availableCatalogKeys.size})`)
    console.log(`   - query-metric switch cases: ${switchKeys.size}`)
    return
  }

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  console.error(`❌ Advisor metrics consistency check failed`)
  console.error('')
  if (errors.length > 0) {
    console.error(`Errors (${errors.length}):`)
    for (const issue of errors) console.error(`  - ${issue.message}`)
  }
  if (warnings.length > 0) {
    console.error(`Warnings (${warnings.length}):`)
    for (const issue of warnings) console.error(`  - ${issue.message}`)
  }

  if (errors.length > 0) {
    process.exit(1)
  }
}

main()
