# System Advisor アーキテクチャ設計書

**最終更新**: 2026-05-04 — Canvas / Gemini バイパス / 共有 URL / しおり / 保持期間 cron まで反映

> 詳細な「**チャットからレポート完成までの一連の流れ**」は [REPORT_FEATURE.md](./REPORT_FEATURE.md) に集約。
> 本ドキュメントは「**全体構成と責務分担**」を俯瞰する位置づけ。

---

## 1. 全体構成

```
┌────────────────────────────────────────────────────────────────────┐
│  ブラウザ (System Admin 画面)                                          │
│  /system-admin/advisor                                               │
│  ┌──────────────────────────────┐ ┌─────────────────────────────┐  │
│  │ 左: チャット欄 + 履歴サイドバー    │ │ 右: ReportCanvas (角丸カード)  │  │
│  │ - SSE ストリーミング受信          │ │ - ドラフト要件 + skeleton    │  │
│  │ - tool_use の透明性表示          │ │ - レポート本文 (vN タブ)      │  │
│  │ - 進捗 heartbeat (経過秒/トークン) │ │ - 共有 URL / しおり / 編集   │  │
│  │ - ツール選択 + プリフィル         │ │ - 2 秒間隔ポーリング          │  │
│  └──────────────────────────────┘ └─────────────────────────────┘  │
└────────────────────────────┬───────────────────────────────────────┘
                             │ POST /api/advisor/chat (SSE)
                             │ Server Actions (getDraft / updateDraft / toggleBookmark / enableShare / extendShare)
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  Next.js App Router                                                  │
│  ┌────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ /api/advisor/chat   │  │ Server Actions (src/lib/advisor/actions/)│ │
│  │ → SSE stream         │  │ - conversations / report-drafts /       │ │
│  │ → orchestrator       │  │   report-versions / settings /          │ │
│  │                     │  │   saved-prompts                          │ │
│  └──────────┬──────────┘  └────────────────────────────────────────┘ │
│             │              ┌────────────────────────────────────────┐ │
│             │              │ /api/advisor/report/generate            │ │
│             │              │ → Gemini で本文生成 (15-30 秒)          │ │
│             │              └─────────────────┬───────────────────────┘ │
└─────────────┼──────────────────────────────────┼───────────────────────┘
              │                                  │
              ▼                                  ▼
┌─────────────────────────────┐   ┌──────────────────────────────────────┐
│ AdvisorOrchestrator          │   │ Reports Pipeline                      │
│ (orchestrator.ts)            │   │ (reports/collect.ts + generate.ts)    │
│                              │   │                                       │
│ ┌─ 入力先頭の hidden hint ─┐ │   │ ┌─ collectReportData ───────────────┐ │
│ │ [TOOL:report_create]    │ │   │ │ data_sources を並列展開           │ │
│ │ → Gemini バイパス         │ │   │ │ query_metric × supportedGroupBy   │ │
│ │ [TOOL:draft_revise]     │ │   │ │ query_ga4 × 5 種                   │ │
│ │ → Gemini バイパス         │ │   │ │ query_search_console × 4 種        │ │
│ │ [TOOL:result_edit]      │ │   │ │ Vercel / Supabase ログ等           │ │
│ │ → Gemini バイパス         │ │   │ └───────────────────────────────────┘ │
│ │ それ以外 → Anthropic     │ │   │ ┌─ Gemini 2.5 Flash ────────────────┐ │
│ └─────────────────────────┘ │   │ │ skeleton + 元要望 + 収集 JSON      │ │
│                              │   │ │ → 構造化 Markdown 本文             │ │
│ ┌─ Anthropic Tool Use ────┐ │   │ │ → AdvisorReportVersion 保存        │ │
│ │ messages.stream         │ │   │ └───────────────────────────────────┘ │
│ │ tools: registry の 17 個 │ │   └──────────────────────────────────────┘
│ │ tool_use → execute →    │ │
│ │ tool_result で再 stream │ │
│ └─────────────────────────┘ │
└──────────┬───────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ToolRegistry (tools/registry.ts) — 17 個のツール                      │
│ ┌── Core (5) ─────────────────────────────────────────────────────┐ │
│ │ read_repo_file / search_codebase / read_doc /                    │ │
│ │ get_recent_commits / list_directory                              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌── TASTAS Data (5) ──────────────────────────────────────────────┐ │
│ │ query_metric (本番 Supabase READ ONLY) /                          │ │
│ │ get_jobs_summary / get_users_summary / get_recent_errors /       │ │
│ │ describe_db_table                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌── External (5) ─────────────────────────────────────────────────┐ │
│ │ query_ga4 / query_search_console /                               │ │
│ │ get_supabase_logs / get_vercel_logs / get_vercel_deployments     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌── Future (2 - placeholder, available=false) ────────────────────┐ │
│ │ query_lstep_events / query_line_friends                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌── Reports (2) ──────────────────────────────────────────────────┐ │
│ │ update_report_draft / edit_report_section                        │ │
│ │ (※ get_report_draft, list_available_metrics は廃止)              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
           │
           ├─ Anthropic API (Claude Sonnet 4.6 / Opus / Haiku)
           ├─ Gemini API (gemini-2.5-flash) ← 重い処理を全部こちら
           ├─ GitHub Contents API (KnowledgeCache 同期)
           ├─ GA4 Data API
           ├─ Search Console API
           ├─ Supabase Management API
           ├─ Vercel REST API
           └─ 本番 Supabase (advisor_readonly ロール、READ ONLY tx)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Persistence (Prisma + PostgreSQL — Advisor 自身のテーブルのみ書き込み)  │
│ AdvisorChatSession / AdvisorChatMessage / AdvisorAuditLog /          │
│ AdvisorKnowledgeCache / AdvisorKnowledgeSyncLog / AdvisorSavedPrompt │
│ AdvisorUsageDaily / AdvisorReportDraft / AdvisorReportVersion /      │
│ AdvisorSettings                                                      │
└─────────────────────────────────────────────────────────────────────┘

公開シェア (認証なし)                  Cron (Vercel Cron)
────────────────────────────         ──────────────────────────────────
/advisor/r/[token]                    /api/cron/advisor-knowledge-sync
 → AdvisorReportVersion                 (毎時 / 知識ベース同期)
   .share_token + shared_until
   で表示判定                          /api/cron/advisor-cleanup
                                        (毎日 04:00 JST)
                                        - しおりなし Draft/Versions 30 日 cleanup
                                        - Audit ログ 90 日 / report 系 180 日
                                        - 失効済み share_token 掃除
```

---

## 2. ディレクトリ構成

```
src/
├── components/advisor/
│   ├── chat/
│   │   ├── chat-layout.tsx            # 最大 (~1700 行): サイドバー + チャット + Canvas 統合
│   │   ├── chat-input.tsx             # ツール選択 + プリフィル (forcedTool 連動)
│   │   ├── unified-message.tsx        # メッセージレンダラ
│   │   └── markdown-table.tsx
│   ├── report/
│   │   └── report-canvas.tsx          # 最重要 (~1700 行): ヘッダー + 編集 + 共有 + しおり
│   ├── history/
│   │   └── history-client.tsx
│   └── reports/
│       ├── reports-list.tsx           # 全バージョン横断一覧
│       └── report-detail.tsx
├── lib/advisor/
│   ├── orchestrator.ts                # メインループ (Anthropic + Gemini バイパス)
│   ├── claude.ts                      # Anthropic SDK ラッパー
│   ├── prompt-cache.ts                # cache_control 設定
│   ├── system-prompt.ts               # cachedPart + dynamicPart 構築 (ドラフト埋め込み)
│   ├── models.ts                      # モデル alias 定義
│   ├── auth.ts                        # iron-session ガード
│   ├── rate-limit.ts                  # adminId × hour/day
│   ├── cost-guard.ts                  # AdvisorUsageDaily 加算
│   ├── jst.ts                         # JST ヘルパー
│   ├── llm-stream.ts                  # SSE 整形ユーティリティ
│   ├── message-display.ts             # [TOOL:xxx] 剥がし
│   ├── tool-source-labels.ts          # ツールキー ↔ 日本語ラベル統一表
│   ├── agent-icons.tsx
│   ├── db.ts                          # advisorDataPrisma (本番 Supabase 読取専用)
│   ├── llm/                           # Gemini 直叩きバイパス群
│   │   ├── gemini.ts                  # @google/genai 薄ラッパー (gemini-2.5-flash)
│   │   ├── gemini-draft-create.ts     # [TOOL:report_create] バイパス
│   │   ├── gemini-edit.ts             # [TOOL:draft_revise] バイパス
│   │   ├── gemini-result-edit.ts      # [TOOL:result_edit] バイパス
│   │   ├── chat-history-context.ts    # 直近履歴を Gemini に渡す
│   │   └── data-source-capabilities.ts
│   ├── knowledge/
│   │   ├── store.ts                   # 知識ストア IF
│   │   ├── github-source.ts           # GitHub Contents API
│   │   └── sync.ts                    # cron 用同期処理
│   ├── tools/
│   │   ├── registry.ts                # ツール登録 (17 個)
│   │   ├── types.ts                   # AdvisorTool IF 定義
│   │   ├── core/                      # 5 個 (read_repo_file 他)
│   │   ├── tastas-data/               # 5 個 (query_metric 他)
│   │   ├── external/                  # 5 個 (query_ga4 他)
│   │   ├── future/                    # 2 個 (placeholder)
│   │   └── reports/                   # 2 個 (update_report_draft / edit_report_section)
│   ├── persistence/
│   │   ├── sessions.ts
│   │   ├── messages.ts
│   │   ├── audit.ts
│   │   ├── settings.ts
│   │   ├── report-drafts.ts
│   │   └── report-versions.ts          # share_token 発行 / 期限管理
│   ├── actions/                       # Server Actions (use server)
│   │   ├── conversations.ts            # toggleBookmark 等
│   │   ├── report-drafts.ts
│   │   ├── report-versions.ts          # enableShare / extendShare / disableShare
│   │   ├── settings.ts
│   │   ├── saved-prompts.ts
│   │   ├── custom-agents.ts
│   │   └── pending-actions.ts
│   └── reports/
│       ├── collect.ts                  # data_sources 並列収集 + groupBy 全展開
│       └── generate.ts                 # Gemini レポート生成本体
└── app/
    ├── system-admin/advisor/
    │   ├── page.tsx                   # メイン (チャット + Canvas)
    │   ├── loading.tsx
    │   ├── settings/page.tsx          # 設定ページ
    │   ├── history/page.tsx           # チャット履歴一覧
    │   └── reports/
    │       ├── page.tsx               # 全バージョン一覧
    │       └── [versionId]/page.tsx   # バージョン詳細
    ├── advisor/r/[token]/page.tsx     # 公開シェアページ (認証なし)
    └── api/
        ├── advisor/
        │   ├── chat/route.ts          # SSE ストリーミング
        │   └── report/generate/route.ts
        └── cron/
            ├── advisor-knowledge-sync/route.ts
            └── advisor-cleanup/route.ts
```

---

## 3. 処理フロー

### 3.1 通常チャット (Anthropic Tool Use ループ)

```
[User] 「先週公開された求人は何件?」
  │ POST /api/advisor/chat (sessionId, message)
  ▼
[API Route]
  ├─ iron-session 認証 (System Admin)
  ├─ rate limit / cost cap チェック
  ├─ AdvisorOrchestrator.run() 起動 → SSE で逐次返却
  ▼
[Orchestrator: loop=0]
  ├─ buildSystemPrompt() → cachedPart + dynamicPart
  │   - cachedPart: 役割 / METRIC_CATALOG / プロジェクト知識 (5 分 ephemeral cache)
  │   - dynamicPart: セッション情報 + 現在のレポートドラフト全体 (あれば)
  ├─ 履歴ロード (最大 N 件)
  ├─ Anthropic messages.stream (tools: registry の 17 個)
  ▼
[Anthropic レスポンス]
  ├─ assistant: "確認します..." (text → SSE)
  ├─ assistant: tool_use { name: "query_metric", input: {...} }
  │   → executeToolByName() 実行
  │   → 結果を tool_result として履歴に追加
  ▼
[Orchestrator: loop=1]
  ├─ Anthropic 再 stream (tool_result 込み)
  ├─ assistant: "先週は 12 件公開されました..." (final text)
  ▼
[終了処理]
  ├─ persistMessages() — user / assistant / tool calls を DB 保存
  ├─ recordAudit() — 監査ログ
  ├─ incrementUsage() — AdvisorUsageDaily 加算
  └─ SSE done イベント送信
```

### 3.2 レポート系チャット (Gemini バイパス)

ユーザー入力先頭の `[TOOL:xxx]` hidden hint で分岐。Anthropic loop=1 の TTFB 100 秒問題を回避するため、**重い処理は全部 Gemini 直叩き**。

| hint | バイパス先 | 用途 | 所要 |
|---|---|---|---|
| `[TOOL:report_create]` | `createDraftWithGemini()` | 初回ドラフト作成 (要件 + skeleton 一括生成) | 9 秒前後 |
| `[TOOL:draft_revise]` | `editDraftWithGemini()` | ドラフト修正 (skeleton 書き換え) | 4〜10 秒 |
| `[TOOL:result_edit]` | `editResultWithGemini()` | 生成済みレポートの部分修正 | 5〜10 秒 |

```
[User] 「ツール ▼ → レポート作成」 + 「先週の UU PV TOP10、データソースは提案して」
  │ ChatInput が先頭に [TOOL:report_create] を付与
  ▼
[Orchestrator]
  ├─ trimmed.startsWith('[TOOL:report_create]') を検出
  ├─ createDraftWithGemini() に委譲
  │   - hint を剥がしてユーザー要望のみを渡す
  │   - Gemini 2.5 Flash で要件 (title/goal/range/data_sources/metric_keys/outline/notes/skeleton_markdown) 一括生成
  │   - upsertDraft() で AdvisorReportDraft に保存 (original_request も同時保存)
  │   - 「📋 Canvas にレポートドラフトを作成しました...」を assistant メッセージとして DB 保存
  │   - SSE で text + done を返す
  ▼
[Canvas (右ペイン)]
  ├─ 2 秒間隔ポーリング (getDraftForSession) で更新検知
  └─ skeleton_markdown を Markdown レンダリング、要件は折りたたみで表示
```

`[TOOL:result_edit]` 経由で「○○の表を追加」のような **新データが必要な指示** を受けた場合、
Gemini が `redirect_to_draft=true + draft_instruction` を返し、orchestrator が裏で
`editDraftWithGemini → upsertDraft → generateReport` を連続実行 (auto-redraft, 40 秒前後)。

### 3.3 レポート本文生成 (`POST /api/advisor/report/generate`)

```
[User] Canvas フッターの「レポート作成 (本文生成)」押下
  │ POST /api/advisor/report/generate { sessionId }
  ▼
[Server: generate.ts]
  1. AdvisorReportDraft を読む
  2. status = 'generating' に更新
  3. collectReportData() — 並列にデータ収集
     - query_metric × supportedGroupBy 全展開
     - query_ga4 × 5 種 (overview / traffic / pages / lpPerformance / comparison)
     - query_search_console × 4 種 ([query] / [page] / [device] / [country])
     - get_supabase_logs / get_vercel_logs / etc.
  4. buildUserPrompt() — 要件 + original_request + skeleton + 収集 JSON (50KB cap)
  5. Gemini 2.5 Flash で本文生成 (15-30 秒)
  6. createReportVersion() で AdvisorReportVersion (vN+1) として保存
  7. status = 'completed' / generated_at / generation_count++
  ▼
[Canvas]
  ├─ ポーリングで完了検知 → 「ドラフト / レポート (vN)」タブが現れる
  └─ レポートタブを自動表示 (生成直後のみ)
```

詳細は [REPORT_FEATURE.md](./REPORT_FEATURE.md) を参照。

### 3.4 知識同期 cron (`/api/cron/advisor-knowledge-sync`)

```
[Vercel Cron - 毎時 0 分 (※ vercel.json に登録があるか要確認)]
  │ GET /api/cron/advisor-knowledge-sync
  │ Authorization: Bearer ${ADVISOR_CRON_SECRET}
  ▼
[Server: knowledge/sync.ts]
  ├─ 対象ファイル (CLAUDE.md / docs/* / prisma/schema.prisma / MetricDefinitions.tsx)
  ├─ GitHub Contents API で最新版取得
  ├─ SHA-256 ハッシュで差分検出
  └─ AdvisorKnowledgeCache を更新 (変化があったものだけ)
```

### 3.5 保持期間 cron (`/api/cron/advisor-cleanup`)

```
[Vercel Cron - 毎日 04:00 JST (= "0 19 * * *" UTC)]
  │ GET /api/cron/advisor-cleanup
  │ Authorization: Bearer ${ADVISOR_CRON_SECRET}
  ▼
[Server: app/api/cron/advisor-cleanup/route.ts]
  1. しおりなし (bookmarked=false) かつ updated_at < now-30d な session を抽出
  2. その session 配下の Draft (updated_at < cutoff) を削除
  3. その Draft 配下の Version (created_at < cutoff) を削除
  4. AdvisorAuditLog を 90 日 (一般) / 180 日 (payload.kind="report_*") で削除
  5. AdvisorReportVersion で shared_until < now のものは share_token / shared_at / shared_until を null 化
  ▼
レスポンス: { ok: true, result: { deletedDrafts, deletedVersions, deletedAuditLogs, expiredSharesCleared } }
```

### 3.6 公開シェアページ (`/advisor/r/[token]`)

```
[公開ユーザー] https://tastas.work/advisor/r/{token} を開く
  ▼
[Server (RSC)]
  ├─ AdvisorReportVersion.findUnique({ share_token })
  ├─ shared_at が null / shared_until < now なら 404 / expired ページ
  └─ result_markdown を Markdown レンダリングして表示
     - 認証不要
     - 「公開期限: あと N 日」バッジ
     - noindex meta (将来追加)
```

---

## 4. 主要モジュールの責務

### `orchestrator.ts`
- システムプロンプト構築 → 履歴ロード → 入力先頭の hidden hint を見て分岐:
  - `[TOOL:report_create|draft_revise|result_edit]` → Gemini バイパス
  - それ以外 → Anthropic Tool Use ループ
- ストリーミング (SSE) でテキスト / tool_use / tool_result / heartbeat / usage / done を逐次送出
- ループ単位の TTFB / cache 効きを `LoopTrace` として audit_log に蓄積
- ツール後 loop > 0 では `max_tokens=512` 制限 (TTFB 削減目的)

### `system-prompt.ts`
- **cachedPart** (5 分 ephemeral cache): ROLE / 制約 / TOOLS_HINT / METRIC_CATALOG / プロジェクト知識
- **dynamicPart** (毎回): セッション情報 + **現在のレポートドラフト全体** (= `get_report_draft` ツールを廃止して埋め込みに移行)

### `llm/gemini-*.ts`
- Anthropic loop=1 TTFB 100 秒問題を回避するための直叩きルート
- `gemini.ts` は `@google/genai` の薄ラッパー (responseMimeType=application/json)
- 各 `gemini-*-edit/create.ts` は構造化出力 + 5 段フォールバック JSON パーサーで安定化

### `tools/registry.ts`
- 17 個のツールを集約。`describeAllToolsForLLM()` で Anthropic 用 description 生成
- `available()` を解決して description にステータス情報を埋め込む (= LLM が「未実装ツールを呼ばない」判断ができる)

### `reports/collect.ts`
- `data_sources` ごとに並列で収集
- `query_metric` は `metric_keys × METRIC_CATALOG.supportedGroupBy` 全展開 (= 1 metric につき複数の group_by を取得)
- 出力サイズは ツールあたり 50KB 切り詰め

### `reports/generate.ts`
- collect → buildUserPrompt → Gemini → createReportVersion のパイプライン
- システムプロンプトに「データに無い数字を捏造しない」「skeleton を踏襲」「JST 基準」「グラフは表で代替」を明示
- **previousResultMarkdown を Gemini に渡し、前バージョンの編集スタイルを維持** (auto-redraft で手作業修正を破壊しない)

### `actions/`
- **Server Actions** (`'use server'` ディレクティブ) — Canvas からの呼び出し起点
- `getDraftForSession` / `updateDraftBulk` / `clearDraftForSession`
- `enableShare` / `extendShare` / `disableShare`
- `toggleBookmark`
- `createReportVersion` / `getLatestVersion` / `lockEditing`

### `auth.ts`
- 既存の `lib/system-admin-session-server.ts` を再利用
- API Route / Server Action で `getSystemAdminServerSession()` を呼び `isLoggedIn === true` をチェック

### `db.ts` (`advisorDataPrisma`)
- 本番 Supabase への **読み取り専用** Prisma クライアント
- `runReadOnly()` で `SET TRANSACTION READ ONLY` ラップ (アプリ側の二重防御)
- Postgres 側でも `advisor_readonly` ロール (SELECT 権限のみ) で防御

---

## 5. 多重防御 (本番データの安全性)

| レイヤ | 仕組み |
|---|---|
| Postgres ロール | `advisor_readonly` (SELECT 権限のみ、INSERT/UPDATE/DELETE/TRUNCATE 剥奪) |
| アプリ側 | `runReadOnly()` で `SET TRANSACTION READ ONLY` ラップ |
| ORM 分離 | `advisorDataPrisma` (本番 Supabase 用) と `prisma` (Advisor 自身のテーブル用) を別インスタンスに |
| ツール設計 | DB 書き込み系ツールを 1 つも作らない (Phase 1 の設計原則) |

---

## 6. ストリーミング仕様 (SSE)

API Route は SSE で下記イベントを送信:

```
event: status     {"status": "thinking" | "tool" | "streaming" | "organizing"}
event: text       {"text": "確認します..."}
event: tool_use   {"id": "toolu_01...", "name": "query_metric", "input": {...}}
event: tool_result {"id": "toolu_01...", "ok": true, "summary": "12 件"}
event: heartbeat  {"phase": "thinking", "label": "思考中", "elapsedMs": 5300, "outputTokens": 142}
event: usage      {"inputTokens": 12000, "outputTokens": 320, "cacheReadTokens": 8000, "cacheWriteTokens": 0}
event: done       {"messageId": "msg_...", "conversationId": "..."}
event: error      {"text": "Anthropic credit balance too low"}
```

`heartbeat` は「動いている証拠」を表示するため 5 秒ごとに送出 (Claude Code 風 UI)。

---

## 7. エラーハンドリング

| ケース | 挙動 |
|---|---|
| 認証失敗 | 401 即返却 |
| レート制限超過 | 429 + 残時間表示 |
| コスト上限超過 | 429 + 管理者へのアラート |
| ツール実行エラー | LLM に tool_result として error を返し、続行させる (自己修正) |
| Anthropic API エラー | リトライ最大 2 回、それでも失敗ならユーザーにエラー表示 |
| Gemini API エラー (バイパス時) | 即時 `error` イベントで「失敗、再試行を」返却 (Anthropic フォールバック撤去) |
| ネットワーク中断 (SSE) | クライアント側で再接続 (5 秒バックオフ) |
| 知識同期失敗 | 古いキャッシュで動作継続、ログに記録 |

**Gemini フォールバック撤去の理由** (KNOWLEDGE.md §1.2):
Gemini 失敗 → Anthropic に流すと結局 loop=1 で 100 秒級になり、ユーザーが 2 分待たされて結局答えが返らない最悪 UX。
5〜10 秒で「失敗、再試行を」を返す方が遥かにマシ。

---

## 8. 監視・運用

- **監査ログ**: 全ての質問・ツール呼び出しを `AdvisorAuditLog` に記録 (`payload.kind` で詳細分類)
- **コスト監視**: `AdvisorUsageDaily` を `/system-admin/advisor/settings` で表示 (月次集計)
- **TTFB 計測**: `LoopTrace[]` を `chat_response` payload に蓄積 → `scripts/advisor-latency-trace.ts` で時系列分析可能
- **Cron 実行ログ**: 知識同期は `AdvisorKnowledgeSyncLog`、cleanup は API レスポンスのみ (将来テーブル化検討)

---

## 9. データソースとアクセス方法

| ソース | アクセス方法 | 環境変数 |
|---|---|---|
| 本番 Supabase 業務データ | `advisorDataPrisma` (READ ONLY tx) | `ADVISOR_DATA_DATABASE_URL` |
| Advisor 自身の DB | `prisma` (通常クライアント) | `DATABASE_URL` |
| GA4 | 既存 `src/lib/ga-client.ts` 流用 | `GA_CREDENTIALS_JSON` |
| Search Console | Search Console API | `GA_CREDENTIALS_JSON` 流用 + `SEARCH_CONSOLE_SITE_URL` |
| Vercel ログ | Vercel REST API | `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` (+ `VERCEL_TEAM_ID`) |
| Supabase ログ | Supabase Management API | `SUPABASE_MANAGEMENT_TOKEN` + `SUPABASE_PROJECT_REF` |
| GitHub | Contents API | `GITHUB_TOKEN_FOR_ADVISOR` + `ADVISOR_GITHUB_OWNER` + `ADVISOR_GITHUB_REPO` |
| Anthropic | SDK | `ANTHROPIC_API_KEY` |
| Gemini | `@google/genai` | `GEMINI_API_KEY` |
| Cron 認証 | bearer token | `ADVISOR_CRON_SECRET` |

---

## 10. 将来拡張 (新ツール追加例: Lstep)

```
Step 1: Lstep webhook 受信 API を実装 (/api/lstep/webhook)
Step 2: Prisma に LstepEvent テーブル追加 + db push
Step 3: src/lib/advisor/tools/external/query-lstep.ts 作成
        - inputSchema 定義
        - execute() で LstepEvent.findMany を SELECT
Step 4: src/lib/advisor/tools/external/index.ts に1行追加 export
Step 5: registry.ts は変更不要 (external/index.ts から自動 import)
```

→ 工数 1〜2 日。チャット側のコード変更ゼロ。

将来の hub-platform 統合は [HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md) を参照。

---

## 11. 関連ドキュメント

- [README.md](./README.md) — 概要
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — Canvas + レポート機能の詳細フロー
- [data-model.md](./data-model.md) — DB スキーマ詳解
- [tools-spec.md](./tools-spec.md) — 17 個のツール仕様
- [system-prompt.md](./system-prompt.md) — Anthropic 用システムプロンプト
- [security-cost.md](./security-cost.md) — セキュリティ / コスト設計
- [STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) — ステージング展開手順
- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — デプロイチェックリスト
- [KNOWLEDGE.md](./KNOWLEDGE.md) — 設計判断の累積ナレッジ
- [HANDOFF.md](./HANDOFF.md) — セッションログ
