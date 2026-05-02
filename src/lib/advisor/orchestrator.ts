/**
 * Advisor Orchestrator
 *
 * Tool Use ループの本体。
 * - システムプロンプト構築
 * - 過去履歴のロード
 * - Anthropic API 呼び出し (streaming)
 * - tool_use を検出 → executeToolByName → tool_result を返して再 stream
 * - 終了時: メッセージ永続化 + 監査ログ + 使用量加算
 */

import type Anthropic from '@anthropic-ai/sdk';
import { ADVISOR_MODELS, getClaudeClient, isValidModelId, type AdvisorModelId } from './claude';
import { buildSystemPrompt } from './system-prompt';
import { buildCachedSystem, extractCacheStats } from './prompt-cache';
import { describeAllToolsForLLM, executeToolByName } from './tools/registry';
import { getRecentMessagesForOrchestrator, appendMessage } from './persistence/messages';
import { incrementSessionUsage } from './persistence/sessions';
import { incrementUsage } from './cost-guard';
import { recordAudit } from './persistence/audit';
import { getAdvisorSettings } from './persistence/settings';
import { Prisma } from '@prisma/client';

/**
 * Stream イベント型 (legacy UI 互換)
 *
 * legacy chat-layout.tsx は data: {type: 'status'|'text'|'done'|'error'} を読む。
 * Advisor では加えて tool_use/tool_result も送るが UI 側は無視可能。
 */
export type AdvisorStreamEvent =
  | { type: 'status'; status: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      id: string;
      ok: boolean;
      summary: string;
      data?: unknown;
      error?: string;
    }
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
    }
  /**
   * 進行中の活動を UI に伝える「動いてる証拠」イベント。
   * Claude Code 風に経過秒数と出力トークン数を表示するために使う。
   * テキストストリーム中もツール実行中も、常に何かしら届くようサーバー側で送出する。
   */
  | {
      type: 'heartbeat';
      phase: 'thinking' | 'tool' | 'streaming' | 'organizing';
      label: string;
      elapsedMs: number;
      outputTokens?: number;
    }
  | {
      type: 'done';
      messageId: string;
      conversationId: string;
      data?: Record<string, unknown>;
    }
  | { type: 'error'; text: string };

/**
 * 1 ループ (= Anthropic 1 リクエスト) ごとの計測値。
 * cache の効き方と TTFB を loop 単位で可視化するため audit_log の chat_response payload に
 * loopTraces[] として蓄積する。
 *
 * 判定基準 (HANDOFF.md「Step 1 の判定基準」と一致):
 * - loop>0 で cacheReadInputTokens が 27,000+ → cache は効いている (Anthropic API 側問題)
 * - loop>0 で cacheReadInputTokens が 0〜数百 → cache 破壊 (skeleton 移動で改善見込み)
 * - loop=0 の ttfbMs が長い (>10s) → tools 配列の cache 漏れ等が疑い
 */
export interface LoopTrace {
  /** 0-indexed のループ番号 (loop=0 = 初回 LLM 呼び出し、loop=1 = ツール実行後の最終応答) */
  loop: number;
  /** リクエスト送信から最初の content delta (text or tool_use) が来るまで (ms)。stream 未到達時は null */
  ttfbMs: number | null;
  /** 最初の delta から finalMessage 完了まで (ms) */
  streamMs: number | null;
  /** ループ全体の所要時間 (ms) */
  totalMs: number;
  /** finalMessage.usage.input_tokens (cache 読み書き分は含まれない実 input) */
  inputTokens: number;
  /** finalMessage.usage.output_tokens */
  outputTokens: number;
  /** finalMessage.usage.cache_read_input_tokens (cache hit 時のみ非ゼロ) */
  cacheReadInputTokens: number;
  /** finalMessage.usage.cache_creation_input_tokens (cache write 時のみ非ゼロ) */
  cacheCreationInputTokens: number;
  /** Anthropic 終了理由 ("end_turn" | "tool_use" | "max_tokens" 等) */
  stopReason: string | null;
  /** このループで生成された tool_use ブロックの数 */
  toolUseCount: number;
  /** 投入時の max_tokens (loop=0 は 4096、loop>0 は 512 のはず) */
  maxTokens: number;
}

export interface AttachedFileInput {
  name: string;
  mimeType: string;
  /** base64 (data URI prefix なし) */
  base64: string;
}

export interface OrchestratorRunInput {
  admin: { id: number; name: string; role: string };
  sessionId: string;
  userMessage: string;
  /** ファイル添付 (画像・PDF 等) */
  attachments?: AttachedFileInput[];
  /** 使用モデル (省略時は Sonnet) */
  modelId?: AdvisorModelId;
  /** UI に進捗を流す callback */
  onEvent: (event: AdvisorStreamEvent) => void;
  abortSignal?: AbortSignal;
  /** 監査ログ用 client info */
  clientIp?: string | null;
  clientUa?: string | null;
}

/**
 * Tool Use ループの上限のデフォルト値 (DB に行が無い時のフォールバック)。
 * 実行時は AdvisorSettings.max_tool_loops を読んで上書きする。
 * 設定ページ /system-admin/advisor/settings から System Admin が変更可能。
 */
const FALLBACK_MAX_TOOL_LOOPS = 20;
const MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_MODEL: AdvisorModelId = ADVISOR_MODELS.sonnet;

/**
 * ツール名 → UI 表示する進捗ラベル
 * orchestrator がツール実行直前に `status` イベントとして送る。
 * 未登録のツール名は `${name} を実行中...` にフォールバック。
 */
const TOOL_STATUS_LABEL: Record<string, string> = {
  // core (リポジトリ / コード / ドキュメント)
  read_repo_file: 'コードを確認中...',
  search_codebase: 'コードベースを検索中...',
  list_directory: 'ディレクトリを確認中...',
  read_doc: 'ドキュメントを確認中...',
  get_recent_commits: 'GitHub からコミット履歴を取得中...',
  // tastas-data (DB / 指標)
  describe_db_table: 'DB スキーマを確認中...',
  query_metric: '指標を集計中...',
  get_jobs_summary: '求人データを集計中...',
  get_users_summary: 'ユーザーデータを集計中...',
  get_recent_errors: '直近のエラーログを確認中...',
  // external (Vercel / Supabase / GA4 / Search Console / LINE / Lstep)
  get_vercel_deployments: 'Vercel デプロイ履歴を取得中...',
  get_vercel_logs: 'Vercel ログを取得中...',
  get_supabase_logs: 'Supabase ログを取得中...',
  query_search_console: 'Search Console を確認中...',
  query_line_friends: 'LINE 連携を確認中...',
  query_lstep_events: 'Lstep イベントを確認中...',
  // reports
  update_report_draft: 'レポートドラフトを更新中...',
  edit_report_section: 'レポートを部分修正中... (Gemini に書き換えを依頼)',
};

function statusForTool(name: string): string {
  return TOOL_STATUS_LABEL[name] ?? `${name} を実行中...`;
}

/**
 * 先頭の `[TOOL:xxx] ` ヒント (ChatInput がツール選択時に付与する hidden hint) を除去する。
 * 永続化・履歴表示・監査ログ向けにユーザーが書いた本文だけにする。
 * Claude に渡すメッセージは hint 込みのままにして文脈判断に使わせる。
 */
function stripToolHintPrefix(message: string): string {
  return message.replace(/^\s*\[TOOL:[a-zA-Z0-9_]+\]\s*/, '');
}

export async function runOrchestrator(input: OrchestratorRunInput): Promise<void> {
  const client = getClaudeClient();
  const tools = await describeAllToolsForLLM();
  // 使用モデル決定 (validate)
  const activeModel: AdvisorModelId = input.modelId ?? DEFAULT_MODEL;

  // 0. Advisor 設定 (max_tool_loops, system_prompt_override) を取得
  // 設定ページから System Admin が編集可能なので、毎リクエスト DB に問い合わせる。
  const settings = await getAdvisorSettings().catch((e) => {
    console.warn('[advisor] failed to load settings, using defaults:', e);
    return { maxToolLoops: FALLBACK_MAX_TOOL_LOOPS, systemPromptOverride: null };
  });
  const maxToolLoops = settings.maxToolLoops ?? FALLBACK_MAX_TOOL_LOOPS;

  // 1. システムプロンプト構築 (override があれば差し替え)
  const { cachedPart, dynamicPart } = await buildSystemPrompt({
    admin: input.admin,
    sessionId: input.sessionId,
    systemPromptOverride: settings.systemPromptOverride ?? null,
  });
  const systemMessage = buildCachedSystem(cachedPart, dynamicPart);

  // 2. 過去履歴ロード (Anthropic 形式に変換)
  const history = await getRecentMessagesForOrchestrator({
    sessionId: input.sessionId,
    limit: 50,
  });

  type AnthropicMessage = Anthropic.Messages.MessageParam;

  const messages: AnthropicMessage[] = [];
  for (const m of history) {
    if (m.role === 'tool') continue; // tool ロールは toolCalls に紐づくはずだが、安全のため除外
    if (m.role === 'user') {
      messages.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      // Phase 1 では simple text のみ復元 (tool_calls の細粒復元は別途)
      messages.push({ role: 'assistant', content: m.content });
    }
  }

  // 新しいユーザーメッセージを追加 (添付あれば content をブロック配列にする)
  if (input.attachments && input.attachments.length > 0) {
    type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
    type DocBlock = { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };
    type TextBlock = { type: 'text'; text: string };
    const blocks: Array<ImageBlock | DocBlock | TextBlock> = [];
    for (const f of input.attachments) {
      if (f.mimeType.startsWith('image/')) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: f.mimeType, data: f.base64 },
        });
      } else if (f.mimeType === 'application/pdf') {
        blocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: f.base64 },
        });
      } else {
        // 動画など Anthropic 非対応のものはユーザーへの注意書きをテキスト化
        blocks.push({
          type: 'text',
          text: `[添付: ${f.name} (${f.mimeType})] このファイル形式は現在直接処理できません。`,
        });
      }
    }
    if (input.userMessage) {
      blocks.push({ type: 'text', text: input.userMessage });
    }
    messages.push({
      role: 'user',
      content: blocks as unknown as Anthropic.Messages.MessageParam['content'],
    });
  } else {
    messages.push({ role: 'user', content: input.userMessage });
  }

  // 3. ユーザーメッセージを永続化
  // 表示用には先頭の [TOOL:xxx] hidden hint を取り除いてユーザーが書いた本文だけを保存する。
  // Claude に渡す messages 側は input.userMessage のまま (=hint 込み) で、Claude が文脈判断に使う。
  const displayUserMessage = stripToolHintPrefix(input.userMessage);
  await appendMessage({
    sessionId: input.sessionId,
    role: 'user',
    content: displayUserMessage,
  });

  await recordAudit({
    adminId: input.admin.id,
    sessionId: input.sessionId,
    eventType: 'chat_request',
    payload: { message: displayUserMessage.slice(0, 500) },
    clientIp: input.clientIp,
    clientUa: input.clientUa,
  });

  // 4. Tool Use ループ
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let toolCallCount = 0;
  let assembledAssistantText = '';
  const toolCallsForPersistence: Array<{ id: string; name: string; input: unknown }> = [];
  // ループ単位の計測値 (cache hit/miss と TTFB を後で audit payload に書き出す)
  const loopTraces: LoopTrace[] = [];

  // 経過時間トラッキング (Claude Code 風 "経過 12s · 250 tokens" 表示用)
  const startedAtMs = Date.now();
  let currentPhase: 'thinking' | 'tool' | 'streaming' | 'organizing' = 'thinking';
  let currentPhaseLabel = '考え中...';
  let phaseStartedAtMs = Date.now();
  let liveOutputTokens = 0;

  // フェーズ切替を 1 箇所に集約。phaseStartedAtMs を漏れなくリセットする。
  const setPhase = (
    phase: 'thinking' | 'tool' | 'streaming' | 'organizing',
    label: string
  ) => {
    currentPhase = phase;
    currentPhaseLabel = label;
    phaseStartedAtMs = Date.now();
  };

  // 5秒ごとに heartbeat を送出。"動いてる証拠" を常に届けて UI が固まったように見えないようにする。
  // ツールフェーズが長引いている時は経過時間に応じて suffix を付け、止まっていないことを伝える。
  const HEARTBEAT_INTERVAL_MS = 5000;
  const heartbeatTimer = setInterval(() => {
    const phaseElapsedMs = Date.now() - phaseStartedAtMs;
    let label = currentPhaseLabel;
    if (currentPhase === 'tool') {
      if (phaseElapsedMs > 30_000) label = `${currentPhaseLabel} (もうしばらくお待ちください)`;
      else if (phaseElapsedMs > 15_000) label = `${currentPhaseLabel} (時間がかかっています)`;
      else if (phaseElapsedMs > 5_000) label = `${currentPhaseLabel} (まだ取得中)`;
    }
    input.onEvent({
      type: 'heartbeat',
      phase: currentPhase,
      label,
      elapsedMs: Date.now() - startedAtMs,
      outputTokens: liveOutputTokens,
    });
  }, HEARTBEAT_INTERVAL_MS);

  // 例外が起きても確実にティッカーを止める
  const stopHeartbeat = () => {
    clearInterval(heartbeatTimer);
  };

  try {
  for (let loop = 0; loop < maxToolLoops; loop += 1) {
    if (input.abortSignal?.aborted) {
      input.onEvent({ type: 'error', text: 'request aborted' });
      stopHeartbeat();
      return;
    }

    // 思考フェーズ: 初回は "考え中..."、ツール実行後は "回答を整理中..."
    if (loop === 0) {
      setPhase('thinking', '考え中...');
    } else {
      setPhase('organizing', '回答を整理中...');
    }
    input.onEvent({ type: 'status', status: currentPhaseLabel });

    // ループ単位の遅延計測ログ (調査用) — どのループが時間を食ってるか可視化する
    const loopStartMs = Date.now();
    let firstTokenAtMs: number | null = null;
    let streamDoneAtMs: number | null = null;
    console.log(`[advisor:trace] session=${input.sessionId} loop=${loop} start (msgs=${messages.length})`);

    // ツール実行後の最終応答 (loop > 0) は短い差分説明だけで十分なので、
    // max_tokens を絞って Anthropic 側の計算量と TTFB を抑える。
    // 通常の質問応答 (loop=0) は引き続き 4096 トークン許可。
    const loopMaxTokens = loop === 0 ? MAX_OUTPUT_TOKENS : 512;

    let stream;
    try {
      stream = client.messages.stream({
        model: activeModel,
        max_tokens: loopMaxTokens,
        system: systemMessage,
        tools: tools as never,
        messages,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[advisor] messages.stream threw:', errMsg, e);
      input.onEvent({ type: 'error', text: `Anthropic API 失敗: ${errMsg}` });
      return;
    }

    // ストリーミングイベントを処理
    let currentText = '';
    const currentToolUses: Array<{ id: string; name: string; input: unknown }> = [];

    let finalMessage;
    try {
      for await (const event of stream) {
        if (firstTokenAtMs === null && event.type === 'content_block_start') {
          firstTokenAtMs = Date.now();
        }
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            // tool_use 開始 (input は最後に確定)
            currentToolUses.push({ id: block.id, name: block.name, input: {} });
          } else if (block.type === 'text') {
            // テキストストリーム開始 → フェーズを streaming に切替
            setPhase('streaming', '回答を生成中...');
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            currentText += delta.text;
            // ライブ出力トークン数の近似 (1 delta ≒ 1 token とみなす。確定値は usage で後で上書き)
            liveOutputTokens += 1;
            input.onEvent({ type: 'text', text: delta.text });
          }
        }
      }
      finalMessage = await stream.finalMessage();
      streamDoneAtMs = Date.now();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[advisor] stream loop failed:', errMsg, e);
      input.onEvent({ type: 'error', text: `Anthropic 応答中にエラー: ${errMsg}` });
      stopHeartbeat();
      return;
    }

    // usage 集計
    const usage = finalMessage.usage as unknown as Record<string, unknown>;
    const cs = extractCacheStats(usage);
    totalInputTokens += Number(usage.input_tokens ?? 0);
    totalOutputTokens += Number(usage.output_tokens ?? 0);
    totalCacheReadTokens += cs.cacheReadTokens;
    totalCacheWriteTokens += cs.cacheWriteTokens;

    // tool_use を最終メッセージから取り出して input を確定
    const toolUseBlocks = finalMessage.content.filter(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
    );
    const textBlocks = finalMessage.content.filter(
      (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text'
    );
    const finalText = textBlocks.map((t) => t.text).join('');

    // ループ単位の遅延ブレイクダウン (調査用ログ)
    const ttfbMs = firstTokenAtMs !== null ? firstTokenAtMs - loopStartMs : null;
    const streamMs = firstTokenAtMs !== null && streamDoneAtMs !== null ? streamDoneAtMs - firstTokenAtMs : null;
    const totalLoopMs = (streamDoneAtMs ?? Date.now()) - loopStartMs;
    const stopReason = (finalMessage as { stop_reason?: string }).stop_reason ?? null;
    console.log(
      `[advisor:trace] session=${input.sessionId} loop=${loop} done ` +
        `total=${totalLoopMs}ms ttfb=${ttfbMs ?? 'n/a'}ms stream=${streamMs ?? 'n/a'}ms ` +
        `in=${usage.input_tokens} out=${usage.output_tokens} ` +
        `cacheRead=${cs.cacheReadTokens} cacheWrite=${cs.cacheWriteTokens} ` +
        `stop=${stopReason ?? '?'} ` +
        `tools=${toolUseBlocks.length}`
    );

    // 後続の判定 (cache 破壊 vs API 側遅延 vs tools cache 漏れ) のため loop 単位で永続化する。
    // chat_response audit の payload.loopTraces[] にまとめて入れる (後で latency-trace 拡張で展開)。
    loopTraces.push({
      loop,
      ttfbMs,
      streamMs,
      totalMs: totalLoopMs,
      inputTokens: Number(usage.input_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? 0),
      cacheReadInputTokens: cs.cacheReadTokens,
      cacheCreationInputTokens: cs.cacheWriteTokens,
      stopReason,
      toolUseCount: toolUseBlocks.length,
      maxTokens: loopMaxTokens,
    });

    // assistant メッセージを履歴に追加 (次の loop で必要)
    messages.push({ role: 'assistant', content: finalMessage.content });

    if (finalText) assembledAssistantText += finalText;

    // tool_use がなければ終了
    if (toolUseBlocks.length === 0) {
      // 最終 assistant メッセージを永続化
      const persistedMessage = await appendMessage({
        sessionId: input.sessionId,
        role: 'assistant',
        content: assembledAssistantText,
        toolCalls:
          toolCallsForPersistence.length > 0
            ? (toolCallsForPersistence as unknown as Prisma.InputJsonValue)
            : undefined,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheReadTokens: totalCacheReadTokens,
        cacheWriteTokens: totalCacheWriteTokens,
        model: activeModel,
      });

      input.onEvent({
        type: 'usage',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheReadTokens: totalCacheReadTokens,
        cacheWriteTokens: totalCacheWriteTokens,
      });
      input.onEvent({
        type: 'done',
        messageId: persistedMessage.id,
        conversationId: input.sessionId,
      });
      stopHeartbeat();

      await Promise.all([
        incrementSessionUsage({
          sessionId: input.sessionId,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        }),
        incrementUsage({
          adminId: input.admin.id,
          modelId: activeModel,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadTokens,
          cacheWriteTokens: totalCacheWriteTokens,
          toolCallCount,
        }),
        recordAudit({
          adminId: input.admin.id,
          sessionId: input.sessionId,
          messageId: persistedMessage.id,
          eventType: 'chat_response',
          payload: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheReadTokens: totalCacheReadTokens,
            cacheWriteTokens: totalCacheWriteTokens,
            toolCallCount,
            charCount: assembledAssistantText.length,
            // ループ単位の計測値 (cache 破壊 / API 側遅延 / tools cache 漏れ の切り分け用)
            loopTraces: loopTraces as unknown as Prisma.InputJsonValue,
          },
          clientIp: input.clientIp,
          clientUa: input.clientUa,
        }),
      ]);
      return;
    }

    // tool_use を実行
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUseBlocks) {
      // 個別ツールの進捗ラベルを UI に通知 + heartbeat フェーズ切替
      setPhase('tool', statusForTool(tu.name));
      input.onEvent({ type: 'status', status: currentPhaseLabel });
      input.onEvent({
        type: 'tool_use',
        id: tu.id,
        name: tu.name,
        input: tu.input,
      });
      toolCallsForPersistence.push({ id: tu.id, name: tu.name, input: tu.input });
      toolCallCount += 1;

      const result = await executeToolByName(tu.name, tu.input, {
        adminId: input.admin.id,
        sessionId: input.sessionId,
        abortSignal: input.abortSignal,
        userMessage: displayUserMessage,
      });

      const summary = result.ok
        ? `${tu.name} 成功${result.metadata?.rowCount !== undefined ? ` (${result.metadata.rowCount}件)` : ''}`
        : `${tu.name} 失敗: ${result.error}`;

      input.onEvent({
        type: 'tool_result',
        id: tu.id,
        ok: result.ok,
        summary,
        data: result.ok ? result.data : undefined,
        error: !result.ok ? result.error : undefined,
      });

      // 監査ログ
      await recordAudit({
        adminId: input.admin.id,
        sessionId: input.sessionId,
        eventType: result.ok ? 'tool_call' : 'tool_error',
        payload: {
          tool: tu.name,
          input: tu.input as Prisma.InputJsonValue,
          ok: result.ok,
          tookMs: result.ok ? result.metadata?.tookMs ?? null : null,
          error: !result.ok ? result.error : null,
        } as Prisma.InputJsonObject,
        clientIp: input.clientIp,
        clientUa: input.clientUa,
      });

      // tool persistence
      await appendMessage({
        sessionId: input.sessionId,
        role: 'tool',
        content: result.ok ? '' : result.error,
        toolResult: { tool_use_id: tu.id, ...result } as unknown as Prisma.InputJsonValue,
        model: activeModel,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result).slice(0, 50_000),
        is_error: !result.ok,
      });
    }

    // tool_result を user メッセージとして追加し、次のループへ
    // (以前 update_report_draft の後にサーバー側固定文で短絡していたが、
    //  ユーザーから「何を変えたか分からない」「機械的」と指摘されたため廃止。
    //  代わりに system prompt 経由で Claude に "1〜2 行で何を変えたか短く返す" よう指示している。
    //  loop=1 の TTFB は dynamic prompt にドラフト状態を埋めることで get_report_draft 不要になり改善見込み)
    messages.push({ role: 'user', content: toolResults });
  }

  // ループ上限超過: それまで生成した文章を捨てずに「途中まで」として保存して done。
  // ストリーム途中の text イベントは既にクライアントへ流れているので、ここで error にすると
  // クライアント側は「途中まで表示された推論」を消してエラーメッセージで上書きしてしまう。
  // ユーザー体験的には "考えてる文字が出てたのに消されてエラーになった" になり、
  // 今回ユーザーから報告された不具合がそれ。
  const cutoffNote = `\n\n---\n\n⚠️ 調査がツール呼び出し上限 (${maxToolLoops} 回) に達したため、ここで一旦区切りました。続きが必要なら「続けて」または追加の質問を送ってください。`;
  const finalContent = (assembledAssistantText || '').trimEnd() + cutoffNote;

  const persistedMessage = await appendMessage({
    sessionId: input.sessionId,
    role: 'assistant',
    content: finalContent,
    toolCalls:
      toolCallsForPersistence.length > 0
        ? (toolCallsForPersistence as unknown as Prisma.InputJsonValue)
        : undefined,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheReadTokens,
    cacheWriteTokens: totalCacheWriteTokens,
    model: activeModel,
  });

  // 末尾の "途中で区切った" 注記をクライアントに流す (これより前の本文は既に流れている)
  input.onEvent({ type: 'text', text: cutoffNote });
  input.onEvent({
    type: 'usage',
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheReadTokens,
    cacheWriteTokens: totalCacheWriteTokens,
  });
  input.onEvent({
    type: 'done',
    messageId: persistedMessage.id,
    conversationId: input.sessionId,
  });

  await Promise.all([
    incrementSessionUsage({
      sessionId: input.sessionId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    }),
    incrementUsage({
      adminId: input.admin.id,
      modelId: activeModel,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheReadTokens,
      cacheWriteTokens: totalCacheWriteTokens,
      toolCallCount,
    }),
    recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      messageId: persistedMessage.id,
      // 'error' を使うが、payload.reason='tool_loop_exceeded' で実害イベントと区別する
      eventType: 'error',
      payload: {
        reason: 'tool_loop_exceeded',
        maxLoops: maxToolLoops,
        toolCallCount,
        charCount: finalContent.length,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        // tool_loop_exceeded は致命的ではない (途中まで保存して done) ことを示す
        recovered: true,
        // ループ単位の計測値 (上限到達時も計測値は捨てない)
        loopTraces: loopTraces as unknown as Prisma.InputJsonValue,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    }),
  ]);
  } finally {
    // ループ脱出経路すべてで heartbeat ティッカーを止める
    stopHeartbeat();
  }
}
