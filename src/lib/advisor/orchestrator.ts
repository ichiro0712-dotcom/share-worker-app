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
import { ADVISOR_MODELS, getClaudeClient, type AdvisorModelId } from './claude';
import { buildSystemPrompt } from './system-prompt';
import { buildCachedSystem, extractCacheStats } from './prompt-cache';
import { describeAllToolsForLLM, executeToolByName } from './tools/registry';
import { annotateAndPersistTables } from './markdown-table-extractor';
import { getRecentMessagesForOrchestrator, appendMessage } from './persistence/messages';
import { getDraftBySession, upsertDraft } from './persistence/report-drafts';
import { editDraftWithGemini } from './llm/gemini-edit';
import { createDraftWithGemini } from './llm/gemini-draft-create';
import { editResultWithGemini } from './llm/gemini-result-edit';
import { buildChatHistoryContext } from './llm/chat-history-context';
import { generateReport } from './reports/generate';
import {
  createReportVersion,
  buildDraftSnapshot,
  getLatestVersion,
} from './persistence/report-versions';
import { incrementSessionUsage } from './persistence/sessions';
import { incrementUsage } from './cost-guard';
import { recordAudit } from './persistence/audit';
import { getAdvisorSettings } from './persistence/settings';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

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
  | { type: 'error'; text: string }
  /**
   * SQL 実行が承認待ちで保留された時に発火する。
   * クライアントはモーダルを表示し、ユーザーが承認したら sqlAutoApprove=true で
   * 同セッションに「お願いします」のような短い継続メッセージを送って実行を再開させる。
   */
  | {
      type: 'sql_approval_required';
      toolUseId: string;
      purpose: string;
      sql: string;
      expectedRows?: number;
    };

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
  /**
   * リクエスト時に指定したモデル ID (alias 含む)。
   * Anthropic は alias でも snapshot ID でも受けるため、設定で指定した文字列をそのまま記録する。
   */
  requestedModelId: string;
  /**
   * Anthropic レスポンスの Message.model に入っていた実モデル ID。
   * alias を指定した場合、Anthropic は実際に使われた snapshot ID を返してくる仕様。
   * これを記録することで「alias がサイレントに別 snapshot に切り替わった」事故を後追いできる。
   */
  responseModelId: string | null;
  /**
   * このループでの thinking 設定。
   * - "disabled": 明示的に { type: 'disabled' } を送った
   * - "adaptive:<effort>": 明示的に { type: 'adaptive' } を送った (effort は 'low'|'medium'|'high'|'max'|null)
   * - "enabled:<budget_tokens>": 明示的に { type: 'enabled', budget_tokens: N } を送った (legacy)
   * - "unset": thinking パラメータを送らなかった (旧モデルなら無効、Sonnet 4.6 等は将来挙動変化リスクあり)
   */
  thinkingMode: string;
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
  /**
   * 使用モデルの実 ID (Anthropic に直接渡す文字列)。
   * 例: "claude-sonnet-4-6" / "claude-haiku-4-5-20251001" / 古い snapshot ID。
   * orchestrator 内で migrateModelIfRetiring により retire 予定モデルは自動置換される。
   * 省略時は AdvisorSettings.primary_model_id か code 内 default が使われる。
   */
  modelId?: string;
  /** UI に進捗を流す callback */
  onEvent: (event: AdvisorStreamEvent) => void;
  abortSignal?: AbortSignal;
  /** 監査ログ用 client info */
  clientIp?: string | null;
  clientUa?: string | null;
  /**
   * SQL 実行 (execute_sql) の事前承認フラグ。
   * - false (デフォルト): 初回呼び出し時に承認待ちとなり、ツール結果は APPROVAL_REQUIRED で返す
   * - true: 確認なしで即実行
   * クライアント側でモーダル承認後にこのフラグを true にして再送する想定。
   */
  sqlAutoApprove?: boolean;
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
  execute_sql: 'SQL を実行中...',
  get_table: '過去の表 (T-XXX) を取得中...',
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
  add_tables_to_report: '表をレポートドラフトに追加中...',
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

  // 0. Advisor 設定 (max_tool_loops, system_prompt_override, model IDs) を取得
  // 設定ページから System Admin が編集可能なので、毎リクエスト DB に問い合わせる。
  const settings = await getAdvisorSettings().catch((e) => {
    console.warn('[advisor] failed to load settings, using defaults:', e);
    return {
      maxToolLoops: FALLBACK_MAX_TOOL_LOOPS,
      systemPromptOverride: null,
      primaryModelId: null,
      loop1ModelId: null,
    };
  });
  const maxToolLoops = settings.maxToolLoops ?? FALLBACK_MAX_TOOL_LOOPS;

  // モデル決定: ユーザーが UI で明示指定 > 設定 DB の primary_model_id > code 内デフォルト。
  // input.modelId は UI のモデルセレクタの値。設定 DB はサービスレベルの規定値。
  // 設定 DB に文字列だけ入れる運用なので AdvisorModelId 型ではなく素の string で扱う。
  //
  // 注: 以前ここに「Sonnet 4 → Sonnet 4.6 自動置換」の防衛コードを入れていたが、
  // 「ユーザーが Sonnet 4 を明示選択しても 4.6 で実行されてしまう」という性能比較の障害に
  // なったため撤去。retire 予定モデルの警告は console.warn で残し、判断はユーザーに委ねる。
  // 強制置換が必要なら設定ページの primary_model_id を運用で書き換える方針。
  const primaryModel: string = input.modelId ?? settings.primaryModelId ?? DEFAULT_MODEL;
  const loop1Model: string = settings.loop1ModelId ?? primaryModel;

  // retire 予定モデルが指定された場合は警告ログを出すだけ (置換しない)。
  const RETIRING_MODELS = new Set([
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
  ]);
  if (RETIRING_MODELS.has(primaryModel)) {
    console.warn(
      `[advisor] primary model "${primaryModel}" is retiring 2026-06-15. ` +
        `Consider migrating to claude-sonnet-4-6 or claude-opus-4-7.`
    );
  }
  if (loop1Model !== primaryModel && RETIRING_MODELS.has(loop1Model)) {
    console.warn(
      `[advisor] loop1 model "${loop1Model}" is retiring 2026-06-15.`
    );
  }

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

  // 3.5. レポート系メッセージの Gemini バイパス
  //
  // Anthropic ノードアフィニティ問題で loop=1 が 100 秒級になる事象を構造的に回避する。
  // - `[TOOL:report_create]` (初回ドラフト作成): Gemini で要件確定 + skeleton 生成
  // - `[TOOL:draft_revise]` (ドラフト修正指示): Gemini で skeleton_markdown 書き換え
  //
  // 失敗時の方針:
  // - Gemini 呼び出し中の例外 (parse 失敗 / API エラー) は **handled=true で返り**、
  //   Gemini 関数内でエラーメッセージを SSE に流して done する。Anthropic に fall
  //   through しない (loop=1 TTFB 100 秒級が再現するため、ユーザーに 2 分待たせる
  //   くらいなら 5 秒で「失敗、再試行を」と返す方が遥かにマシ)。
  // - 前提条件 NG (no draft / admin mismatch / empty skeleton on revise) は
  //   handled=false で Anthropic にフォールバック。これらは「Gemini を呼ぶ意味が
  //   無い」ケースなので Anthropic で通常チャットとして扱うのが正しい。
  const trimmed = input.userMessage.trimStart();
  if (trimmed.startsWith('[TOOL:report_create]')) {
    const bypassResult = await tryGeminiDraftCreateBypass({
      input,
      userRequest: displayUserMessage,
    });
    if (bypassResult.handled) return;
  } else if (trimmed.startsWith('[TOOL:draft_revise]')) {
    const bypassResult = await tryGeminiDraftReviseBypass({
      input,
      instruction: displayUserMessage,
    });
    if (bypassResult.handled) return;
  } else if (trimmed.startsWith('[TOOL:result_edit]')) {
    const bypassResult = await tryGeminiResultEditBypass({
      input,
      instruction: displayUserMessage,
    });
    if (bypassResult.handled) return;
  }

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

    // max_tokens の決定。
    //
    // 過去に「loop>0 は短い差分説明だけだから 512 で足りる」と判断していたが、
    // これは致命的なバグだった (2026-05-02 観測):
    // - update_report_draft の skeleton_markdown を含む JSON は 512 tokens に収まらない
    // - max_tokens で切られると Anthropic はツール JSON を途中で打ち切る
    // - サーバー側で「input が壊れている → 更新フィールドが 1 つも指定されていません」エラー
    // - Claude がリトライ → また 512 で切れる → 14 連続失敗、ループ上限到達
    // - 結果: 3 分かかってチャット欄に「すみません、ツール呼び出しに問題が発生しています」
    //
    // 対策: loop>0 でも 4096 まで許可する (= MAX_OUTPUT_TOKENS と同じ)。
    // 「短い差分説明」を期待する制約はシステムプロンプトの指示で達成する
    // (system-prompt.ts に「1〜2 行 (50〜120 字) の超短文」と既に明記済み)。
    // モデル側が自主的に短く返してくれることを期待し、上限はあくまで上限とする。
    const loopMaxTokens = MAX_OUTPUT_TOKENS;

    // このループで使うモデル。loop=0 は primary、loop>0 は loop1 (= primary か Haiku 等)。
    // 設定 DB の loop1_model_id が null なら primary と同じになる (= 全ループ同一モデル)。
    const currentLoopModel: string = loop === 0 ? primaryModel : loop1Model;

    // thinking パラメータの決定。
    // - Sonnet 4.6 / Opus 4.7 / Opus 4.6 は Adaptive Thinking 対応モデルで、
    //   デフォルト挙動が公式 docs で断定されていない (将来 thinking が自動 on になる可能性あり)。
    //   Anthropic 推奨は { type: 'adaptive' } だが、TASTAS Advisor のレポート用途では
    //   思考トークンの追加生成は不要 (本文生成は Gemini に任せている) なので
    //   { type: 'disabled' } を明示して TTFB を最小化する。
    // - Sonnet 4 / Sonnet 4.5 までは thinking を送らないとそもそも off なので unset のまま。
    // - Haiku は extended thinking 対応だが軽量モデルなので unset で十分。
    const SONNET46_OR_ADAPTIVE_MODELS = new Set([
      'claude-sonnet-4-6',
      'claude-opus-4-7',
      'claude-opus-4-6',
    ]);
    const useDisabledThinking = SONNET46_OR_ADAPTIVE_MODELS.has(currentLoopModel);
    const currentThinkingMode: string = useDisabledThinking ? 'disabled' : 'unset';

    let stream;
    try {
      // thinking パラメータは型上 ThinkingConfigParam 互換が必要。disabled 指定は
      // SDK の ThinkingConfigDisabled ({ type: 'disabled' }) と一致する。
      const streamParams: Anthropic.Messages.MessageStreamParams = {
        model: currentLoopModel,
        max_tokens: loopMaxTokens,
        system: systemMessage,
        tools: tools as never,
        messages,
      };
      if (useDisabledThinking) {
        streamParams.thinking = { type: 'disabled' };
      }
      stream = client.messages.stream(streamParams);
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
    const responseModelForLog =
      (finalMessage as unknown as { model?: string }).model ?? null;
    console.log(
      `[advisor:trace] session=${input.sessionId} loop=${loop} done ` +
        `total=${totalLoopMs}ms ttfb=${ttfbMs ?? 'n/a'}ms stream=${streamMs ?? 'n/a'}ms ` +
        `in=${usage.input_tokens} out=${usage.output_tokens} ` +
        `cacheRead=${cs.cacheReadTokens} cacheWrite=${cs.cacheWriteTokens} ` +
        `stop=${stopReason ?? '?'} ` +
        `tools=${toolUseBlocks.length} ` +
        `req=${currentLoopModel} resp=${responseModelForLog ?? '?'} ` +
        `think=${currentThinkingMode}`
    );

    // 後続の判定 (cache 破壊 vs API 側遅延 vs tools cache 漏れ) のため loop 単位で永続化する。
    // chat_response audit の payload.loopTraces[] にまとめて入れる (後で latency-trace 拡張で展開)。
    //
    // requestedModelId は SDK に渡した値、responseModelId は Anthropic が返した実 snapshot ID。
    // alias を指定した場合、Anthropic は実 snapshot ID を返してくれるので両方記録する
    // (alias がサイレントに別 snapshot に切り替わった事故を後追いできるようにするため)。
    const responseModelId =
      (finalMessage as unknown as { model?: string }).model ?? null;
    loopTraces.push({
      loop,
      requestedModelId: currentLoopModel,
      responseModelId,
      thinkingMode: currentThinkingMode,
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
        model: primaryModel,
      });

      // 応答本文内の Markdown 表を抽出して advisor_chat_tables に登録し、
      // T-XXX を採番して本文を書き換える。
      // - ストリーム送信は終わっているが、done イベントに annotatedContent を含めて
      //   クライアントが即座に T-XXX 付きで表示できるようにする (リロード不要)
      // - 別セッションから「T-XXX を get_table」で参照可能になる
      let annotatedFinalContent: string | null = null;
      try {
        const annotated = await annotateAndPersistTables({
          content: assembledAssistantText,
          sessionId: input.sessionId,
          messageId: persistedMessage.id,
          adminId: input.admin.id,
        });
        if (annotated.createdIds.length > 0) {
          await prisma.advisorChatMessage.update({
            where: { id: persistedMessage.id },
            data: { content: annotated.content },
          });
          annotatedFinalContent = annotated.content;
        }
      } catch (e) {
        console.error('[advisor] Markdown table annotate failed:', e);
      }

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
        data: annotatedFinalContent
          ? { annotatedContent: annotatedFinalContent }
          : undefined,
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
          modelId: primaryModel,
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

      // execute_sql は承認ゲート対象: sqlAutoApprove=false なら実行せず承認待ちで done する
      //
      // 設計メモ:
      //   ここで Anthropic に「APPROVAL_REQUIRED」を tool_result として返して loop を続けると、
      //   loop=1 で Anthropic が「ユーザーの承認を待ちます」みたいな応答を作るために 90+ 秒
      //   TTFB を引き当てる事故が起きる。そもそも待つだけの応答に Claude を呼ぶ必要は無い。
      //   そのため、ここで sql_approval_required を発火し、サーバー側で done を返して即終了する。
      //   ユーザーが承認モーダルで OK を押すと、クライアントが新規メッセージ(「お願いします」)を
      //   sqlAutoApprove=true で投げ直し、その時に LLM が同じ意図で execute_sql を再呼び出しする。
      if (tu.name === 'execute_sql' && !input.sqlAutoApprove) {
        const sqlInput = (tu.input ?? {}) as {
          sql?: string;
          purpose?: string;
          expected_rows?: number;
        };
        input.onEvent({
          type: 'sql_approval_required',
          toolUseId: tu.id,
          purpose: sqlInput.purpose ?? '(目的未指定)',
          sql: sqlInput.sql ?? '',
          expectedRows: sqlInput.expected_rows,
        });

        // 監査ログ (承認待ち)
        await recordAudit({
          adminId: input.admin.id,
          sessionId: input.sessionId,
          eventType: 'tool_call',
          payload: {
            tool: tu.name,
            input: tu.input as Prisma.InputJsonValue,
            ok: false,
            status: 'awaiting_user_approval',
          } as Prisma.InputJsonObject,
          clientIp: input.clientIp,
          clientUa: input.clientUa,
        });

        // サーバー側 done:
        //   loop=1 を呼ばないので Anthropic API への往復は loop=0 で打ち切り。
        //   ユーザー視点では「承認モーダル + チャット欄が解放されて、承認を押すと再送される」
        //   挙動になる。
        const noticeText =
          assembledAssistantText.trimEnd() +
          (assembledAssistantText ? '\n\n' : '') +
          '⏳ SQL 実行の承認をお待ちしています。モーダルで「実行する」を押すと再開します。';

        const persistedNotice = await appendMessage({
          sessionId: input.sessionId,
          role: 'assistant',
          content: noticeText,
          toolCalls:
            toolCallsForPersistence.length > 0
              ? (toolCallsForPersistence as unknown as Prisma.InputJsonValue)
              : undefined,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadTokens,
          cacheWriteTokens: totalCacheWriteTokens,
          model: primaryModel,
        });
        if (!assembledAssistantText) {
          input.onEvent({
            type: 'text',
            text: '⏳ SQL 実行の承認をお待ちしています。モーダルで「実行する」を押すと再開します。',
          });
        }
        input.onEvent({
          type: 'usage',
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadTokens,
          cacheWriteTokens: totalCacheWriteTokens,
        });
        input.onEvent({
          type: 'done',
          messageId: persistedNotice.id,
          conversationId: input.sessionId,
        });
        stopHeartbeat();
        return;
      }

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
        model: primaryModel,
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

    // 🚀 execute_sql 成功時のサーバー側短絡:
    //   loop=1 (ツール結果を Claude に渡して整形応答を作る) は Anthropic 側で 100 秒級 TTFB
    //   問題が出やすい。execute_sql は「表として結果が UI に表示されている」だけで十分に
    //   完結するので、LLM に整形させずサーバー側で固定文を返して即 done する。
    //   表 ID を本文に含めることでユーザーに参照方法を伝える + add_tables_to_report で
    //   レポートに送る導線も残せる。
    const executeSqlSuccess = toolUseBlocks.find((b) => b.name === 'execute_sql');
    if (executeSqlSuccess && input.sqlAutoApprove) {
      // toolResults に対応する成功結果があるか確認 (is_error=false)
      const matched = toolResults.find(
        (tr) => tr.tool_use_id === executeSqlSuccess.id && !tr.is_error
      );
      if (matched) {
        // 短絡: tool_result の data から表 ID を抽出して固定文を組み立てる
        let tableIdLine = '';
        try {
          const parsed = JSON.parse(
            typeof matched.content === 'string' ? matched.content : ''
          );
          if (parsed?.ok && parsed?.data?.table_id) {
            const td = parsed.data;
            tableIdLine =
              `**表 ${td.table_id}** (${td.row_count?.toLocaleString?.('ja-JP') ?? td.row_count} 行${
                td.truncated ? ' / 上限到達' : ''
              }) を取得しました。\n\n` +
              `内容を確認したら、「表 ${td.table_id} をレポートに追加して」と言うとレポートに送れます。`;
          }
        } catch {
          /* ignore */
        }
        const finalText =
          (assembledAssistantText || '').trimEnd() +
          (assembledAssistantText ? '\n\n' : '') +
          (tableIdLine || 'SQL の結果を表として取得しました。');

        const persistedShortcut = await appendMessage({
          sessionId: input.sessionId,
          role: 'assistant',
          content: finalText,
          toolCalls:
            toolCallsForPersistence.length > 0
              ? (toolCallsForPersistence as unknown as Prisma.InputJsonValue)
              : undefined,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadTokens,
          cacheWriteTokens: totalCacheWriteTokens,
          model: primaryModel,
        });
        // ショートカット応答にも Markdown 表があれば自動採番 (短い固定文なので通常は無いが念のため)
        try {
          const annotated = await annotateAndPersistTables({
            content: finalText,
            sessionId: input.sessionId,
            messageId: persistedShortcut.id,
            adminId: input.admin.id,
          });
          if (annotated.createdIds.length > 0) {
            await prisma.advisorChatMessage.update({
              where: { id: persistedShortcut.id },
              data: { content: annotated.content },
            });
          }
        } catch (e) {
          console.error('[advisor] Markdown table annotate (shortcut) failed:', e);
        }
        input.onEvent({ type: 'text', text: tableIdLine });
        input.onEvent({
          type: 'usage',
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cacheReadTokens: totalCacheReadTokens,
          cacheWriteTokens: totalCacheWriteTokens,
        });
        input.onEvent({
          type: 'done',
          messageId: persistedShortcut.id,
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
            modelId: primaryModel,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheReadTokens: totalCacheReadTokens,
            cacheWriteTokens: totalCacheWriteTokens,
            toolCallCount,
          }),
          recordAudit({
            adminId: input.admin.id,
            sessionId: input.sessionId,
            messageId: persistedShortcut.id,
            eventType: 'chat_response',
            payload: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              cacheReadTokens: totalCacheReadTokens,
              cacheWriteTokens: totalCacheWriteTokens,
              toolCallCount,
              charCount: finalText.length,
              loopTraces: loopTraces as unknown as Prisma.InputJsonValue,
              shortCircuit: 'execute_sql',
            } as Prisma.InputJsonObject,
            clientIp: input.clientIp,
            clientUa: input.clientUa,
          }),
        ]);
        return;
      }
    }
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
    model: primaryModel,
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
      modelId: primaryModel,
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

/**
 * [TOOL:draft_revise] を Gemini API 直叩きでバイパス処理する。
 *
 * 成功時: SSE で text + done を送出して { handled: true } を返す。
 * 失敗時: ログ出力して { handled: false } を返す (呼び出し側で Anthropic ルートに fall through)。
 *
 * 失敗パターン:
 *   - ドラフトが存在しない / skeleton_markdown が空
 *   - Gemini API エラー (キー未設定 / レート制限 / ネットワーク)
 *   - JSON パース失敗 / 構造化出力崩れ
 *   - DB upsert 失敗
 */
/**
 * [TOOL:report_create] を Gemini API 直叩きでバイパス処理する。
 *
 * 初回ドラフト作成: ユーザーの自由文要望を Gemini Flash に渡して、
 * 要件 (title / goal / range / data_sources / metric_keys / outline / notes) と
 * 0 埋め skeleton_markdown を 1 回の JSON 出力で全部生成する。
 *
 * 成功時: SSE で text/usage/done を送出して { handled: true } を返す。
 * 失敗時: ログ出力 + audit に gemini_failed を記録して { handled: false } を返す
 *         (呼び出し側で Anthropic ルートに fall through)。
 */
async function tryGeminiDraftCreateBypass(args: {
  input: OrchestratorRunInput
  /** [TOOL:report_create] プレフィックスを剥がしたユーザー要望 */
  userRequest: string
}): Promise<{ handled: boolean }> {
  const { input, userRequest } = args
  const startMs = Date.now()
  let elapsedMs = 0
  let inputTokens = 0
  let outputTokens = 0
  let geminiModel = 'unknown'

  // Gemini が完了するまで 5〜10 秒かかるので、UI が「考え中...」のまま固まらないよう
  // 5 秒ごとに heartbeat を送って Claude Code 風の経過秒数表示を維持する。
  input.onEvent({ type: 'status', status: 'ドラフトを作成中... (Gemini)' })
  const heartbeatTimer = setInterval(() => {
    input.onEvent({
      type: 'heartbeat',
      phase: 'streaming',
      label: 'Gemini で生成中...',
      elapsedMs: Date.now() - startMs,
      outputTokens: 0,
    })
  }, 5000)

  try {
    const result = await createDraftWithGemini({
      userRequest,
      nowJst: new Date(),
      abortSignal: input.abortSignal,
    })
    elapsedMs = result.metrics.elapsedMs
    inputTokens = result.metrics.inputTokens
    outputTokens = result.metrics.outputTokens
    geminiModel = result.metrics.model

    // unavailable_request=true の場合 = 要望が現状取得不可な指標のみ
    // → Canvas にドラフトを作らず、summary だけチャットに返す。
    if (!result.unavailableRequest) {
      await upsertDraft({
        sessionId: input.sessionId,
        adminId: input.admin.id,
        title: result.title,
        goal: result.goal,
        dataSources: result.dataSources,
        metricKeys: result.metricKeys,
        rangeStart: result.rangeStart,
        rangeEnd: result.rangeEnd,
        outline: result.outline,
        notes: result.notes,
        skeletonMarkdown: result.skeletonMarkdown,
        originalRequest: userRequest,
      })
    }

    // SSE 送出
    //    「📋 ドラフトを作成しました」イベントラベル付きで履歴 / Gemini が把握できるように。
    //    unavailable_request の場合 (ドラフト未作成・拒否) はラベルを付けない。
    const eventText = result.unavailableRequest
      ? result.summary
      : `📋 **ドラフトを作成しました**\n${result.summary}`
    input.onEvent({ type: 'text', text: eventText })
    const persisted = await appendMessage({
      sessionId: input.sessionId,
      role: 'assistant',
      content: eventText,
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      model: geminiModel,
    })
    input.onEvent({
      type: 'usage',
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    input.onEvent({
      type: 'done',
      messageId: persisted.id,
      conversationId: input.sessionId,
    })

    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      messageId: persisted.id,
      eventType: 'chat_response',
      payload: {
        gemini_direct_create: true,
        elapsed_ms: Date.now() - startMs,
        gemini_elapsed_ms: elapsedMs,
        gemini_model: geminiModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        title: result.title,
        data_sources: result.dataSources,
        metric_keys_count: result.metricKeys.length,
        skeleton_chars: result.skeletonMarkdown.length,
        unavailable_request: result.unavailableRequest,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    })

    console.log(
      `[advisor:gemini-bypass] create-success session=${input.sessionId} ` +
        `total=${Date.now() - startMs}ms gemini=${elapsedMs}ms ` +
        `in=${inputTokens} out=${outputTokens} dataSources=${result.dataSources.join(',')}`
    )
    return { handled: true }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error(
      `[advisor:gemini-bypass] create-failed: ${errMsg}`,
      e
    )

    // ユーザーに失敗を伝えて終了する (Anthropic に fall through しない)。
    // Anthropic は loop=1 で 100 秒級の TTFB を出すため、失敗時に渋々 Anthropic を
    // 呼び直すと 2 分待たされて結局答えが返らない最悪 UX になる。
    // 5〜10 秒で「ドラフト作成に失敗しました、もう一度お試しください」を返す方が
    // ユーザーにとって遥かに良い (再試行で済む)。
    // UI 側 (chat-layout.tsx) は 'error' イベントを受けた瞬間に throw → catch で
    // assistant メッセージとしてエラー文を表示するため、ここでサーバー側の
    // appendMessage / done 送出は不要 (むしろ重複表示の原因になる)。
    const userVisibleError =
      'ドラフト作成に失敗しました。もう一度お試しください。\n' +
      `(エラー: ${errMsg.slice(0, 200)})`
    input.onEvent({ type: 'error', text: userVisibleError })

    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      eventType: 'error',
      payload: {
        gemini_direct_create: true,
        gemini_failed: true,
        elapsed_ms: Date.now() - startMs,
        error: errMsg,
        recovered: false,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    }).catch(() => {})
    return { handled: true }
  } finally {
    clearInterval(heartbeatTimer)
  }
}

async function tryGeminiDraftReviseBypass(args: {
  input: OrchestratorRunInput
  /** [TOOL:draft_revise] プレフィックスを剥がしたユーザー指示 */
  instruction: string
}): Promise<{ handled: boolean }> {
  const { input, instruction } = args
  const startMs = Date.now()
  let elapsedMs = 0
  let inputTokens = 0
  let outputTokens = 0
  let geminiModel = 'unknown'
  // try ブロック外でも clearInterval できるように外側で宣言
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  try {
    // 1. ドラフト取得 (存在しなければ Anthropic にフォールバック)
    const draft = await getDraftBySession(input.sessionId)
    if (!draft) {
      console.log('[advisor:gemini-bypass] no draft → fallback to Anthropic')
      return { handled: false }
    }
    if (!draft.skeletonMarkdown || draft.skeletonMarkdown.trim().length === 0) {
      console.log('[advisor:gemini-bypass] empty skeleton → fallback to Anthropic')
      return { handled: false }
    }
    if (draft.adminId !== input.admin.id) {
      // セキュリティ: 別 admin のドラフトを編集しない (通常起きないが念のため)
      console.warn('[advisor:gemini-bypass] admin mismatch → fallback')
      return { handled: false }
    }

    // 2. UI に「ドラフト更新中」状態を伝える + heartbeat タイマー開始
    //    (Gemini 5〜10 秒の間 UI が固まらないよう経過秒数表示を継続更新)
    input.onEvent({ type: 'status', status: 'ドラフトを更新中... (Gemini)' })
    heartbeatTimer = setInterval(() => {
      input.onEvent({
        type: 'heartbeat',
        phase: 'streaming',
        label: 'Gemini で更新中...',
        elapsedMs: Date.now() - startMs,
        outputTokens: 0,
      })
    }, 5000)

    // 3. 直近チャット履歴を取得 (Gemini に文脈を渡す)
    const chatHistoryContext = await buildChatHistoryContext({
      sessionId: input.sessionId,
      contextCount: 8,
    }).catch(() => '')

    // 4. Gemini で編集
    const result = await editDraftWithGemini({
      currentSkeleton: draft.skeletonMarkdown,
      userInstruction: instruction,
      requirements: {
        title: draft.title,
        goal: draft.goal,
        rangeStart: draft.rangeStart,
        rangeEnd: draft.rangeEnd,
        metricKeys: draft.metricKeys,
        outline: draft.outline,
        notes: draft.notes,
      },
      chatHistoryContext,
      abortSignal: input.abortSignal,
    })
    elapsedMs = result.metrics.elapsedMs
    inputTokens = result.metrics.inputTokens
    outputTokens = result.metrics.outputTokens
    geminiModel = result.metrics.model

    // 4. DB 更新 (skeleton_markdown + skeleton 変更に伴う要件メタの同期更新)
    //    refused=true なら現状維持 (取得不可指標を追加する指示を Gemini が拒否したケース)
    if (!result.refused) {
      await upsertDraft({
        sessionId: input.sessionId,
        adminId: input.admin.id,
        skeletonMarkdown: result.updatedSkeleton,
        // Gemini が「変更あり」と判断したフィールドだけ反映 (null は upsert 側で「変更なし」として扱う)
        ...(result.updatedDataSources !== null
          ? { dataSources: result.updatedDataSources }
          : {}),
        ...(result.updatedMetricKeys !== null
          ? { metricKeys: result.updatedMetricKeys }
          : {}),
        ...(result.updatedOutline !== null ? { outline: result.updatedOutline } : {}),
        ...(result.updatedGoal !== null ? { goal: result.updatedGoal } : {}),
        ...(result.updatedTitle !== null ? { title: result.updatedTitle } : {}),
      })
    }

    // 5. SSE で UI にレスポンスを流す
    //    「📝 ドラフトを更新しました」イベントラベル付きで履歴と Gemini が把握できるように。
    const eventText = result.refused
      ? result.summary
      : `📝 **ドラフトを更新しました**\n${result.summary}`
    input.onEvent({ type: 'text', text: eventText })

    // assistant メッセージを永続化
    const persisted = await appendMessage({
      sessionId: input.sessionId,
      role: 'assistant',
      content: eventText,
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      model: geminiModel,
    })

    input.onEvent({
      type: 'usage',
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    input.onEvent({
      type: 'done',
      messageId: persisted.id,
      conversationId: input.sessionId,
    })

    // 6. audit に記録 (gemini_direct_edit フラグ + elapsed_ms で後追い分析できるように)
    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      messageId: persisted.id,
      eventType: 'chat_response',
      payload: {
        gemini_direct_edit: true,
        elapsed_ms: Date.now() - startMs,
        gemini_elapsed_ms: elapsedMs,
        gemini_model: geminiModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        fields_updated: result.fieldsUpdated,
        summary_chars: result.summary.length,
        skeleton_chars: result.updatedSkeleton.length,
        refused: result.refused,
        synced_data_sources: result.updatedDataSources,
        synced_metric_keys: result.updatedMetricKeys,
        synced_outline_changed: result.updatedOutline !== null,
        synced_goal_changed: result.updatedGoal !== null,
        synced_title_changed: result.updatedTitle !== null,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    })

    console.log(
      `[advisor:gemini-bypass] success session=${input.sessionId} ` +
        `total=${Date.now() - startMs}ms gemini=${elapsedMs}ms ` +
        `in=${inputTokens} out=${outputTokens} fields=${result.fieldsUpdated.join(',')}`
    )
    return { handled: true }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error(
      `[advisor:gemini-bypass] revise-failed: ${errMsg}`,
      e
    )

    // ユーザーに失敗を伝えて終了する (Anthropic に fall through しない)。
    // 理由は create 側と同じ — Anthropic loop=1 TTFB が 100 秒級になるため、
    // 失敗のたびに Anthropic に流すと 2 分待たされる最悪 UX になる。
    // UI 側で error イベントを受けて表示するので、appendMessage / done は不要。
    const userVisibleError =
      'ドラフト修正に失敗しました。もう一度お試しください。\n' +
      `(エラー: ${errMsg.slice(0, 200)})`
    input.onEvent({ type: 'error', text: userVisibleError })

    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      eventType: 'error',
      payload: {
        gemini_direct_edit: true,
        gemini_failed: true,
        elapsed_ms: Date.now() - startMs,
        error: errMsg,
        recovered: false,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    }).catch(() => {})
    return { handled: true }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
  }
}

/**
 * `[TOOL:result_edit]` を Gemini で直接処理する。
 *
 * 生成済みレポート (result_markdown) を Gemini Flash で部分書き換えして、
 * 新しい `AdvisorReportVersion` (source='llm_edit') として保存する。
 * skeleton (ドラフト本体) は触らない。
 *
 * 失敗時の方針: draft 系と同様、Anthropic に fall through せず error イベントで
 * ユーザーに「失敗、再試行を」と返す (loop=1 TTFB 問題回避)。
 */
async function tryGeminiResultEditBypass(args: {
  input: OrchestratorRunInput
  /** [TOOL:result_edit] プレフィックスを剥がしたユーザー指示 */
  instruction: string
}): Promise<{ handled: boolean }> {
  const { input, instruction } = args
  const startMs = Date.now()
  let elapsedMs = 0
  let inputTokens = 0
  let outputTokens = 0
  let geminiModel = 'unknown'
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  try {
    // 1. ドラフト + 最新バージョン取得
    const draft = await getDraftBySession(input.sessionId)
    if (!draft) {
      console.log('[advisor:gemini-bypass] result_edit: no draft → fallback to Anthropic')
      return { handled: false }
    }
    if (draft.adminId !== input.admin.id) {
      console.warn('[advisor:gemini-bypass] result_edit: admin mismatch → fallback')
      return { handled: false }
    }
    const latest = await getLatestVersion(draft.id)
    if (!latest || !latest.resultMarkdown || latest.resultMarkdown.trim().length === 0) {
      // まだレポート未生成 → Anthropic に流して通常会話 or ガイダンスさせる
      console.log('[advisor:gemini-bypass] result_edit: no result yet → fallback to Anthropic')
      return { handled: false }
    }

    // 2. UI に「レポート更新中」状態を伝える
    input.onEvent({ type: 'status', status: 'レポートを更新中... (Gemini)' })
    heartbeatTimer = setInterval(() => {
      input.onEvent({
        type: 'heartbeat',
        phase: 'streaming',
        label: 'Gemini で更新中...',
        elapsedMs: Date.now() - startMs,
        outputTokens: 0,
      })
    }, 5000)

    // 3. 直近チャット履歴を取得 (Gemini に文脈を渡す)
    const chatHistoryContext = await buildChatHistoryContext({
      sessionId: input.sessionId,
      contextCount: 8,
    }).catch(() => '')

    // 4. Gemini で編集
    const result = await editResultWithGemini({
      currentResult: latest.resultMarkdown,
      userInstruction: instruction,
      context: {
        title: draft.title,
        goal: draft.goal,
        rangeStart: draft.rangeStart,
        rangeEnd: draft.rangeEnd,
      },
      chatHistoryContext,
      abortSignal: input.abortSignal,
    })
    elapsedMs = result.metrics.elapsedMs
    inputTokens = result.metrics.inputTokens
    outputTokens = result.metrics.outputTokens
    geminiModel = result.metrics.model

    // 4.5 Gemini が「これは新データ取得が必要 (result_edit では実現不可)」と判定した場合、
    //     裏で draft_revise → upsertDraft → generateReport を続けて実行する。
    //     ユーザーは Canvas で新バージョンが生成されるのを見るだけで、ドラフトタブに
    //     切り替えて再生成ボタンを押す手間が無くなる。
    if (result.redirectToDraft && result.draftInstruction) {
      input.onEvent({
        type: 'status',
        status: 'データ取得が必要なため、ドラフトを更新して再生成中...',
      })
      const auto = await runAutoRedraftAndRegenerate({
        input,
        draft,
        draftInstruction: result.draftInstruction,
        chatHistoryContext,
        startMs,
        priorElapsedMs: elapsedMs,
        priorInputTokens: inputTokens,
        priorOutputTokens: outputTokens,
        editSummary: result.summary,
      })
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      return { handled: auto.handled }
    }

    // 5. 新バージョンとして保存 (source='llm_edit')
    //    createReportVersion が draft.result_markdown / generated_at / generation_count も自動更新する
    const version = await createReportVersion({
      draftId: draft.id,
      resultMarkdown: result.updatedResult,
      resultModel: geminiModel,
      draftSnapshot: buildDraftSnapshot({
        title: draft.title,
        goal: draft.goal,
        dataSources: draft.dataSources,
        metricKeys: draft.metricKeys,
        rangeStart: draft.rangeStart,
        rangeEnd: draft.rangeEnd,
        outline: draft.outline,
        notes: draft.notes,
      }),
      source: 'llm_edit',
      parentVersionId: latest.id,
      generatedMs: elapsedMs,
      inputTokens,
      outputTokens,
    })

    // 5. SSE で UI にレスポンスを流す
    //    「✏️ レポート vN に編集しました」イベントラベルを付けて、後で履歴 / Gemini が
    //    どのバージョンに対する編集かを把握できるようにする。
    const eventText = `✏️ **レポート v${version.versionNumber} を編集しました**\n${result.summary}`
    input.onEvent({ type: 'text', text: eventText })
    const persisted = await appendMessage({
      sessionId: input.sessionId,
      role: 'assistant',
      content: eventText,
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      model: geminiModel,
    })
    input.onEvent({
      type: 'usage',
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    input.onEvent({
      type: 'done',
      messageId: persisted.id,
      conversationId: input.sessionId,
    })

    // 6. audit
    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      messageId: persisted.id,
      eventType: 'chat_response',
      payload: {
        gemini_direct_result_edit: true,
        elapsed_ms: Date.now() - startMs,
        gemini_elapsed_ms: elapsedMs,
        gemini_model: geminiModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        result_chars: result.updatedResult.length,
        new_version_id: version.id,
        new_version_number: version.versionNumber,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    })

    console.log(
      `[advisor:gemini-bypass] result-edit-success session=${input.sessionId} ` +
        `total=${Date.now() - startMs}ms gemini=${elapsedMs}ms ` +
        `in=${inputTokens} out=${outputTokens} new_v=${version.versionNumber}`
    )
    return { handled: true }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error(`[advisor:gemini-bypass] result-edit-failed: ${errMsg}`, e)

    // ユーザーに失敗を伝えて終了 (Anthropic に fall through しない)
    const userVisibleError =
      'レポート修正に失敗しました。もう一度お試しください。\n' +
      `(エラー: ${errMsg.slice(0, 200)})`
    input.onEvent({ type: 'error', text: userVisibleError })

    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      eventType: 'error',
      payload: {
        gemini_direct_result_edit: true,
        gemini_failed: true,
        elapsed_ms: Date.now() - startMs,
        error: errMsg,
        recovered: false,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    }).catch(() => {})
    return { handled: true }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
  }
}

/**
 * result_edit の Gemini が「これは新データ取得が必要」と判定した場合の自動フロー。
 *
 * 1. editDraftWithGemini で draft (skeleton + 要件メタ) を更新
 * 2. upsertDraft で DB 反映
 * 3. generateReport でレポート再生成 (新バージョン)
 *
 * 各ステップで heartbeat を送ってユーザーに進捗を見せる。
 * 失敗時は error イベントで終了。
 */
async function runAutoRedraftAndRegenerate(args: {
  input: OrchestratorRunInput
  draft: import('./persistence/report-drafts').ReportDraftSnapshot
  draftInstruction: string
  chatHistoryContext: string
  startMs: number
  priorElapsedMs: number
  priorInputTokens: number
  priorOutputTokens: number
  editSummary: string
}): Promise<{ handled: boolean }> {
  const {
    input,
    draft,
    draftInstruction,
    chatHistoryContext,
    startMs,
    priorElapsedMs,
    priorInputTokens,
    priorOutputTokens,
    editSummary,
  } = args
  let totalInputTokens = priorInputTokens
  let totalOutputTokens = priorOutputTokens
  let totalGeminiMs = priorElapsedMs

  // 自動フロー全体で heartbeat を流し続ける (経過 30 秒級になるため)
  const heartbeat = setInterval(() => {
    input.onEvent({
      type: 'heartbeat',
      phase: 'streaming',
      label: 'ドラフト更新 + 再生成中... (Gemini)',
      elapsedMs: Date.now() - startMs,
      outputTokens: totalOutputTokens,
    })
  }, 5000)

  try {
    // === Step 1: draft_revise (skeleton + 要件メタ更新) ===
    if (!draft.skeletonMarkdown) {
      throw new Error('draft.skeletonMarkdown が空のため自動再生成できません')
    }
    input.onEvent({ type: 'status', status: 'ドラフトを更新中...' })
    const reviseResult = await editDraftWithGemini({
      currentSkeleton: draft.skeletonMarkdown,
      userInstruction: draftInstruction,
      requirements: {
        title: draft.title,
        goal: draft.goal,
        rangeStart: draft.rangeStart,
        rangeEnd: draft.rangeEnd,
        metricKeys: draft.metricKeys,
        outline: draft.outline,
        notes: draft.notes,
      },
      chatHistoryContext,
      abortSignal: input.abortSignal,
    })
    totalGeminiMs += reviseResult.metrics.elapsedMs
    totalInputTokens += reviseResult.metrics.inputTokens
    totalOutputTokens += reviseResult.metrics.outputTokens

    if (reviseResult.refused) {
      // draft 側が refused (取得不可指標を要求された) → 再生成は無理
      const msg =
        '指示に沿ったドラフト更新ができませんでした (取得不可指標が含まれている可能性):\n' +
        reviseResult.summary
      input.onEvent({ type: 'error', text: msg })
      return { handled: true }
    }

    // === Step 2: DB 反映 ===
    await upsertDraft({
      sessionId: input.sessionId,
      adminId: input.admin.id,
      skeletonMarkdown: reviseResult.updatedSkeleton,
      ...(reviseResult.updatedDataSources !== null
        ? { dataSources: reviseResult.updatedDataSources }
        : {}),
      ...(reviseResult.updatedMetricKeys !== null
        ? { metricKeys: reviseResult.updatedMetricKeys }
        : {}),
      ...(reviseResult.updatedOutline !== null ? { outline: reviseResult.updatedOutline } : {}),
      ...(reviseResult.updatedGoal !== null ? { goal: reviseResult.updatedGoal } : {}),
      ...(reviseResult.updatedTitle !== null ? { title: reviseResult.updatedTitle } : {}),
    })

    // === Step 3: レポート再生成 ===
    input.onEvent({ type: 'status', status: 'レポートを再生成中... (収集 + Gemini)' })
    const genResult = await generateReport({
      sessionId: input.sessionId,
      adminId: input.admin.id,
      abortSignal: input.abortSignal,
    })
    totalGeminiMs += genResult.totalMs
    totalInputTokens += genResult.inputTokens
    totalOutputTokens += genResult.outputTokens

    // === Step 4: チャットに自動再生成イベントを残す ===
    const eventText =
      '🔄 **新データ取得が必要だったため、ドラフトを更新して自動再生成しました**\n' +
      `- 元の修正指示: ${editSummary}\n` +
      `- ドラフト更新: ${reviseResult.summary}\n` +
      `- 再生成: 収集 ${genResult.collectedCount - genResult.collectedFailedCount}/${genResult.collectedCount} 件成功`
    input.onEvent({ type: 'text', text: eventText })

    const persisted = await appendMessage({
      sessionId: input.sessionId,
      role: 'assistant',
      content: eventText,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      model: reviseResult.metrics.model,
    })

    input.onEvent({
      type: 'usage',
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    input.onEvent({
      type: 'done',
      messageId: persisted.id,
      conversationId: input.sessionId,
    })

    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      messageId: persisted.id,
      eventType: 'chat_response',
      payload: {
        gemini_auto_redraft_regenerate: true,
        elapsed_ms: Date.now() - startMs,
        gemini_total_ms: totalGeminiMs,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        revise_summary: reviseResult.summary,
        regenerated_chars: genResult.resultMarkdown.length,
        synced_data_sources: reviseResult.updatedDataSources,
        synced_metric_keys: reviseResult.updatedMetricKeys,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    })

    console.log(
      `[advisor:gemini-bypass] auto-redraft+regen success session=${input.sessionId} ` +
        `total=${Date.now() - startMs}ms gemini=${totalGeminiMs}ms`
    )
    return { handled: true }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error(`[advisor:gemini-bypass] auto-redraft+regen failed: ${errMsg}`, e)

    const userVisibleError =
      'ドラフト更新 + 再生成に失敗しました。もう一度お試しください。\n' +
      `(エラー: ${errMsg.slice(0, 200)})`
    input.onEvent({ type: 'error', text: userVisibleError })

    await recordAudit({
      adminId: input.admin.id,
      sessionId: input.sessionId,
      eventType: 'error',
      payload: {
        gemini_auto_redraft_regenerate: true,
        gemini_failed: true,
        elapsed_ms: Date.now() - startMs,
        error: errMsg,
      },
      clientIp: input.clientIp,
      clientUa: input.clientUa,
    }).catch(() => {})
    return { handled: true }
  } finally {
    clearInterval(heartbeat)
  }
}
