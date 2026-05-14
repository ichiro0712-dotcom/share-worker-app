# System Advisor 実装ロードマップ

## 0. 実装の進め方

- 各 Phase の完了条件を満たしたら次へ進む
- すべてローカル環境で完結 (push/deploy なし)
- 各 Phase で `npm run build` をパスすることを必須条件にする
- 単純で大量の作業は Antigravity 委託書を渡す
- 全完了後、ユーザー (kawashima) が user-checklist.md に従って最終確認・テスト

## Phase 1: Prisma スキーマ追加 (Claude Code 実装)

### 内容
- `prisma/schema.prisma` に Advisor 関連の 6 model を追記
- 詳細は [data-model.md](./data-model.md) 参照

### 完了条件
- [ ] `prisma/schema.prisma` に追記済み
- [ ] `npx prisma generate` が成功
- [ ] (ユーザー作業) ローカル Docker DB に `npx prisma db push` で反映

### 想定工数
0.5日 (実装 1時間 + ユーザー反映待ち)

### 成果物
- `prisma/schema.prisma` の差分

---

## Phase 2: コア基盤実装 (Claude Code 実装)

### 内容
- npm 依存追加: `@anthropic-ai/sdk`, `clsx`, `tailwind-merge`, `@radix-ui/*`
- `src/lib/advisor/claude.ts` - Anthropic SDK ラッパー
- `src/lib/advisor/auth.ts` - System Admin 認証ガード
- `src/lib/advisor/jst.ts` - JST ヘルパー (既存ヘルパーの再エクスポート)
- `src/lib/advisor/system-prompt.ts` - システムプロンプト構築 (skeleton)
- `src/lib/advisor/prompt-cache.ts` - cache_control 設定
- `src/lib/advisor/knowledge/store.ts` - 知識ストア IF
- `src/lib/advisor/knowledge/github-source.ts` - GitHub Contents API クライアント
- `src/lib/advisor/knowledge/sync.ts` - 同期ロジック本体
- `src/lib/advisor/persistence/sessions.ts` - Server Actions (CRUD)
- `src/lib/advisor/persistence/messages.ts`
- `src/lib/advisor/persistence/audit.ts`
- `src/lib/advisor/rate-limit.ts`
- `src/lib/advisor/cost-guard.ts`
- `app/api/cron/advisor-knowledge-sync/route.ts` - 定期同期エンドポイント

### 完了条件
- [ ] 全ファイルが TypeScript エラーなし
- [ ] `npm run build` が成功
- [ ] ローカルで GitHub API 経由の知識取得が動く (テストスクリプト)
- [ ] cron エンドポイントへのローカル POST で同期完了する

### 想定工数
2日

### 成果物
- 上記ファイル群
- `scripts/test-advisor-knowledge-sync.ts` (動作確認用)

---

## Phase 3: ツールレジストリ実装 (Claude Code + Antigravity)

### 内容

#### Step 3a: Antigravity に依頼書 03 を渡してスタブ作成
- [03-tool-stub-files.md](./antigravity-tasks/03-tool-stub-files.md) を Antigravity に渡す
- 完了後、Claude Code がレビュー

#### Step 3b: Claude Code が各ツールの中身を実装

優先度高 (Phase 1 で動作必須):
- `core/read-doc.ts`
- `core/read-repo-file.ts`
- `core/search-codebase.ts`
- `core/get-recent-commits.ts`
- `tastas-data/list-available-metrics.ts`
- `tastas-data/query-metric.ts`
- `tastas-data/get-jobs-summary.ts`
- `tastas-data/get-users-summary.ts`
- `tastas-data/get-recent-errors.ts`
- `tastas-data/describe-db-table.ts`
- `external/query-ga4.ts` (既存 ga-client.ts 活用)

優先度中 (Phase 1 ターゲットだが詰まったら持ち越し可):
- `core/list-directory.ts`
- `external/get-vercel-logs.ts`
- `external/get-vercel-deployments.ts`
- `external/get-supabase-logs.ts`

優先度低 (スタブのまま放置でOK):
- `future/*` (3ツール、`available: false` 固定)

### 完了条件
- [ ] 18ツールすべての `execute()` が実装されている (future はスタブ)
- [ ] 各ツールが mock 入力で動作確認済み (`scripts/test-tools.ts`)
- [ ] `npm run build` が成功

### 想定工数
3日 (Antigravity 30分 + Claude Code 2.5日)

### 成果物
- 18ツールファイル
- registry.ts
- `scripts/test-tools.ts`

---

## Phase 4: API Route + ストリーミング実装 (Claude Code 実装)

### 内容
- `src/lib/advisor/orchestrator.ts` - メインの tool use ループ
- `app/api/advisor/chat/route.ts` - SSE ストリーミング エンドポイント
- 入力: `{ sessionId?: string, message: string }`
- 認証チェック → レート制限 → コスト確認 → orchestrator.run() を呼ぶ
- SSE で chunk を順次返す: `text` / `tool_use` / `tool_result` / `usage` / `done`

### 完了条件
- [ ] curl で `/api/advisor/chat` を叩いて SSE が返る
- [ ] tool use ループが動く (例: "求人何件?" でツール呼び出し→回答)
- [ ] 認証エラー時に 401 を返す
- [ ] 監査ログが `AdvisorAuditLog` に記録される
- [ ] トークン使用量が `AdvisorUsageDaily` に集計される

### 想定工数
1.5日

### 成果物
- API Route + Orchestrator
- `scripts/test-api-stream.sh` (curl テスト)

---

## Phase 5: UI 実装 (Claude Code + Antigravity)

### 内容

#### Step 5a: Antigravity に依頼書 01 / 02 を順番に渡す
- [01-shadcn-ui-copy.md](./antigravity-tasks/01-shadcn-ui-copy.md)
- [02-chat-ui-strip-ca.md](./antigravity-tasks/02-chat-ui-strip-ca.md)

#### Step 5b: Claude Code が以下を実装/修正
- `app/system-admin/advisor/page.tsx` - サーバー側認証チェック後にクライアントへ
- `app/system-admin/advisor/layout.tsx` - System Admin レイアウト
- `app/system-admin/advisor/loading.tsx`
- `src/components/advisor/chat-layout.tsx` の ストリーミング受信ロジック修正
- `src/components/advisor/tool-call-display.tsx` (新規) - ツール実行の透明性表示
- 既存の System Admin ナビ (サイドバー等) にメニュー追加 → 場所要確認

### 完了条件
- [ ] `/system-admin/advisor` にアクセスしてチャット UI が表示される
- [ ] メッセージ送信 → ストリーミング応答が流れる
- [ ] ツール呼び出しが UI に表示される
- [ ] セッション一覧サイドバーが機能する (作成・削除・切り替え)
- [ ] System Admin 未ログインだとアクセスできない

### 想定工数
2日 (Antigravity 1.5h + Claude Code 1.5日)

### 成果物
- 画面・コンポーネント

---

## Phase 6: ビルド検証 + セットアップドキュメント作成

### 内容
- `npm run build` 完走確認
- `npm run lint` 確認
- 必須環境変数のリストアップと user-checklist.md への記載
- 動作確認手順の整備
- legacy フォルダ削除指示の作成

### 完了条件
- [ ] ビルドが完走
- [ ] Lint がエラーなし (warning は許容)
- [ ] [user-checklist.md](./user-checklist.md) が完成
- [ ] ユーザーへの引き継ぎサマリ作成

### 想定工数
1日

### 成果物
- 完成済みコードベース
- ユーザー向け引き継ぎドキュメント

---

## 全 Phase の依存関係

```
Phase 1 (DB schema) ──┐
                      ├─→ Phase 2 (Core) ──┬─→ Phase 3 (Tools) ──┐
                      │                    │                     │
                      │                    └────────────┐        │
                      │                                 ▼        ▼
                      │                          Phase 4 (API) ──┐
                      │                                          │
                      └──────────────────────────────────────────┴─→ Phase 5 (UI) ─→ Phase 6 (検証)
```

並行可能性:
- Phase 2 と Phase 3 (Antigravity スタブ部分) は並行可能
- Phase 5a (Antigravity 依頼) と Phase 4 は並行可能

## 環境変数の追加 (ユーザー作業)

実装に応じて以下を `.env.local` に追加。本番環境変数は Vercel ダッシュボードで設定する (CLAUDE.md ルール)。

```bash
# Phase 2 で必要
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
GITHUB_TOKEN_FOR_ADVISOR=ghp_xxxxx           # repo:read 権限のみ
ADVISOR_GITHUB_OWNER=ichiro0712-dotcom
ADVISOR_GITHUB_REPO=share-worker-app

# Phase 3 で必要 (一部)
VERCEL_API_TOKEN=xxxxx                       # 任意 (なくても動く、available:false になる)
SUPABASE_MANAGEMENT_TOKEN=xxxxx              # 任意

# Phase 4 で必要
ADVISOR_DAILY_TOKEN_CAP=2000000              # 1日あたり上限 (200万tokens ≈ $6)
ADVISOR_RATE_LIMIT_PER_HOUR=60               # 管理者1人1時間60リクエスト
ADVISOR_RATE_LIMIT_PER_DAY=500               # 管理者1人1日500リクエスト

# Phase 6 cron 用
ADVISOR_CRON_SECRET=xxxx                     # cron エンドポイントの shared secret
```

## 想定総工数

| Phase | 工数 | 備考 |
|-------|------|------|
| Phase 1 | 0.5日 | DB スキーマ |
| Phase 2 | 2日 | コア基盤 |
| Phase 3 | 3日 | ツール 18 個 |
| Phase 4 | 1.5日 | API + ストリーミング |
| Phase 5 | 2日 | UI |
| Phase 6 | 1日 | 検証 |
| **合計** | **10日** | Antigravity 並列で短縮可能 |

ユーザーの作業 (DB push, 環境変数追加, 動作確認) を含めても 11〜12日で完成可能。
