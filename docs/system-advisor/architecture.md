# System Advisor アーキテクチャ設計書

## 1. 全体構成

```
┌─────────────────────────────────────────────────────────┐
│  ブラウザ (System Admin 画面)                              │
│  /system-admin/advisor                                    │
│  ┌────────────────────────────────────────────┐         │
│  │ AdvisorChatLayout (React Component)         │         │
│  │  - メッセージ表示 (ストリーミング)              │         │
│  │  - 入力欄                                    │         │
│  │  - セッション一覧サイドバー                     │         │
│  │  - ツール実行表示 (透明性)                     │         │
│  └────────────────────────────────────────────┘         │
└────────────────────────────┬────────────────────────────┘
                             │ fetch (SSE)
                             ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js API Route                                       │
│  /api/advisor/chat (POST, ReadableStream)                │
│  ┌────────────────────────────────────────────┐         │
│  │ 1. iron-session 認証チェック                  │         │
│  │ 2. レート制限・コスト上限チェック                │         │
│  │ 3. AdvisorOrchestrator 起動                  │         │
│  │ 4. SSE で chunk を返す                       │         │
│  └────────────────────────────────────────────┘         │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│  AdvisorOrchestrator (src/lib/advisor/orchestrator.ts)   │
│  ┌──────────────────────────────────────────┐           │
│  │ buildSystemPrompt()                       │           │
│  │  ← KnowledgeStore (CLAUDE.md 等)         │           │
│  │ loadConversationHistory()                 │           │
│  │  ← Prisma chat_messages                  │           │
│  │ runToolUseLoop()                          │           │
│  │   - Anthropic SDK messages.stream         │           │
│  │   - tools: ToolRegistry.list()            │           │
│  │   - tool_use → executeTool()              │           │
│  │   - tool_result を入れて再 stream          │           │
│  │ recordAuditLog()                          │           │
│  │ persistMessages()                         │           │
│  └──────────────────────────────────────────┘           │
└──────┬───────────────────┬─────────────┬───────────────┘
       │                   │             │
       ▼                   ▼             ▼
┌──────────────┐  ┌──────────────────┐  ┌───────────────┐
│ Knowledge    │  │  ToolRegistry     │  │  Anthropic    │
│ Store        │  │  (plugin式)       │  │  API          │
│              │  │                  │  │               │
│ - GitHub API │  │  core/           │  │ - Sonnet 4.5   │
│ - file cache │  │  tastas-data/    │  │ - Haiku        │
│ - cron 定期  │  │  external/       │  │ - prompt cache │
│   sync       │  │  (将来) lstep/   │  │               │
└──────────────┘  └──────────────────┘  └───────────────┘
       │                   │
       │                   ├─ 各ツールの実装は次の通り:
       │                   │
       │     ┌──────────────────────────────────────┐
       │     │ Core ツール (汎用・読み取り専用)         │
       │     │ - read_repo_file                     │
       │     │ - search_codebase (ripgrep)         │
       │     │ - read_doc                          │
       │     │ - get_recent_commits                │
       │     └──────────────────────────────────────┘
       │     ┌──────────────────────────────────────┐
       │     │ TASTAS Data ツール (DB 読み取り)        │
       │     │ - query_internal_db_metric           │
       │     │ - list_available_metrics             │
       │     │ - get_jobs_summary                   │
       │     │ - get_users_summary                  │
       │     └──────────────────────────────────────┘
       │     ┌──────────────────────────────────────┐
       │     │ External ツール                       │
       │     │ - query_ga4 (既存ga-client.ts活用)   │
       │     │ - get_vercel_logs                    │
       │     │ - get_supabase_logs                  │
       │     │ - web_search (Tavily等、後付け可)     │
       │     └──────────────────────────────────────┘
       │     ┌──────────────────────────────────────┐
       │     │ 将来追加 (空の registry スロット)       │
       │     │ - query_lstep_events  (Phase外)     │
       │     │ - query_line_friends  (Phase外)     │
       │     │ - query_search_console (Phase外)    │
       │     └──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Persistence (Prisma + PostgreSQL)                        │
│  - AdvisorChatSession                                     │
│  - AdvisorChatMessage                                     │
│  - AdvisorAuditLog                                        │
│  - AdvisorKnowledgeCache                                  │
│  - AdvisorUsageDaily (コスト管理)                          │
└──────────────────────────────────────────────────────────┘
```

## 2. ディレクトリ構成 (新規追加分)

```
src/
├── components/
│   └── advisor/                       # UI コンポーネント (legacy から流用)
│       ├── chat-layout.tsx
│       ├── chat-input.tsx
│       ├── chat-message.tsx
│       ├── thinking-indicator.tsx
│       ├── tool-call-display.tsx     # 新規: ツール実行の透明性
│       └── session-sidebar.tsx
├── lib/
│   └── advisor/
│       ├── orchestrator.ts            # メインループ
│       ├── claude.ts                  # Anthropic SDK ラッパー
│       ├── prompt-cache.ts            # cache_control 設定
│       ├── system-prompt.ts           # システムプロンプト構築
│       ├── knowledge/
│       │   ├── store.ts               # 知識ストア IF
│       │   ├── github-source.ts       # GitHub API 経由取得
│       │   └── sync.ts                # cron 用同期処理
│       ├── tools/
│       │   ├── registry.ts            # ツール登録
│       │   ├── types.ts               # AdvisorTool IF 定義
│       │   ├── core/
│       │   │   ├── read-repo-file.ts
│       │   │   ├── search-codebase.ts
│       │   │   ├── read-doc.ts
│       │   │   └── get-recent-commits.ts
│       │   ├── tastas-data/
│       │   │   ├── list-available-metrics.ts
│       │   │   ├── query-metric.ts
│       │   │   ├── get-jobs-summary.ts
│       │   │   └── get-users-summary.ts
│       │   └── external/
│       │       ├── query-ga4.ts
│       │       ├── get-vercel-logs.ts
│       │       └── get-supabase-logs.ts
│       ├── persistence/
│       │   ├── sessions.ts            # session の CRUD (Server Actions)
│       │   ├── messages.ts
│       │   └── audit.ts
│       ├── auth.ts                    # iron-session ガード
│       ├── rate-limit.ts              # ユーザー別レート制限
│       ├── cost-guard.ts              # コスト上限
│       └── jst.ts                     # JST ヘルパー (既存ヘルパー利用)
├── app/
│   ├── system-admin/
│   │   └── advisor/                   # 画面
│   │       ├── page.tsx               # サーバーコンポーネント (認証ガード)
│   │       ├── layout.tsx             # システム管理レイアウト適用
│   │       └── loading.tsx
│   └── api/
│       ├── advisor/
│       │   └── chat/
│       │       └── route.ts           # SSE ストリーミング
│       └── cron/
│           └── advisor-knowledge-sync/
│               └── route.ts           # 定期 GitHub 同期
docs/
└── system-advisor/                    # 本設計ドキュメント群
```

## 3. 処理フロー

### 3.1 通常の質問フロー (Tool Use ループ)

```
[User] 「先週のLP3のCV率は?」
  │
  ├─ POST /api/advisor/chat
  │  body: { sessionId, message }
  │
  ▼
[Server: API Route]
  ├─ 認証 (iron-session)
  ├─ rate limit check
  ├─ cost cap check
  │
  ▼
[Server: Orchestrator.run()]
  ├─ systemPrompt を構築 (CLAUDE.md, docs, MetricDefs を含む)
  ├─ 過去メッセージ取得 (最大 N 件、それ以前は要約)
  ├─ Anthropic API messages.stream を呼ぶ
  │  - tools: ToolRegistry.list()
  │  - cache_control 設定
  │
  ▼
[Anthropic レスポンス]
  ├─ assistant: text "確認します..."
  ├─ assistant: tool_use { name: "list_available_metrics", input: {} }
  │  → SSE で UI に送信 (ツール呼び出し表示)
  │  → executeTool() で実行
  │  → result: ["LP閲覧数", "応募クリック数", ...]
  │  → tool_result を会話履歴に追加して再 stream
  │
  ├─ assistant: text "MetricDefinitions に基づいて..."
  ├─ assistant: tool_use { name: "query_metric", input: { metric: "LP_CV_RATE", lpId: 3, startDate: "2026-04-24", endDate: "2026-04-30" } }
  │  → executeTool() で実行
  │  → result: { rate: 0.034, samples: 12 }
  │  → tool_result を会話履歴に追加して再 stream
  │
  ├─ assistant: text "LP3 の先週のCV率は3.4%でした..." (final)
  │  → SSE で UI に送信
  │
  ▼
[Server: 終了処理]
  ├─ chat_messages に user + assistant + tool calls を保存
  ├─ audit_logs に記録 (誰が何を聞いたか、どのツールを使ったか、トークン使用量)
  └─ usage_daily を加算
  │
  ▼
[Browser]
  ├─ メッセージ追加表示
  └─ 入力欄を再アクティブ化
```

### 3.2 知識同期フロー (cron + 起動時)

```
[Vercel Cron - 1時間ごと]
  ├─ GET /api/cron/advisor-knowledge-sync
  │
  ▼
[Server]
  ├─ 対象ファイルリスト:
  │   - CLAUDE.md
  │   - docs/requirements.md
  │   - docs/system-design.md
  │   - docs/screen-specification.md
  │   - prisma/schema.prisma
  │   - app/system-admin/analytics/tabs/MetricDefinitions.tsx
  │
  ├─ GitHub API 経由で最新版取得
  │   - GET /repos/{owner}/{repo}/contents/{path}?ref=main
  │   - Authorization: Bearer ${GITHUB_TOKEN_FOR_ADVISOR}
  │
  ├─ ファイルごとに sha256 ハッシュ計算
  ├─ AdvisorKnowledgeCache テーブルと比較
  │   - 変化があれば content と hash を更新
  │   - last_synced_at を更新
  │
  └─ 変更があったファイルをログに記録 (advisor_knowledge_sync_logs)


[Advisor チャット起動時]
  ├─ AdvisorKnowledgeCache から最新を取得
  ├─ システムプロンプトに組み込み
  └─ prompt cache の cache_control を設定 (内容ハッシュをキーに)
```

### 3.3 セッション管理とコンテキスト圧縮

```
[セッション継続]
  ├─ chat_messages から sessionId のメッセージを取得
  ├─ token 数を概算 (簡易計算 or tiktoken)
  ├─ 80K トークン超 (Sonnet 200K の 40%) で圧縮発動
  │
  ▼
[圧縮処理]
  ├─ 直近 10 ターンは無圧縮維持
  ├─ それより古いメッセージを Haiku に渡して要約
  ├─ session.context_summary を更新
  ├─ 古いメッセージは is_compacted=true でマーク (削除はしない、監査用)
  │
  ▼
[再構築]
  ├─ system + context_summary + 直近10ターン + 新しいメッセージ
  └─ Anthropic API 呼び出し
```

## 4. 主要モジュールの責務

### orchestrator.ts
- システムプロンプト構築 → 履歴ロード → Tool Use ループ → 永続化 を統括
- ストリーミングは `messages.stream()` を使い、tool_use_block ごとに UI に通知

### tools/registry.ts
- Map<toolName, AdvisorTool> を管理
- `register(tool)` / `getAll()` / `execute(name, input)` を提供
- 各ツールカテゴリ (core/tastas-data/external) からの import を集約
- 将来追加: `register(lstepTool)` のような1行追加で有効化

### tools/types.ts
```ts
export interface AdvisorTool {
  name: string;                            // tool 名
  description: string;                     // LLM 向け説明 (重要)
  category: 'core' | 'tastas-data' | 'external';
  inputSchema: object;                     // JSON Schema
  outputDescription?: string;              // 結果の構造説明
  available: () => Promise<{
    ready: boolean;
    reason?: string;                       // 「LINE Webhook未実装」等
    plannedFrom?: string;
  }>;
  execute: (input: any, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  adminId: number;
  sessionId: string;
  // 監査ログ・タイムアウト・キャンセル等
}

export type ToolResult =
  | { ok: true; data: any; metadata?: { tookMs: number; truncated?: boolean } }
  | { ok: false; error: string; userActionable?: string };
```

### knowledge/github-source.ts
- GitHub Contents API ラッパー
- レート制限考慮 (5000/h with token)
- ファイル取得は base64 デコード必要

### knowledge/sync.ts
- cron 用エンドポイントのコア実装
- 全対象ファイルを並列取得
- ハッシュ比較 → 変更があるもののみ DB 更新

### auth.ts
- 既存の `lib/system-admin-session-server.ts` を再利用
- API Route で `getSystemAdminServerSession()` を呼び、`isLoggedIn === true` をチェック
- 不一致は 401 を返す

### rate-limit.ts
- adminId × 1時間 で N 件まで
- adminId × 1日 で M 件まで
- DB ベース (Redis なし、`AdvisorChatMessage.created_at` を集計)

### cost-guard.ts
- `AdvisorUsageDaily` で adminId × 日付ごとに使用トークン累計
- 1日のキャップを超えたら 429 を返す
- 全体キャップ (環境変数で設定) も併用

## 5. データソース統合と将来拡張

### 現在のデータソース
| ソース | アクセス方法 | 備考 |
|-------|-------------|------|
| TASTAS DB | Prisma (読み取り専用) | アプリ層で write 系 Prisma メソッドを呼ばない |
| Prismaスキーマ | KnowledgeCache 経由 | 起動時注入 |
| CLAUDE.md / docs | KnowledgeCache 経由 | 同上 |
| GA4 | 既存の `src/lib/ga-client.ts` | ツール化のみ |
| Vercel ログ | Vercel REST API | `VERCEL_API_TOKEN` 環境変数 |
| Supabase ログ | Supabase Management API | `SUPABASE_MANAGEMENT_TOKEN` 環境変数 |

### 将来追加 (拡張時の手順例: Lstep)
1. `src/lib/advisor/tools/external/query-lstep.ts` 新規作成 (~50行)
2. `src/lib/advisor/tools/registry.ts` に1行追加
3. (必要なら) Prismaに `LstepEvent` テーブル追加
4. (必要なら) `/api/lstep/webhook` 実装

→ Advisor 本体・UI・API は一切変更不要。

## 6. ストリーミング仕様

API Route は SSE (Server-Sent Events) として下記イベントを送信:

```
event: text
data: {"text": "確認します..."}

event: tool_use
data: {"name": "list_available_metrics", "input": {}, "id": "toolu_01..."}

event: tool_result
data: {"id": "toolu_01...", "ok": true, "summary": "5指標取得"}

event: text
data: {"text": "MetricDefinitions に基づいて..."}

event: usage
data: {"inputTokens": 12000, "outputTokens": 320, "cacheReadTokens": 8000}

event: done
data: {"messageId": "msg_..."}
```

## 7. エラーハンドリング

| ケース | 挙動 |
|--------|------|
| 認証失敗 | 401 即返却 |
| レート制限超過 | 429 + 残時間表示 |
| コスト上限超過 | 429 + 管理者へのアラート |
| ツール実行エラー | LLM に tool_result として error を返し、続行させる (自己修正) |
| Anthropic API エラー | リトライ最大2回、それでも失敗ならユーザーにエラー表示 |
| ネットワーク中断 (SSE) | クライアント側で再接続 (5秒バックオフ) |
| 知識同期失敗 | 古いキャッシュで動作継続、Sentry / アラート通知 |

## 8. テスト戦略

| レイヤー | テスト方法 |
|---------|----------|
| ツール単体 | 各ツールの `execute()` を Jest でテスト |
| Orchestrator | mock Anthropic で tool use ループの動作確認 |
| API Route | curl でストリーミング動作確認 (user-checklist.md 参照) |
| UI | ローカル開発で手動確認 |

## 9. 監視・運用

- 監査ログ: 全ての質問・ツール呼び出しを `AdvisorAuditLog` に記録
- コスト監視: `AdvisorUsageDaily` を System Admin の専用ページで表示 (Phase 外)
- 異常検知: rate limit 抵触・上限到達は SystemNotification 経由で管理者に通知

## 10. セッション・コンテキスト圧縮の同等性 (Claude Code 比較)

| 機能 | Claude Code | 本実装 |
|------|-------------|--------|
| 200K context | ◎ | ◎ (同じモデル) |
| prompt caching | ◎ 自動 | ◎ 明示制御 |
| 自動圧縮 | ◎ | ◎ (Haiku で要約) |
| セッション再開 | resume | ◎ DB 永続化 |
| メモリ | MEMORY.md | ◎ DB 構造化 |
| 検索性 | ファイル grep | ◎ DB 全文検索可能 |

→ 「Claude Code と同レベル」を満たし、永続化・検索性で上回る。
