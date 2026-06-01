/**
 * Advisor TTFB ジッター再検証スクリプト
 *
 * 目的: tool_use → tool_result → loop=1 (整形応答) の TTFB が
 *       現在も 100 秒級になるかを直接 Anthropic API で計測する。
 *
 * 過去の事象 (HANDOFF.md / 2026-05-03 ジッター分析):
 *   - loop=1 で TTFB 90〜130s が頻発
 *   - 真因は Anthropic 側ノードアフィニティ喪失 (推定) でこちら制御不能
 *   - 対策: orchestrator.ts で execute_sql 成功時にサーバー側短絡で loop=1 を呼ばない
 *
 * 今回の検証で「もう起きない」なら短絡を緩めても安全に並列ツールを処理できる。
 *
 * 実行:
 *   ANTHROPIC_API_KEY=... npx tsx scripts/advisor-ttfb-probe.ts
 *   ANTHROPIC_API_KEY=... npx tsx scripts/advisor-ttfb-probe.ts --runs 3 --model claude-sonnet-4-5
 *
 * 注意:
 *   - prompt cache を活かすため、最初の 1 回はキャッシュ書き込みで遅いのが正常
 *   - 2 回目以降の TTFB が本来の体感速度
 *   - API コスト: 1 回あたり数十セント程度 (大きめ system prompt のため)
 */

import Anthropic from '@anthropic-ai/sdk';
import { performance } from 'node:perf_hooks';

// ---- 引数パース ----
const args = process.argv.slice(2);
function arg(name: string, dflt: string): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const RUNS = parseInt(arg('--runs', '3'), 10);
const MODEL = arg('--model', 'claude-sonnet-4-5');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}
const client = new Anthropic({ apiKey });

// ---- 当時の本番条件を再現する大きめ system prompt ----
// HANDOFF.md より: cacheRead 中央値 60,898 tokens 相当の system prompt を再現
// 実際の Advisor の system prompt はもっと複雑だが、ここでは tokens 量で揃える
function buildBulkySystemPrompt(): string {
  // 約 1500 行 / 60K tokens 相当のダミー仕様書を生成
  const lines: string[] = [];
  lines.push('あなたは TASTAS という看護師・介護士向け求人マッチングサービスの分析アドバイザーです。');
  lines.push('以下はサービスの全データモデル、指標定義、運用ルール、過去の意思決定の集成です。\n');
  for (let i = 0; i < 1500; i++) {
    lines.push(
      `[Rule #${i.toString().padStart(4, '0')}] ${'本ルールは TASTAS サービスにおける指標計算と運用ガイドラインの一部である。'.repeat(2)} ` +
        `指標カテゴリ ${(i % 12) + 1} に属し、適用範囲は全テナント、ただし例外 ${(i % 7) + 1} に該当する場合は除外する。`
    );
  }
  return lines.join('\n');
}

// ---- ダミー SQL 結果 (LLM に整形させる対象) ----
function buildToolResultPayload(): string {
  const rows = [];
  for (let lp = 1; lp <= 30; lp++) {
    rows.push({
      lp_id: lp,
      pv: Math.floor(Math.random() * 5000) + 1000,
      uu: Math.floor(Math.random() * 3000) + 500,
      line_cv: Math.floor(Math.random() * 200),
      register_cv: Math.floor(Math.random() * 100),
    });
  }
  return JSON.stringify({
    ok: true,
    data: {
      table_id: 'T-PROBE',
      columns: ['lp_id', 'pv', 'uu', 'line_cv', 'register_cv'],
      rows,
      row_count: rows.length,
    },
  });
}

// ---- 1 回分の計測ロジック ----
interface RunResult {
  runIdx: number;
  loop0TtfbMs: number;
  loop0TotalMs: number;
  loop0CacheRead: number;
  loop0CacheCreate: number;
  loop0StopReason: string | null;
  loop1TtfbMs: number;
  loop1TotalMs: number;
  loop1CacheRead: number;
  loop1CacheCreate: number;
  loop1StopReason: string | null;
}

async function runOnce(
  runIdx: number,
  systemPrompt: string,
  toolDef: Anthropic.Messages.Tool[]
): Promise<RunResult> {
  console.log(`\n========== Run ${runIdx + 1}/${RUNS} ==========`);

  // ---- loop=0: ユーザーから「SQLを実行して」と頼む → LLM が tool_use を返す ----
  const userMsg = `LP1〜LP30 の 2026年5月の PV / UU / LINE_CV / 登録CV を一括で取りたい。execute_sql ツールで SELECT 文を発行して取得してほしい。`;

  console.log(`[loop=0] tool_use 取得開始 model=${MODEL}`);
  const loop0Start = performance.now();
  let loop0Ttfb = -1;
  const loop0Stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: toolDef,
    messages: [{ role: 'user', content: userMsg }],
  });
  for await (const event of loop0Stream) {
    if (loop0Ttfb < 0 && event.type === 'content_block_start') {
      loop0Ttfb = Math.round(performance.now() - loop0Start);
    }
  }
  const loop0Final = await loop0Stream.finalMessage();
  const loop0Total = Math.round(performance.now() - loop0Start);
  const loop0Usage = loop0Final.usage as Anthropic.Messages.Usage;
  console.log(
    `[loop=0] done ttfb=${loop0Ttfb}ms total=${loop0Total}ms cacheRead=${loop0Usage.cache_read_input_tokens ?? 0} cacheCreate=${loop0Usage.cache_creation_input_tokens ?? 0} stop=${loop0Final.stop_reason}`
  );

  const toolUseBlock = loop0Final.content.find((b) => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error(`loop=0 で tool_use が出ませんでした: stop=${loop0Final.stop_reason}`);
  }

  // ---- loop=1: tool_result を返して整形応答を取得 ← これが計測対象 ----
  console.log(`[loop=1] tool_result を返して整形応答取得開始 (これが計測対象)`);
  const loop1Start = performance.now();
  let loop1Ttfb = -1;
  const loop1Stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: toolDef,
    messages: [
      { role: 'user', content: userMsg },
      { role: 'assistant', content: loop0Final.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: buildToolResultPayload(),
          },
        ],
      },
    ],
  });
  for await (const event of loop1Stream) {
    if (loop1Ttfb < 0 && event.type === 'content_block_start') {
      loop1Ttfb = Math.round(performance.now() - loop1Start);
    }
  }
  const loop1Final = await loop1Stream.finalMessage();
  const loop1Total = Math.round(performance.now() - loop1Start);
  const loop1Usage = loop1Final.usage as Anthropic.Messages.Usage;
  console.log(
    `[loop=1] done ttfb=${loop1Ttfb}ms total=${loop1Total}ms cacheRead=${loop1Usage.cache_read_input_tokens ?? 0} cacheCreate=${loop1Usage.cache_creation_input_tokens ?? 0} stop=${loop1Final.stop_reason}`
  );

  return {
    runIdx,
    loop0TtfbMs: loop0Ttfb,
    loop0TotalMs: loop0Total,
    loop0CacheRead: loop0Usage.cache_read_input_tokens ?? 0,
    loop0CacheCreate: loop0Usage.cache_creation_input_tokens ?? 0,
    loop0StopReason: loop0Final.stop_reason ?? null,
    loop1TtfbMs: loop1Ttfb,
    loop1TotalMs: loop1Total,
    loop1CacheRead: loop1Usage.cache_read_input_tokens ?? 0,
    loop1CacheCreate: loop1Usage.cache_creation_input_tokens ?? 0,
    loop1StopReason: loop1Final.stop_reason ?? null,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

async function main() {
  console.log(`Anthropic TTFB ジッター再検証`);
  console.log(`model: ${MODEL}`);
  console.log(`runs: ${RUNS}`);

  const systemPrompt = buildBulkySystemPrompt();
  console.log(`system prompt size: ${systemPrompt.length} chars (約 ${Math.round(systemPrompt.length / 4)} tokens 想定)`);

  const toolDef: Anthropic.Messages.Tool[] = [
    {
      name: 'execute_sql',
      description: 'SELECT 文を本番DB の読み取り専用ロールで実行する',
      input_schema: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: '実行する SELECT 文' },
          purpose: { type: 'string', description: '何を取りたいかの説明' },
        },
        required: ['sql', 'purpose'],
      },
    },
  ];

  const results: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      const r = await runOnce(i, systemPrompt, toolDef);
      results.push(r);
    } catch (e) {
      console.error(`Run ${i + 1} 失敗:`, e);
    }
  }

  // ---- 集計 ----
  console.log(`\n========== 集計 ==========`);
  console.log(`loop=1 TTFB (整形応答の TTFB) — これが過去の 100秒問題`);
  const loop1Ttfbs = results.map((r) => r.loop1TtfbMs);
  console.log(`  raw: [${loop1Ttfbs.map((v) => `${v}ms`).join(', ')}]`);
  console.log(`  median: ${median(loop1Ttfbs)}ms`);
  console.log(`  min: ${Math.min(...loop1Ttfbs)}ms / max: ${Math.max(...loop1Ttfbs)}ms`);
  console.log(`\nloop=1 cacheRead (system prompt cache 効いてるか)`);
  console.log(`  raw: [${results.map((r) => r.loop1CacheRead).join(', ')}]`);

  console.log(`\n判定:`);
  const maxTtfb = Math.max(...loop1Ttfbs);
  if (maxTtfb > 60_000) {
    console.log(`  🔴 max ${maxTtfb}ms > 60秒 → 100秒問題は現在も再現する。短絡継続が安全`);
  } else if (maxTtfb > 30_000) {
    console.log(`  🟡 max ${maxTtfb}ms (30〜60秒) → 改善傾向だがまだ怪しい。short-circuit 緩和は条件付き`);
  } else {
    console.log(`  ✅ max ${maxTtfb}ms < 30秒 → 100秒問題は解消されているように見える。短絡緩和して OK`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
