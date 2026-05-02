/**
 * Advisor の audit ログから「直近セッションの時系列内訳」を出す。
 * 「2 分かかる」のがどこで消費されているかを切り分けるための調査スクリプト。
 *
 * 実行: npx tsx scripts/advisor-latency-trace.ts [sessionId]
 *   引数なし: 直近のセッションを自動選択
 *
 * `chat_response` の payload に loopTraces[] が含まれていれば、
 * loop 単位で TTFB / cache hit/miss を展開表示する (Step 1 計測整備で追加)。
 */

import { prisma } from '../lib/prisma'

/** orchestrator.ts の LoopTrace と同じ shape (依存避けるため再定義) */
interface LoopTraceLike {
  loop: number
  /** リクエスト時に指定したモデル ID。古いトレースには無いため optional */
  requestedModelId?: string
  /** Anthropic レスポンスの実モデル ID (alias 解決後)。古いトレースには無いため optional */
  responseModelId?: string | null
  /** thinking パラメータ指定状態。古いトレースには無いため optional */
  thinkingMode?: string
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
}

/**
 * Step 1 判定基準 (HANDOFF.md と一致):
 * - loop>0 で cacheReadInputTokens >= 27,000 → cache 効いてる (Anthropic API 側問題)
 * - loop>0 で cacheReadInputTokens が 0〜数百 → cache 破壊 (skeleton 移動で改善見込み)
 * - loop=0 の ttfbMs > 10,000ms → tools 配列の cache 漏れ等
 */
function classifyLoopTrace(t: LoopTraceLike): string {
  if (t.loop === 0) {
    if ((t.ttfbMs ?? 0) > 10_000) return '⚠️ loop=0 で TTFB 長い → tools cache 漏れ疑い'
    return '✅ loop=0 正常'
  }
  if (t.cacheReadInputTokens >= 27_000) {
    return '🔴 cache 効いてるが TTFB 長い → Anthropic API 側'
  }
  if (t.cacheReadInputTokens < 1_000) {
    return '⚠️ cache 破壊 → skeleton を messages 末尾へ移動推奨'
  }
  return '🟡 cache 部分 hit'
}

async function main() {
  const arg = process.argv[2]
  let sessionId = arg

  if (!sessionId) {
    const latest = await prisma.advisorAuditLog.findFirst({
      where: { event_type: 'chat_request' },
      orderBy: { created_at: 'desc' },
      select: { session_id: true, created_at: true },
    })
    if (!latest?.session_id) {
      console.log('audit ログが空です')
      return
    }
    sessionId = latest.session_id
    console.log(`(直近セッション ${sessionId} を選択)\n`)
  }

  const logs = await prisma.advisorAuditLog.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'asc' },
    select: {
      event_type: true,
      payload: true,
      created_at: true,
    },
  })

  if (logs.length === 0) {
    console.log(`session ${sessionId} の audit ログが見つかりません`)
    return
  }

  const start = logs[0].created_at.getTime()
  console.log(`session: ${sessionId}`)
  console.log(`logs:    ${logs.length} 件`)
  console.log(`開始:    ${logs[0].created_at.toISOString()}`)
  console.log(`終了:    ${logs[logs.length - 1].created_at.toISOString()}`)
  const totalMs = logs[logs.length - 1].created_at.getTime() - start
  console.log(`総時間:  ${(totalMs / 1000).toFixed(1)}s\n`)

  // event_type 別の累積
  const byType: Record<string, { count: number; tookMsTotal: number }> = {}
  // tool_call は tool 名別
  const byTool: Record<string, { count: number; tookMsTotal: number }> = {}

  let prevMs = start
  console.log(`# 時系列内訳`)
  console.log(`elapsed | gap   | event           | detail`)
  console.log(`--------|-------|-----------------|------------------`)
  for (const log of logs) {
    const t = log.created_at.getTime()
    const elapsed = ((t - start) / 1000).toFixed(1)
    const gap = ((t - prevMs) / 1000).toFixed(1)
    const payload = log.payload as Record<string, unknown>
    const detail =
      log.event_type === 'tool_call' || log.event_type === 'tool_error'
        ? `${payload.tool ?? '?'} (${payload.tookMs ?? '?'}ms)${payload.error ? ' ' + payload.error : ''}`
        : log.event_type === 'chat_response'
        ? `in:${payload.inputTokens} out:${payload.outputTokens} tools:${payload.toolCallCount} chars:${payload.charCount}`
        : log.event_type === 'chat_request'
        ? `model:${payload.model ?? '?'} chars:${(payload.message as string)?.length ?? 0}`
        : ''
    console.log(
      `${elapsed.padStart(6)}s | ${gap.padStart(4)}s | ${log.event_type.padEnd(15)} | ${detail}`
    )

    byType[log.event_type] ??= { count: 0, tookMsTotal: 0 }
    byType[log.event_type].count += 1
    if (typeof payload.tookMs === 'number') byType[log.event_type].tookMsTotal += payload.tookMs

    if (log.event_type === 'tool_call' || log.event_type === 'tool_error') {
      const tool = String(payload.tool ?? '?')
      byTool[tool] ??= { count: 0, tookMsTotal: 0 }
      byTool[tool].count += 1
      if (typeof payload.tookMs === 'number') byTool[tool].tookMsTotal += payload.tookMs
    }

    prevMs = t
  }

  console.log(`\n# event_type 集計`)
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].tookMsTotal - a[1].tookMsTotal)) {
    console.log(`  ${k.padEnd(20)} count=${v.count}  tool_tookMs合計=${v.tookMsTotal}ms`)
  }

  console.log(`\n# tool 別集計`)
  for (const [k, v] of Object.entries(byTool).sort((a, b) => b[1].tookMsTotal - a[1].tookMsTotal)) {
    console.log(`  ${k.padEnd(28)} count=${v.count}  tookMs=${v.tookMsTotal}ms`)
  }

  // tool_call/tool_error イベント間の "Claude 思考時間" を推定
  // ＝ 各 event の gap から tool_call 自身の tookMs を引いた残り
  let llmThinkMs = 0
  for (let i = 1; i < logs.length; i++) {
    const log = logs[i]
    const gap = logs[i].created_at.getTime() - logs[i - 1].created_at.getTime()
    const payload = log.payload as Record<string, unknown>
    const toolMs = typeof payload.tookMs === 'number' ? payload.tookMs : 0
    const think = Math.max(0, gap - toolMs)
    llmThinkMs += think
  }
  console.log(`\n# 推定 Claude 思考/生成時間: ${(llmThinkMs / 1000).toFixed(1)}s (= 全 gap - tool 実行時間)`)

  // loopTraces を持つ chat_response / error イベントを展開表示 (Step 1 計測整備の主目的)
  // 1 セッションに複数の chat_response が並ぶことがあるので、リクエスト単位で表を出す
  const tracedResponses = logs.filter((l) => {
    if (l.event_type !== 'chat_response' && l.event_type !== 'error') return false
    const p = l.payload as Record<string, unknown>
    return Array.isArray(p.loopTraces)
  })

  if (tracedResponses.length === 0) {
    console.log(
      `\n# loopTraces なし — orchestrator.ts の Step 1 計測整備が入る前のセッションか、未到達`
    )
    return
  }

  console.log(`\n# ループ単位の計測 (loopTraces) — ${tracedResponses.length} リクエスト分`)
  for (const r of tracedResponses) {
    const p = r.payload as Record<string, unknown>
    const traces = p.loopTraces as LoopTraceLike[]
    const elapsed = ((r.created_at.getTime() - start) / 1000).toFixed(1)
    console.log(
      `\n## chat_response @ elapsed=${elapsed}s (event=${r.event_type}, loops=${traces.length})`
    )
    console.log(
      `loop | ttfbMs  | streamMs | totalMs | in     | out  | cacheRead | cacheWrite | stop      | tools | judge`
    )
    console.log(
      `-----|---------|----------|---------|--------|------|-----------|------------|-----------|-------|------`
    )
    for (const t of traces) {
      const judge = classifyLoopTrace(t)
      console.log(
        `${String(t.loop).padStart(4)} | ` +
          `${String(t.ttfbMs ?? 'n/a').padStart(7)} | ` +
          `${String(t.streamMs ?? 'n/a').padStart(8)} | ` +
          `${String(t.totalMs).padStart(7)} | ` +
          `${String(t.inputTokens).padStart(6)} | ` +
          `${String(t.outputTokens).padStart(4)} | ` +
          `${String(t.cacheReadInputTokens).padStart(9)} | ` +
          `${String(t.cacheCreationInputTokens).padStart(10)} | ` +
          `${(t.stopReason ?? '?').padEnd(9)} | ` +
          `${String(t.toolUseCount).padStart(5)} | ` +
          `${judge}`
      )
      // モデル ID と thinking モードを別行で表示 (列幅節約のため)
      if (t.requestedModelId || t.responseModelId || t.thinkingMode) {
        const reqM = t.requestedModelId ?? '?'
        const resM = t.responseModelId ?? '?'
        const think = t.thinkingMode ?? '?'
        const aliasNote = reqM !== resM && resM !== '?' ? ` ← snapshot 解決` : ''
        console.log(`     └─ req=${reqM} resp=${resM}${aliasNote} thinking=${think}`)
      }
    }
  }

  console.log(
    `\n判定基準 (HANDOFF.md「Step 1 の判定基準」):\n` +
      `  - 🔴 cache 効いて TTFB 長い → Step 4 (固定文短絡) を検討 (Anthropic API 側問題)\n` +
      `  - ⚠️ cache 破壊 → Step 2 (skeleton を messages 末尾に移動) に進む\n` +
      `  - ⚠️ loop=0 から長い → tools 配列の cache_control: ephemeral 追加を先に試す`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
