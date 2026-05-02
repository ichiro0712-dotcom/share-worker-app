/**
 * Advisor TTFB ジッター分析
 *
 * 「同じコード・同じプロンプト・同じモデルで TTFB が 100 倍違う」現象の真因究明。
 *
 * Phase 1 計測整備 (loopTraces[]) で蓄積した全データを横断分析し、
 * 速かったループ (TTFB < 5s) と遅かったループ (TTFB > 60s) を分けて、
 * gap / cache 状態 / モデル / loop 番号 / stop_reason を比較する。
 *
 * 仮説:
 * - A: ノードアフィニティ喪失 → gap 長 + cacheRead 高 + cacheCreation 0 で遅い
 * - B: TTL 5 分切れ → gap 5 分超 + cacheCreation 高
 * - C: Anthropic 側のランダム揺らぎ → 速いと遅いに有意差なし
 *
 * 実行: npx tsx scripts/advisor-jitter-analysis.ts
 */

import { prisma } from '../lib/prisma'

interface LoopRow {
  sessionId: string
  responseAt: Date // chat_response が記録された時刻 (ループ完了時刻)
  loop: number
  ttfbMs: number | null
  streamMs: number | null
  totalMs: number
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  stopReason: string | null
  toolUseCount: number
  maxTokens: number
  modelId: string
  thinkingMode: string
  /** 同セッション内で、直前の loop 完了からこの loop 開始までの推定経過秒数 */
  gapFromPrevSec: number | null
  /** chat_response の loops 配列内の位置 (= 同一リクエスト内のループ) */
  positionInRequest: number
  /** chat_request 時刻 (= リクエスト送信時刻) */
  requestAt: Date | null
  /** リクエスト本文 (先頭 80 字) */
  requestPreview: string | null
}

function fmt(n: number | null | undefined, width: number = 7): string {
  if (n === null || n === undefined) return 'n/a'.padStart(width)
  return String(n).padStart(width)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  return sorted[mid]
}

function summary(rows: LoopRow[], label: string): void {
  if (rows.length === 0) {
    console.log(`\n## ${label}: 0 件`)
    return
  }
  console.log(`\n## ${label}: ${rows.length} 件`)
  const ttfbs = rows.map((r) => r.ttfbMs).filter((v): v is number => v !== null)
  const gaps = rows.map((r) => r.gapFromPrevSec).filter((v): v is number => v !== null)
  const cacheReads = rows.map((r) => r.cacheReadInputTokens)
  const cacheCreates = rows.map((r) => r.cacheCreationInputTokens)
  const inputs = rows.map((r) => r.inputTokens)
  const outputs = rows.map((r) => r.outputTokens)
  console.log(`  ttfbMs       中央値=${median(ttfbs)}ms 最小=${Math.min(...ttfbs)} 最大=${Math.max(...ttfbs)}`)
  console.log(`  gap_sec      中央値=${median(gaps)}s${gaps.length === 0 ? ' (gap なし=リクエスト内 loop>0)' : ''}`)
  console.log(`  cacheRead    中央値=${median(cacheReads)}t 最小=${Math.min(...cacheReads)} 最大=${Math.max(...cacheReads)}`)
  console.log(`  cacheCreate  中央値=${median(cacheCreates)}t 最小=${Math.min(...cacheCreates)} 最大=${Math.max(...cacheCreates)}`)
  console.log(`  inputTokens  中央値=${median(inputs)}t`)
  console.log(`  outputTokens 中央値=${median(outputs)}t`)

  // 内訳: loop 番号別 / モデル別 / thinkingMode 別 / stopReason 別
  const byLoop: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  const byThinking: Record<string, number> = {}
  const byStop: Record<string, number> = {}
  const byPosition: Record<string, number> = {}
  for (const r of rows) {
    byLoop[String(r.loop)] = (byLoop[String(r.loop)] ?? 0) + 1
    byModel[r.modelId] = (byModel[r.modelId] ?? 0) + 1
    byThinking[r.thinkingMode] = (byThinking[r.thinkingMode] ?? 0) + 1
    byStop[r.stopReason ?? '?'] = (byStop[r.stopReason ?? '?'] ?? 0) + 1
    byPosition[String(r.positionInRequest)] = (byPosition[String(r.positionInRequest)] ?? 0) + 1
  }
  console.log(`  loop 番号別 :`, byLoop)
  console.log(`  モデル別     :`, byModel)
  console.log(`  thinking 別  :`, byThinking)
  console.log(`  stopReason 別:`, byStop)
}

function detailTable(rows: LoopRow[], label: string): void {
  if (rows.length === 0) return
  console.log(`\n### ${label} 詳細 (時系列)`)
  console.log(
    'session  | time     | loop | pos | ttfbMs  | gap_s | cacheRead | cacheCreate | in    | out  | model                       | think    | stop      | preview'
  )
  console.log(
    '---------|----------|------|-----|---------|-------|-----------|-------------|-------|------|-----------------------------|----------|-----------|--------'
  )
  for (const r of rows) {
    const t = r.responseAt.toISOString().slice(11, 19)
    console.log(
      `${r.sessionId.slice(0, 8)} | ${t} | ${fmt(r.loop, 4)} | ${fmt(r.positionInRequest, 3)} | ` +
        `${fmt(r.ttfbMs, 7)} | ${fmt(r.gapFromPrevSec, 5)} | ${fmt(r.cacheReadInputTokens, 9)} | ` +
        `${fmt(r.cacheCreationInputTokens, 11)} | ${fmt(r.inputTokens, 5)} | ${fmt(r.outputTokens, 4)} | ` +
        `${(r.modelId ?? '?').padEnd(27)} | ${(r.thinkingMode ?? '?').padEnd(8)} | ${(r.stopReason ?? '?').padEnd(9)} | ` +
        `${(r.requestPreview ?? '').slice(0, 40)}`
    )
  }
}

async function main(): Promise<void> {
  // chat_response または error event の payload.loopTraces[] を全部展開
  const events = await prisma.advisorAuditLog.findMany({
    where: { event_type: { in: ['chat_response', 'error'] } },
    orderBy: { created_at: 'asc' },
    select: { session_id: true, created_at: true, payload: true },
  })

  // chat_request も拾って、各 chat_response にひもづく直前リクエスト本文を取れるようにする
  const requests = await prisma.advisorAuditLog.findMany({
    where: { event_type: 'chat_request' },
    orderBy: { created_at: 'asc' },
    select: { session_id: true, created_at: true, payload: true },
  })
  // session_id ごとの request 配列
  const reqBySession: Record<string, { at: Date; message: string }[]> = {}
  for (const r of requests) {
    const p = r.payload as Record<string, unknown>
    const message = typeof p?.message === 'string' ? p.message : ''
    reqBySession[r.session_id] ??= []
    reqBySession[r.session_id].push({ at: r.created_at, message })
  }

  // 各 chat_response の loopTraces を展開して LoopRow 配列に
  const allRows: LoopRow[] = []
  // session 内の前 loop の終了時刻トラッキング (gap 計算用)
  const lastLoopEndBySession: Record<string, Date> = {}

  for (const e of events) {
    const p = e.payload as Record<string, unknown> | null
    if (!p) continue
    const traces = (p.loopTraces as unknown[]) ?? []
    if (!Array.isArray(traces) || traces.length === 0) continue

    // chat_response の created_at は最終 loop の完了時刻と同等 (実装依存)
    // 各 loop の正確な開始/終了は記録していないので、
    // 「リクエスト全体としての gap」 = (この chat_response の created_at - 同セッションの 1 つ前の chat_response の created_at)
    // で近似する。loop 内のサブ位置 (positionInRequest) は別カラム。
    const prevEnd = lastLoopEndBySession[e.session_id]
    const requestGapSec = prevEnd ? Math.round((e.created_at.getTime() - prevEnd.getTime()) / 1000) : null
    lastLoopEndBySession[e.session_id] = e.created_at

    // 直前の chat_request (このリクエストの user メッセージ) を見つける
    const reqs = reqBySession[e.session_id] ?? []
    let matchedReq: { at: Date; message: string } | null = null
    for (let i = reqs.length - 1; i >= 0; i--) {
      if (reqs[i].at <= e.created_at) {
        matchedReq = reqs[i]
        break
      }
    }

    for (let i = 0; i < traces.length; i++) {
      const t = traces[i] as Record<string, unknown>
      // gap: ループ 0 のみ「前のリクエストからの時間」、ループ 1+ は同一リクエスト内なので null
      const gap = i === 0 ? requestGapSec : null
      allRows.push({
        sessionId: e.session_id,
        responseAt: e.created_at,
        loop: Number(t.loop ?? -1),
        ttfbMs: t.ttfbMs === null ? null : Number(t.ttfbMs ?? null),
        streamMs: t.streamMs === null ? null : Number(t.streamMs ?? null),
        totalMs: Number(t.totalMs ?? 0),
        inputTokens: Number(t.inputTokens ?? 0),
        outputTokens: Number(t.outputTokens ?? 0),
        cacheReadInputTokens: Number(t.cacheReadInputTokens ?? 0),
        cacheCreationInputTokens: Number(t.cacheCreationInputTokens ?? 0),
        stopReason: (t.stopReason as string) ?? null,
        toolUseCount: Number(t.toolUseCount ?? 0),
        maxTokens: Number(t.maxTokens ?? 0),
        modelId: (t.requestedModelId as string) ?? '?',
        thinkingMode: (t.thinkingMode as string) ?? '?',
        gapFromPrevSec: gap,
        positionInRequest: i,
        requestAt: matchedReq?.at ?? null,
        requestPreview: matchedReq?.message ?? null,
      })
    }
  }

  console.log(`# Advisor TTFB ジッター分析`)
  console.log(`分析対象: ${allRows.length} loop entries / ${events.length} chat_response events`)

  // 全件詳細表
  detailTable(allRows, '全 loop 一覧')

  // 速い / 中間 / 遅い 3 群に分ける
  const fast = allRows.filter((r) => r.ttfbMs !== null && r.ttfbMs < 5000)
  const slow = allRows.filter((r) => r.ttfbMs !== null && r.ttfbMs > 60000)
  const middle = allRows.filter((r) => r.ttfbMs !== null && r.ttfbMs >= 5000 && r.ttfbMs <= 60000)

  console.log(`\n# 群別サマリ`)
  summary(fast, '⚡ 速い (TTFB < 5s)')
  summary(middle, '🟡 中間 (5s ≤ TTFB ≤ 60s)')
  summary(slow, '🐢 遅い (TTFB > 60s)')

  // 速いケースと遅いケースの直接比較
  console.log(`\n# ⚡ 速いケース 詳細`)
  detailTable(fast, '速いループ (TTFB < 5s)')

  console.log(`\n# 🐢 遅いケース 詳細`)
  detailTable(slow, '遅いループ (TTFB > 60s)')

  // 仮説判定
  console.log(`\n# 仮説判定`)
  if (fast.length > 0 && slow.length > 0) {
    const fastGaps = fast.map((r) => r.gapFromPrevSec).filter((v): v is number => v !== null)
    const slowGaps = slow.map((r) => r.gapFromPrevSec).filter((v): v is number => v !== null)
    const fastCacheRead = fast.map((r) => r.cacheReadInputTokens)
    const slowCacheRead = slow.map((r) => r.cacheReadInputTokens)
    const fastCacheCreate = fast.map((r) => r.cacheCreationInputTokens)
    const slowCacheCreate = slow.map((r) => r.cacheCreationInputTokens)

    console.log(`  速い時 gap_sec  中央値: ${median(fastGaps)}s (${fastGaps.length} 件)`)
    console.log(`  遅い時 gap_sec  中央値: ${median(slowGaps)}s (${slowGaps.length} 件)`)
    console.log(`  速い時 cacheRead   中央値: ${median(fastCacheRead)}t`)
    console.log(`  遅い時 cacheRead   中央値: ${median(slowCacheRead)}t`)
    console.log(`  速い時 cacheCreate 中央値: ${median(fastCacheCreate)}t`)
    console.log(`  遅い時 cacheCreate 中央値: ${median(slowCacheCreate)}t`)

    console.log(`\n  仮説 A (ノードアフィニティ喪失): 遅い時に gap が長く + cacheRead 高 + cacheCreate 0`)
    console.log(`  仮説 B (TTL 5 分切れ): 遅い時に gap > 300s + cacheCreate が高い (再書き込み)`)
    console.log(`  仮説 C (ランダム揺らぎ): 速い/遅いに gap・cache の有意差なし`)
  } else {
    console.log('  ⚠️ 速い件数または遅い件数が 0 のため仮説判定不能')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
