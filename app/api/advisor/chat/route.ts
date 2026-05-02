/**
 * Advisor Chat API (legacy 互換ストリーミング)
 *
 * legacy `_legacy_agent-hub/components/chat/chat-layout.tsx` の fetch 仕様に従う:
 *
 * 入力 (JSON):
 *   POST /api/advisor/chat
 *   body: {
 *     message: string,
 *     conversationId: string | null,   // null なら新規作成
 *     projectIds?: string[],            // Advisor では未使用
 *     modelId?: string,
 *     files?: Array<{ name, mimeType, base64 }>
 *   }
 *
 * 出力 (text/event-stream, "data: " プレフィックスのみ):
 *   data: {"type":"status","status":"..."}
 *   data: {"type":"text","text":"..."}
 *   data: {"type":"done","conversationId":"..."}
 *   data: {"type":"error","text":"..."}
 *
 * 認証: System Admin セッション必須
 */

import { NextResponse } from 'next/server';
import { requireAdvisorAuth, isAdvisorEnabled } from '@/src/lib/advisor/auth';
import { checkRateLimit } from '@/src/lib/advisor/rate-limit';
import { checkCostCap } from '@/src/lib/advisor/cost-guard';
import { runOrchestrator, type AdvisorStreamEvent } from '@/src/lib/advisor/orchestrator';
import { recordAudit } from '@/src/lib/advisor/persistence/audit';
import { stripToolHintPrefix } from '@/src/lib/advisor/message-display';
import { prisma } from '@/lib/prisma';
import { ADVISOR_MODELS } from '@/src/lib/advisor/claude';
import { AVAILABLE_MODELS } from '@/src/lib/advisor/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_INPUT_CHARS = parseInt(process.env.ADVISOR_MAX_INPUT_CHARS ?? '') || 10_000;

interface ChatRequestBody {
  message?: string;
  conversationId?: string | null;
  /** legacy フィールド (Advisor では未使用) */
  projectIds?: string[];
  modelId?: string;
  /** 添付ファイル (画像/動画/PDF) — base64 エンコード済み */
  files?: Array<{ name: string; mimeType: string; base64: string }>;
}

/**
 * SSE フォーマット ("data: {...}\n\n") で1イベント送出。
 * 末尾の空行 (\n\n) は SSE 仕様上必須。これがないとブラウザ/プロキシ層の
 * バッファに溜まって flush が遅延し、UI が "止まったように見える" 不具合が起きる。
 */
function formatLine(event: AdvisorStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  if (!isAdvisorEnabled()) {
    return NextResponse.json({ error: 'Advisor は現在無効化されています' }, { status: 503 });
  }

  // 1. 認証
  let auth;
  try {
    auth = await requireAdvisorAuth();
  } catch {
    return NextResponse.json({ error: 'システム管理者認証が必要です' }, { status: 401 });
  }

  // 2. body パース
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const message = (body.message ?? '').trim();
  if (!message && (!body.files || body.files.length === 0)) {
    return NextResponse.json({ error: 'message または files が必要です' }, { status: 400 });
  }
  if (message.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `メッセージが長すぎます (最大 ${MAX_INPUT_CHARS} 文字)` },
      { status: 400 }
    );
  }

  // 3. セッション解決 (新規 or 既存)
  let sessionId = body.conversationId ?? '';
  let isNewSession = false;
  // タイトル / 履歴に表示する用に [TOOL:xxx] hidden hint は剥がす
  const messageForDisplay = stripToolHintPrefix(message);
  if (!sessionId) {
    const newSession = await prisma.advisorChatSession.create({
      data: {
        admin_id: auth.adminId,
        title: messageForDisplay.slice(0, 60) || '新しい会話',
      },
    });
    sessionId = newSession.id;
    isNewSession = true;
  } else {
    // 所有権チェック
    const owned = await prisma.advisorChatSession.findFirst({
      where: { id: sessionId, admin_id: auth.adminId },
      select: { id: true, title: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }
    // タイトルが「新しい会話」のまま、最初のメッセージで自動命名
    if (owned.title === '新しい会話' && messageForDisplay) {
      await prisma.advisorChatSession.update({
        where: { id: sessionId },
        data: { title: messageForDisplay.slice(0, 60) },
      });
    }
  }

  // 4. レート制限
  const rl = await checkRateLimit(auth.adminId);
  if (!rl.allowed) {
    await recordAudit({
      adminId: auth.adminId,
      sessionId,
      eventType: 'rate_limit_hit',
      payload: { reason: rl.reason ?? 'unknown', hourCount: rl.hourCount, dayCount: rl.dayCount },
    });
    return NextResponse.json(
      { error: rl.reason, retryAfterSec: rl.retryAfterSec },
      {
        status: 429,
        headers: rl.retryAfterSec ? { 'Retry-After': String(rl.retryAfterSec) } : {},
      }
    );
  }

  // 5. コスト上限
  const cc = await checkCostCap({ adminId: auth.adminId, estimatedInputTokens: 5000 });
  if (!cc.allowed) {
    await recordAudit({
      adminId: auth.adminId,
      sessionId,
      eventType: 'cost_cap_hit',
      payload: { usedToday: cc.usedToday, cap: cc.cap, reason: cc.reason ?? '' },
    });
    return NextResponse.json({ error: cc.reason }, { status: 429 });
  }

  // 6. ストリーミング応答
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const clientUa = req.headers.get('user-agent') ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // controller.close() 後の enqueue は ERR_INVALID_STATE で throw する。
      // クライアント Abort や Anthropic 100 秒タイムアウト後に
      // orchestrator の遅延処理 (heartbeat / audit / done) が走るとこの状況になりがち。
      // 致命ではないので closed フラグを立てて黙って捨てる (ログを汚さない)。
      let streamClosed = false;
      const send = (event: AdvisorStreamEvent) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(formatLine(event)));
        } catch (e) {
          // 一度失敗したら以降はもう呼ばない
          streamClosed = true;
          // 起動初期 (まだ確実に open のはず) の失敗だけログに残す
          if (!(e instanceof TypeError && /already closed/i.test(String(e)))) {
            console.error('[advisor] SSE enqueue failed:', e);
          }
        }
      };

      // 新規セッション作成を即座に UI へ通知
      if (isNewSession) {
        send({ type: 'status', status: 'セッション作成中...' });
      }

      // クライアント送信の modelId を Anthropic 実モデル ID に解決。
      //
      // クライアント (ChatInput) は AVAILABLE_MODELS の id (= 多くの場合 alias と同じ
      // "claude-sonnet-4-6" / "claude-haiku-4-5" 等) を送ってくる。
      // 旧クライアントは "claude-sonnet" / "claude-opus" / "claude-haiku" のような
      // 短縮 id を送ってくる可能性があるので、それも AVAILABLE_MODELS で正引きする。
      // どちらでもなければ「Anthropic 実 ID を直接渡してきた」とみなして素通し
      // (orchestrator の migrateModelIfRetiring が retire 予定モデルなら後継に置換する)。
      let activeModel: string = ADVISOR_MODELS.sonnet;
      if (body.modelId) {
        const matched = AVAILABLE_MODELS.find((m) => m.id === body.modelId);
        if (matched) {
          activeModel = matched.modelId;
        } else {
          // 未知の id = Anthropic 実 ID 直指定として扱う (例: "claude-sonnet-4-6")。
          // 万一存在しない ID を送られても Anthropic 側で 404 が返るので最終防衛は API 側に任せる。
          activeModel = body.modelId;
        }
      }

      try {
        await runOrchestrator({
          admin: { id: auth.adminId, name: auth.name, role: auth.role },
          sessionId,
          userMessage: message,
          attachments: body.files,
          modelId: activeModel,
          onEvent: send,
          abortSignal: req.signal,
          clientIp,
          clientUa,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        send({ type: 'error', text: errMsg });
        await recordAudit({
          adminId: auth.adminId,
          sessionId,
          eventType: 'error',
          payload: { error: errMsg },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Vercel/Nginx などのプロキシ層でのバッファリングを抑止 (SSE が遅延する典型的原因)
      'X-Accel-Buffering': 'no',
    },
  });
}
