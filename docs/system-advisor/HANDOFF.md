# System Advisor 引き継ぎ資料 (継続更新)

**ブランチ**: `feature/system-advisor-chatbot`
**最終更新**: 2026-05-01 (v2 設定ページ + チャット内テーブル追加)
**ステータス**: ローカルで動作確認済み。本番Supabase接続済み (IPv4 アドオン)。ステージング展開待ち。

> このファイルは **毎回作り直さず、ここを更新** する。
> 新しいセッションで何かやったら、末尾の「セッションログ」に新しい節を追記する。

---

## 0. 次セッションでまずやること

```
1. このファイル全体を読む (TOP の Status Snapshot → Open Tasks → Session Log)
2. デプロイ系作業の場合は [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) を必読
3. ユーザーから現在の意図を聞く
4. 必要なら Open Tasks を消化 / Session Log に追記しながら進める
```

**📌 重要**: 「ステージング展開」「本番展開」「DB スキーマ反映」「Vercel 環境変数追加」のような
**デプロイ系作業はすべて [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) に集約**。
完了タスクはチェックボックス更新で進捗管理する。HANDOFF.md には書かない (重複防止)。

---

## 1. 現在のステータス Snapshot

| 項目 | 状態 |
|------|------|
| Anthropic API キー | ✅ 動作中 (実キーは `.env.local` を参照 — git に書かない) |
| ローカル DB スキーマ反映 | ✅ Docker Postgres に反映済み |
| ローカル動作確認 | ✅ 文字応答・ツール実行・履歴一覧・進捗表示 動作 |
| 進捗インジケータ (heartbeat) | ✅ Claude Code 風 (経過秒数 + tokens) |
| チャット履歴一覧 | ✅ `/system-admin/advisor/history` で閲覧可 |
| 設定ページ (v2) | ✅ `/system-admin/advisor/settings` 歯車アイコンから (ラリー回数 / プロンプト編集 / データソース一覧 / 月次使用統計) |
| チャット内テーブル表示 + コピー (v2) | ✅ Markdown table を整形表示し、右下のボタンで TSV をクリップボードへ |
| GA4 接続 | ✅ `query_ga4` ツールで Data API 経由取得済み |
| Supabase Management API | ✅ 設定済み (本番プロジェクト ref: `ryvyuxomiqcgkspmpltk`) |
| 本番 Supabase 読み取り専用接続 | ✅ `advisor_readonly` ロール作成 + IPv4 アドオン購入で Direct 接続成功 (User: 400 / Job: 200 取得確認) |
| ステージング DB スキーマ反映 | ⏸️ 未反映 |
| ステージング Vercel 環境変数追加 | ⏸️ 未設定 |
| 本番 DB スキーマ反映 | ⏸️ 未反映 |
| 本番 Vercel 環境変数追加 | ⏸️ 未設定 |
| PR 作成 | ⏸️ 未作成 (ユーザー判断で開始) |
| `_legacy_agent-hub/` 削除 | ⏸️ `.gitignore` 化済み、物理削除は動作確認後 |

---

## 2. アーキテクチャ要点 (詳細は別ファイル)

- `/system-admin/advisor` — System Admin 専用 LLM チャットボット (読み取り専用)
- 認証: iron-session ベース (NextAuth 別系統)
- LLM: Anthropic Claude (Sonnet/Opus/Haiku 切替可)
- ツール 17 個 (core/tastas-data/external/future)
- DB クライアント 2 種:
  - `lib/prisma` — Advisor のセッション/メッセージ/監査ログ用 (ローカル DB)
  - `src/lib/advisor/db.ts` の `advisorDataPrisma` — TASTAS 業務データ読み取り専用 (本番 Supabase)
  - フォールバック: `ADVISOR_DATA_DATABASE_URL` 未設定時はローカル DB を共有
- 二重防御の書き込み禁止:
  - Postgres レベル: `advisor_readonly` ロール (SELECT 権限のみ)
  - アプリレベル: `runReadOnly()` で `SET TRANSACTION READ ONLY` ラップ

詳細仕様:
- [README.md](./README.md) - 概要
- [architecture.md](./architecture.md) - システム構成
- [data-model.md](./data-model.md) - Prisma スキーマ
- [tools-spec.md](./tools-spec.md) - ツール仕様
- [system-prompt.md](./system-prompt.md) - プロンプト
- [security-cost.md](./security-cost.md) - セキュリティ/コスト
- [SETUP.md](./SETUP.md) - セットアップ

---

## 3. Open Tasks (優先度順)

### 🔴 ユーザー側作業 (Claude Code は CLAUDE.md ルールにより実行不可)

1. **Supabase Management Token 発行**
   - https://supabase.com/dashboard/account/tokens で `tastas-advisor-local` などの名前で生成
   - `.env.local` に `SUPABASE_MANAGEMENT_TOKEN=sbp_...` を追加
   - `SUPABASE_PROJECT_REF=ryvyuxomiqcgkspmpltk` (本番) も追加

2. **本番 Supabase 読み取り専用ロール作成**
   - 責任者と一緒に SQL Editor で実行 (本セッション中の SQL を参照)
   - `advisor_readonly` ロール作成 + SELECT 権限付与
   - 接続文字列を `.env.local` の `ADVISOR_DATA_DATABASE_URL` に追加
   - 詳細: [SETUP.md](./SETUP.md) 参照

3. **dev サーバー再起動**
   - `lsof -ti :3000 | xargs kill -9; rm -rf .next; npm run dev`
   - `.env.local` の変更反映に必須

### 🟡 動作確認後に進める作業

4. **PR 作成 → develop マージ** (ユーザー指示後)
   - 96 ファイル / +14,177 行 / -50 行 (現状)
   - PR base は **絶対に develop**。main 向けは禁止 (CLAUDE.md)
   - マージは Claude Code が実行しない (ユーザー手動)

5. **ステージング DB / 本番 DB スキーマ反映 (Advisor 9テーブル新規追加)**
   - ユーザーが `npx prisma db push` をステージング/本番の DATABASE_URL で実行
   - 追加対象 10 テーブル + 1 カラム追加:
     - `advisor_chat_sessions` (`AdvisorChatSession`)
     - `advisor_chat_messages` (`AdvisorChatMessage`)
     - `advisor_audit_logs` (`AdvisorAuditLog`)
     - `advisor_knowledge_cache` (`AdvisorKnowledgeCache`)
     - `advisor_knowledge_sync_logs` (`AdvisorKnowledgeSyncLog`)
     - `advisor_saved_prompts` (`AdvisorSavedPrompt`)
     - `advisor_usage_daily` (`AdvisorUsageDaily`)
     - `advisor_report_drafts` (`AdvisorReportDraft`) — `metric_keys` カラム追加 (P1-6)
     - `advisor_settings` (`AdvisorSettings`) ← **v2 追加** (設定ページ用シングルトン)
     - `advisor_report_versions` (`AdvisorReportVersion`) ← **P1 追加** (レポートのバージョン履歴)
   - 確認済み: `recommended_jobs`, `public_job_page_views`, `job_search_page_views`, `job_detail_page_views`, `registration_page_views`, `application_click_events`, `form_destinations` は **本番に反映済み** (派生機能で過去対応済み)
   - 反映前に必ず dry-run で SQL を目視確認:
     ```bash
     DATABASE_URL="..." npx prisma migrate diff \
       --from-schema-datamodel prisma/schema.prisma \
       --to-url "$DATABASE_URL" --script
     ```
     CREATE TABLE のみの 8 テーブル分であることを確認してから本コマンド実行

6. **Vercel ステージング環境変数追加** (ユーザー手動)
   - `ANTHROPIC_API_KEY` (新キー)
   - `GITHUB_TOKEN_FOR_ADVISOR`
   - `ADVISOR_GITHUB_OWNER=ichiro0712-dotcom`
   - `ADVISOR_GITHUB_REPO=share-worker-app`
   - `ADVISOR_CRON_SECRET`
   - `ADVISOR_DATA_DATABASE_URL` (本番 Supabase 読み取り専用)
   - `SUPABASE_MANAGEMENT_TOKEN`
   - `SUPABASE_PROJECT_REF`

7. **ステージング動作確認** → 本番展開判断

### 🟢 Phase 2 候補 (今後のアイデア)

- 監査ログ閲覧 UI (`/system-admin/advisor/audit`)
- 使用量ダッシュボード (`/system-admin/advisor/usage`)
- LINE Webhook 実装 → `query_line_friends` 本実装
- Search Console API 統合 → `query_search_console` 本実装
- Lstep webhook 受信 → `query_lstep_events` 本実装
- 長時間ツール (10秒超) の追加 status (`...(まだ取得中)`)
- 監査ログから "実際にユーザーが投げた質問の傾向" 分析

---

## 4. 重要な設計判断 / 制約 (絶対に変えない)

| # | 判断 | 理由 |
|---|------|------|
| 1 | TASTAS 業務データは **`advisorDataPrisma` 経由でしか触らない** | 本番への誤書き込み防止 |
| 2 | `runReadOnly()` で **必ず READ ONLY tx** ラップ | アプリ側の二重防御 |
| 3 | `_legacy_agent-hub/` は `.gitignore` 化済み (1.4GB) | リポジトリ肥大化防止 |
| 4 | Vercel 環境変数の CLI 操作は禁止 | CLAUDE.md ルール |
| 5 | 本番/ステージング DB への Prisma 直接コマンドは禁止 | CLAUDE.md ルール |
| 6 | PR base は `develop` のみ。`main` 向け禁止 | CLAUDE.md ルール |
| 7 | `gh pr merge` は Claude Code が実行しない | CLAUDE.md ルール |

---

## 5. 環境変数チェックリスト (`.env.local`)

```bash
# === 既設定 (動作確認済み) ===
DATABASE_URL=postgresql://sworks:sworks123@localhost:5432/sworks_dev?...   # ローカル Docker
ANTHROPIC_API_KEY=sk-ant-api03-XXXX                                         # Anthropic キー (実値は .env.local)
GITHUB_TOKEN_FOR_ADVISOR=ghp_...                                            # 知識同期用
ADVISOR_GITHUB_OWNER=ichiro0712-dotcom
ADVISOR_GITHUB_REPO=share-worker-app
ADVISOR_CRON_SECRET=XXXX                                                    # 32+文字ランダム (実値は .env.local)
GA4_PROPERTY_ID=522574288                                                   # GA4 動作確認済み
GOOGLE_APPLICATION_CREDENTIALS=credentials/ga-service-account.json

# === 未設定 (ユーザー作業待ち) ===
SUPABASE_MANAGEMENT_TOKEN=sbp_???                                           # Supabase ログ取得
SUPABASE_PROJECT_REF=ryvyuxomiqcgkspmpltk                                   # 本番プロジェクト
ADVISOR_DATA_DATABASE_URL=postgresql://advisor_readonly:???@db....          # 本番 Supabase 読取専用
```

---

## 6. 動作確認手順 (環境変数追加後)

```bash
# サーバー再起動 (必須)
cd "/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ"
unset DATABASE_URL DIRECT_URL
lsof -ti :3000 | xargs kill -9 2>/dev/null
rm -rf .next
npm run dev
```

ブラウザでハードリロード (Cmd+Shift+R) → `/system-admin/advisor` にログイン。
DevTools Console を開いて以下を試す:

| 質問 | 期待動作 |
|------|---------|
| 「こんにちは」 | 通常応答 |
| 「現在公開中の求人は何件?」 | `query_metric` (本番Supabase READ ONLY tx) → 件数返答 |
| 「Job テーブルにはどんなカラム?」 | `describe_db_table` → schema.prisma 解析 |
| 「先週のGA4セッション数」 | `query_ga4` → Data API → セッション数 |
| 「Supabase直近1時間のログ」 | `get_supabase_logs` → Management API → ログ |
| `[advisor] heartbeat:` ログ (Console) | 5秒ごとに heartbeat 受信される |

---

## 7. 既知の困りどころ (再発時の即対応集)

| 症状 | 原因 | 対応 |
|------|------|------|
| Anthropic 401 invalid x-api-key | キー revoke / 残高 0 / typo | キー再発行、`.env.local` 更新、dev 再起動 |
| 文字途中で止まる + 進捗も出ない | SSE バッファリング | `formatLine()` の終端が `\n\n` か確認、`X-Accel-Buffering: no` ヘッダー有無 |
| CSS が効かない | Next.js `.next` キャッシュ | `rm -rf .next; npm run dev` + ハードリロード |
| `password authentication failed` (advisor_readonly) | パスワードに URL 特殊文字 | `encodeURIComponent` でエンコードし直す |
| `permission denied for table` | GRANT 漏れ | `GRANT SELECT ON ALL TABLES IN SCHEMA public TO advisor_readonly;` 再実行 |
| `connection refused` (Supabase) | Direct 接続が無効 | Pooler (Session) モードを使う。ユーザー名は `advisor_readonly.ryvyuxomiqcgkspmpltk` |
| HMR で変更が反映されない | API Route の `.env` 変更等 | dev サーバー再起動 |

---

## 8. セッションログ (新しいセッションは上に追記)

書き方ルール:
- 新セッションで作業したら、**この節の一番上** に新節を追加 (古いものは下に流す)
- 形式: `### YYYY-MM-DD: タイトル` + 「やったこと」「変更ファイル」「学び・注意点」
- ログがあまりに長くなったら、3 ヶ月以上古いものは `HANDOFF_archive.md` に切り出す

---

### 2026-05-01 (6): レポート機能 (Canvas ドラフト + Gemini 生成)

#### やったこと

ユーザーの仕様:
1. チャットしながら右側 Canvas にレポート要件を固める
2. 「レポート作成」ボタンで Gemini にデータ送信、レポート生成
3. できたら同じ Canvas に表示

**1. Prisma スキーマに `AdvisorReportDraft` を追加**
- `prisma/schema.prisma` 末尾、テーブル名 `advisor_report_drafts`
- 1 セッション = 0 or 1 ドラフト (`session_id` ユニーク)
- フィールド: title, goal, data_sources (Json[]), range_start/end, outline, notes,
  status (drafting/generating/completed/failed), result_markdown, result_model,
  error_message, generation_count, generated_at
- ⚠️ ローカル Docker DB は `prisma db push` でユーザーに反映してもらう必要あり
  (Claude Code 側ではブロックされる)

**2. Anthropic ツールを 2 つ追加**
- `update_report_draft`: LLM がチャット中にドラフトを部分更新
- `get_report_draft`: 現在のドラフト取得 (LLM の自己確認用)
- ツールは `src/lib/advisor/tools/reports/` 配下に配置 + registry.ts に登録
- TOOL_STATUS_LABEL / tool-source-labels.ts にも追記

**3. システムプロンプトに "レポート作成モード" の章を追加**
- src/lib/advisor/system-prompt.ts
- "レポート作って" を検知したら本文を書かず update_report_draft を呼ぶよう指示
- data_sources のキー一覧 (query_metric, query_ga4, get_recent_errors 等) を提示

**4. レポート生成パイプライン**
- `src/lib/advisor/llm/gemini.ts` — `@google/genai` の薄い wrapper (gemini-2.5-flash, 非ストリーミング)
- `src/lib/advisor/persistence/report-drafts.ts` — Prisma 操作 (upsert, mark generating, save result/error)
- `src/lib/advisor/reports/collect.ts` — dataSources のツール群を並列実行
  (期間引数等は buildInputFor() で集中管理)
- `src/lib/advisor/reports/generate.ts` — collect → Gemini 投入 → 結果保存
- API: `POST /api/advisor/report/generate` (System Admin 認証必須、120秒上限)

**5. UI**
- `src/components/advisor/report/report-canvas.tsx` 新規 (420px 幅、右ペイン)
  - ドラフト表示 / レポート結果表示 のタブ切替 (結果生成後のみ表示)
  - 「レポート作成」ボタン → /api/advisor/report/generate を叩く
  - 2 秒間隔で `getDraftForSession` をポーリング (LLM 経由のドラフト更新を反映)
- chat-layout.tsx に Canvas 統合
  - LLM 応答に update_report_draft が含まれたら自動オープン
  - 会話切替時にドラフトの存在をチェックして自動オープン
  - ヘッダーに開閉トグル (FileText アイコン)

**6. Server Actions**
- `src/lib/advisor/actions/report-drafts.ts`
  - `getDraftForSession(sessionId)` - Canvas のポーリング元
  - `clearDraftForSession(sessionId)` - 削除ボタン用

#### ⏸️ ユーザー作業 (Claude Code 不可)

1. **GEMINI_API_KEY の追加**
   - `.env.local` に `GEMINI_API_KEY=AIza...` を追加
   - 取得元: https://aistudio.google.com/apikey
   - dev サーバー再起動が必須

2. **ローカル Docker DB スキーマ反映**
   ```bash
   cd "/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ"
   unset DATABASE_URL DIRECT_URL
   npx prisma db push
   ```
   (advisor_report_drafts テーブルが追加される)

3. **dev サーバー再起動**
   ```bash
   lsof -ti :3000 | xargs kill -9 2>/dev/null
   rm -rf .next
   npm run dev
   ```

4. **ステージング/本番展開時の作業**
   - prisma db push を本番/ステージングDB環境変数で実行 (ユーザー手動)
   - Vercel 環境変数 `GEMINI_API_KEY` を Production / Preview 両方に追加

#### 動作確認手順

1. `/system-admin/advisor` を開いて新規 chat 開始
2. 「先週のKPIをまとめて」のように依頼
3. 数秒後、右側 Canvas が自動で開いてドラフトが表示されるはず
4. 「期間は4/24〜4/30で」「GA4 のデータも入れて」のように追記指示
5. Canvas のフィールドが順次更新される
6. 「レポート作成」ボタンを押す → Gemini で生成 → タブに「レポート (v1)」が出る
7. コピーボタンで Markdown コピー、ドラフトに戻って再生成も可能

#### 学び・注意点

- **Anthropic でツール選択 / 対話 / 要件固め、Gemini で本文生成 の役割分担が綺麗**
  - Anthropic は高い対話能力で要件を引き出すが本文生成は冗長気味
  - Gemini Flash は安く速い、長文整形が得意
  - これでループ上限 (今は 20) を消費せずに重い処理が走る
- **Canvas ポーリング 2 秒間隔は妥協**。理想は SSE / WebSocket だが、ドラフト更新は
  LLM 応答 1 ターンに数回程度なので 2 秒で実用十分。コスト/複雑度のトレードオフ
- **dataSources のキーは tool-source-labels.ts と reports/collect.ts の buildInputFor()
  の両方に対応エントリが必要**。新ツールを追加するなら忘れずに

---

### 2026-05-01 (5): tool_use ループ上限の挙動改善

#### やったこと

**症状**: 長尺な調査質問で「考えてる文字が流れる → 途中で消されて
`tool use ループが上限 (8) を超えました` エラー」になっていた。

**原因**:
- `MAX_TOOL_LOOPS = 8` は短く、複数ステップの調査で簡単に到達
- 上限到達時の挙動が `error` イベントだったため、それまで生成した
  text ストリームをクライアント側がエラーメッセージで上書きしてしまう
  (chat-layout.tsx の catch 句が `setStreamingContent('')` してエラー本文に置き換える)
- 結果: 推論途中の文字が捨てられ、ユーザーには "途中まで考えてた内容も全部消えてエラー" に見える

**修正**:
1. `MAX_TOOL_LOOPS` を 8 → 20 に拡大
2. 上限到達時も **error ではなく done で締める**:
   - それまで生成した `assembledAssistantText` に「⚠️ 上限に達したので一旦区切りました。
     続きが必要なら『続けて』と送ってください」の注記を追加して `appendMessage()` で永続化
   - クライアントには注記の text イベント → usage → done の順に通常終了相当を送る
   - `recordAudit` の eventType は `'error'` だが `payload.reason='tool_loop_exceeded'`,
     `payload.recovered=true` で実害イベントと区別

#### 変更ファイル

- `src/lib/advisor/orchestrator.ts`
  - `MAX_TOOL_LOOPS` 8 → 20
  - ループ上限超過時の処理ブロックを書き直し (途中まで保存 + done で終了)

#### 学び・注意点

- **長尺推論を扱うときは "途中で打ち切る = エラー" にしない**。途中までの出力が
  ユーザーに既に見えている場合、それを error で上書きするとユーザー体験が大きく劣化する。
  Claude Code 自身も「ここで一旦区切ります」スタイルで終わる。
- **`error` イベントのクライアント挙動を意識する**。chat-layout.tsx は error を
  受けるとストリーミングバッファをクリアしてコードブロックでエラー文を表示する。
  "正常に終わった、ただし続きあり" を表すなら done を使うべき。

---

### 2026-05-01 (4): UI 改善 - チャットヘッダーアイコン + 参照ソース表示

#### やったこと

**1. チャットヘッダーに Bot アイコン追加**
- `src/components/advisor/chat/chat-layout.tsx` の `Chat領域` ヘッダー (h-12) に
  サイドバーと同じ `lucide-react` の `Bot` アイコンと「システムアドバイザー」ラベルを表示
- 「システムアドバイザー / <会話タイトル>」という階層表示にした
- アシスタントメッセージ左の丸アイコンも `Bot` (slate-800 角丸) に変更
  (旧: グレーの丸ドット)

**2. 回答下部に「参照したデータソース」セクションを必ず表示**
- 仕組み: orchestrator は元々 `tool_use` SSE イベントを送出している。
  クライアント側 `streamRequest` でこれを蓄積し、assistant メッセージの
  `sources: string[]` フィールドに渡す
- ツール名 → 表示名 / カテゴリのマッピングを `src/lib/advisor/tool-source-labels.ts` に新設
  (例: `query_metric` → 本番DB / "本番 DB (指標集計)")
- `UnifiedMessage` 内に `SourceList` コンポーネントを追加。回答末尾に
  カテゴリバッジ + ラベル + 呼び出し回数 (×N) のチップを並べる
- 同一ツールが複数回呼ばれても 1 行にまとめて回数表示
- 未登録ツールは "その他" カテゴリでツール名のまま表示 (新ツール追加時の安全策)

#### 変更ファイル

- 新規: `src/lib/advisor/tool-source-labels.ts`
- 編集:
  - `src/components/advisor/chat/chat-layout.tsx`
    (Bot ヘッダー、`Message.sources` フィールド、streamRequest が tool_use を蓄積)
  - `src/components/advisor/chat/unified-message.tsx`
    (`Bot` デフォルトアイコン、`SourceList` コンポーネント、`UnifiedMessage.sources` フィールド)

#### 学び・注意点

- **新ツールを追加したら必ず `tool-source-labels.ts` にもエントリを追加**。
  忘れても "その他" にフォールバックするので壊れないが、UI 表示が
  ツール名そのまま (`get_xxx_summary` 等) になり読みにくい
- registry.ts のツールと 1:1 対応であることを意識する。CI で対応漏れを検出するなら
  registry のツール名一覧と TOOL_SOURCE_LABELS のキー集合を比較するテストを足す手もある
  (今は手動チェック)

---

### 2026-05-01 (4): v2 設定ページ + チャット内テーブル + スプレッドシートコピー

#### やったこと

ユーザーから 2 つの追加機能要求:
1. ヘッダー右上に歯車アイコン → 設定ページ
   - ラリー回数 (編集可)
   - プロンプト編集 (編集可、現状の本体ルールを編集可能)
   - 参照データ一覧 (表示のみ)
   - LLM 使用統計 (表示のみ、月単位)
2. チャット内のテーブル表示 + 右下「スプレッドシートにコピー」ボタン

ユーザー指示で **デプロイはしない**、ローカルで完結 (デプロイ時の対応は DEPLOY_CHECKLIST.md に記録済み)。

**1. 永続化レイヤー新設**
- `prisma/schema.prisma` に `AdvisorSettings` モデル追加 (シングルトン: id="default" 固定行)
  - `max_tool_loops` (default 20)
  - `system_prompt_override` (Text, null可)
  - `updated_by_admin_id`, `updated_at`
  - テーブル名: `advisor_settings`
- `src/lib/advisor/persistence/settings.ts` 新設
  - `getAdvisorSettings()` (upsert で初回自動作成)
  - `updateAdvisorSettings()` (バリデーション付き)
  - `DEFAULT_MAX_TOOL_LOOPS = 20` 定数

**2. orchestrator のハードコード解放**
- `MAX_TOOL_LOOPS = 20` 定数を削除し、`FALLBACK_MAX_TOOL_LOOPS = 20` に改名
- `runOrchestrator()` 冒頭で `getAdvisorSettings()` を呼んで `maxToolLoops` を変数化
- ループ条件と cutoff note メッセージ・監査ログの 3 箇所すべてを変数参照に書き換え

**3. システムプロンプト override 対応**
- `src/lib/advisor/system-prompt.ts` で `DEFAULT_PROMPT_SECTIONS` を export
- `getDefaultPromptText()` ヘルパーを追加 (設定ページで「現状をコピーして編集」UX に必要)
- `buildSystemPrompt()` に `systemPromptOverride?: string | null` 引数を追加
- override がある場合は ROLE+CRITICAL+TOOLS+RESPONSE+SAFETY をそれで差し替え (知識ブロックは常に注入)

**4. 設定ページ Server Actions**
- `src/lib/advisor/actions/settings.ts` 新設
  - `getSettings()` — 初期データ取得
  - `saveSettings()` — System Admin 編集の保存
  - `getDataSources()` — 6 データソース (GitHub / 本番Supabase / Supabase Mgmt / GA4 / Vercel / Advisor Meta DB) の状態を返す
  - `getToolList()` — 17 ツールの利用可否を `available()` で取得
  - `getMonthlyUsage()` — `AdvisorUsageDaily` を月次集計 (直近 12ヶ月)
  - 注意: `AdvisorUsageDaily` は `model_id` を持たず `(admin_id, date_jst)` ユニーク。モデル別内訳は出せない (将来課題)

**5. 設定ページ UI**
- `app/system-admin/advisor/settings/page.tsx` (Server Component, auth ガード)
- `src/components/advisor/settings/settings-client.tsx` (Client Component)
  - 3 セクション: 基本設定 (編集) / 参照データソース (表示) / 月次使用統計 (表示)
  - プロンプト editor は textarea (50,000 文字上限、現状値を読み込むボタン、解除ボタン)
  - データソースは StatusBadge (ready/fallback/unavailable) で視覚化
  - 月次使用統計はテーブル (入力/出力/cache_read/cache_write/合計/メッセージ/ツール呼出/概算USD)

**6. ヘッダーに歯車アイコン**
- `chat-layout.tsx` のヘッダー右側 (Canvas トグルの隣) に追加
- `Settings` lucide-react を `SettingsIcon` にエイリアス (Advisor の `Settings` 型と区別)
- リンク先: `/system-admin/advisor/settings`

**7. チャット内テーブル + スプレッドシートコピー**
- `npm install remark-gfm` で GFM サポートを追加 (CommonMark のみだった `react-markdown` を拡張)
- `unified-message.tsx` の `ReactMarkdown` に `remarkPlugins={[remarkGfm]}` を渡す
- `src/components/advisor/chat/markdown-table.tsx` 新設
  - `MarkdownTable` で `<table>` をラップして右下にホバーボタン表示
  - クリック時: `<table>` を TSV (タブ区切り) に変換して `navigator.clipboard.writeText`
  - 古いブラウザ用フォールバック (`document.execCommand('copy')`) も実装
  - 2 秒後に「コピー済」表示が消える
- `unified-message.tsx` の `components` プロパティに table/thead/tbody/tr/th/td を追加

#### 変更ファイル

新規:
- `src/lib/advisor/persistence/settings.ts`
- `src/lib/advisor/actions/settings.ts`
- `app/system-admin/advisor/settings/page.tsx`
- `src/components/advisor/settings/settings-client.tsx`
- `src/components/advisor/chat/markdown-table.tsx`

編集:
- `prisma/schema.prisma` (`AdvisorSettings` モデル追加)
- `src/lib/advisor/orchestrator.ts` (DB 設定読込 + 動的 maxToolLoops)
- `src/lib/advisor/system-prompt.ts` (override 対応 + DEFAULT_PROMPT_SECTIONS export)
- `src/components/advisor/chat/chat-layout.tsx` (歯車アイコン追加 + Settings → SettingsIcon エイリアス)
- `src/components/advisor/chat/unified-message.tsx` (remarkGfm + table コンポーネント差し替え)
- `package.json` / `package-lock.json` (`remark-gfm@^4.0.1` 追加)
- `docs/system-advisor/HANDOFF.md` (本ファイル)
- `docs/system-advisor/DEPLOY_CHECKLIST.md` (Advisor テーブル 8 → 9 個に更新)

#### 学び・注意点

- **設定をコード定数で持つと運用後に動的変更できない**。最初から DB に持たせる方が良い (今回 `MAX_TOOL_LOOPS` を解放するために orchestrator 全体を改修した)
- **react-markdown は CommonMark のみ**。GFM (table / strikethrough / task list 等) を使うには `remark-gfm` 必須
- **`navigator.clipboard` は HTTPS or localhost でしか動かない**。Vercel preview/production は HTTPS なので問題なし、ローカル dev も localhost なので OK
- **AdvisorUsageDaily に model_id が無い**。月次統計をモデル別に出すなら DB 設計から要見直し → 将来課題 (Phase 2)
- **`Settings` という lucide-react のアイコン名は Advisor の `Settings` 型と衝突する**。エイリアス `SettingsIcon` で回避済み

#### 次セッションで真っ先にやること

1. ブラウザでハードリロード → 歯車アイコンから設定ページに入って動作確認
2. プロンプトを試しに編集して保存 → チャットに反映されるか確認 (再起動不要、毎リクエスト DB 読込)
3. ラリー回数を 5 などに減らして、cutoff note が正しく動くか確認
4. テーブルを含む応答を Advisor に出させて、コピーボタンで Google Sheets にペーストできるか確認
5. データソース一覧と月次使用統計の表示を確認 (記録がまだ少なければ統計は空)
6. ステージング展開判断はユーザー指示後

#### 未着手 / 既知の制限

- ⏸️ モデル別の月次使用統計 (現スキーマでは出せない、`AdvisorUsageDaily` に `model_id` を追加する改修が必要)
- ⏸️ プロンプト編集の section ごとの個別編集 (現状は ROLE+CONSTRAINTS+TOOLS+RESPONSE+SAFETY 全体を 1 textarea で書き換える方式)
- ⏸️ プロンプト変更履歴 (現状は最新の override しか保持しない。バージョン管理したいなら `AdvisorSettingsHistory` テーブルが必要)
- ⏸️ 設定ページのモバイル最適化 (max-w-5xl で PC 想定)

---

### 2026-05-01 (3): 本番Supabase 読取専用接続の準備 + GA4 確認 + SSE バッファリング修正

#### やったこと

**1. Advisor 専用 Prisma クライアント新設**
- `src/lib/advisor/db.ts` 作成
- `advisorDataPrisma` (`ADVISOR_DATA_DATABASE_URL` を datasources.db.url で渡す)
- `runReadOnly(fn)` ラッパー: `$transaction` 内で `SET TRANSACTION READ ONLY` を発行
- `describeAdvisorDataConnection()` ヘルパー: 接続先がフォールバック中か本番か返す

**2. tastas-data ツールを Advisor 専用クライアントに切替**
- `get-jobs-summary.ts` / `get-users-summary.ts` / `get-recent-errors.ts` / `query-metric.ts` の 4 ツール
- `prisma.xxx` → `runReadOnly((tx) => tx.xxx)` に書き換え
- 各ツールに `available()` 追加 — フォールバック中なら "開発DBの値です" と Advisor が前置きする

**3. GA4 接続確認**
- `npx tsx scripts/test-ga4-connection.ts` で過去7日のセッション数取得成功
- `query_ga4` ツールは登録済み・認証済み・動作確認済み (= 追加作業不要)

**4. SSE バッファリング不具合の修正 (重要)**
- 症状: 長尺応答 (50秒以上) で文字が途中で止まり、heartbeat も届かない
- 原因: `formatLine()` で `data: ...\n` (改行 1 つ) で終わっていた → SSE 仕様は `\n\n` (空行で 1 イベント終端)
- 結果として、ブラウザが「まだイベントの途中」と判断してバッファに溜め込み、ある程度貯まるか接続終了時にまとめて吐き出す挙動になっていた
- 修正: `formatLine()` を `\n\n` に変更 + `X-Accel-Buffering: no` ヘッダー追加 (本番プロキシ層用)
- 短い応答では問題が出ず、当初の動作確認をすり抜けていた

**5. UX 改善: Claude Code 風 heartbeat 進捗表示**
- サーバー側: `setInterval` で 5 秒ごとに heartbeat 送出 (try/finally で確実に止める)
- フェーズ管理: `thinking` / `tool` / `streaming` / `organizing` を状態変数で持つ
- ツール名→ラベル辞書 17 個 (`TOOL_STATUS_LABEL`)
- クライアント: `progress` ステート + 1秒タイマーで毎秒経過時間を進める
- レンダリング条件を `loading && !streamingContent` → `loading` に変更 (ストリーミング中も常時表示)
- 結果: 応答中ずっと「考え中... · 経過 12s · 250 tokens」のように動きが見える

**6. チャット履歴一覧ページ追加**
- `app/system-admin/advisor/history/page.tsx` (legacy `_legacy_agent-hub/app/history/page.tsx` から CA・briefing 除去で移植)
- 検索 + 日付グルーピング + 200 件まで取得
- サイドバー下部に「すべての履歴を見る」リンク追加
- ChatLayout が `?c=<id>` クエリで特定会話を直接開く対応

**7. .gitignore 整理**
- `.env.production.local.disabled` 追加
- `_legacy_agent-hub/` 追加 (1.4GB なので絶対に commit しない)
- `tastas-lp/` 追加 (別プロジェクト)

**8. ステージング展開準備 (まだ commit してない)**
- Advisor 関連 96 ファイルだけ `git add` で stage 済み
- commit / push / PR 作成は未実施 (ユーザー判断待ち)

#### 変更ファイル (主要)

- 新規: `src/lib/advisor/db.ts`, `src/components/advisor/history/history-client.tsx`, `app/system-admin/advisor/history/page.tsx`
- 編集: `src/lib/advisor/orchestrator.ts` (heartbeat), `app/api/advisor/chat/route.ts` (SSE 修正), `src/components/advisor/chat/chat-layout.tsx` (進捗表示), `src/components/advisor/chat/status-indicator.tsx` (経過秒数+トークン), `src/lib/advisor/tools/tastas-data/*.ts` (4ツール), `.gitignore`

#### 学び・注意点

- **SSE は `\n\n` 必須**。`\n` だけだとブラウザが「まだ途中」とみなしてバッファ。短いレスポンスだけで動作確認すると見逃す。
- **ツール名→ラベル辞書はサーバー側 1 ヶ所に集約**。クライアント側で辞書引きするとツール追加のたびに両側更新になる。サーバーが完成形のラベルを送るのが正解。
- **本番 DB は ロール × アプリの 2 重防御**。片方だけだと「将来別ツールで GUARD 漏れ」リスクがある。
- **同じパターンを他システムにも展開可能**。汎用プロンプトを 2 通 (初版 + 改修版) 書いてある (会話ログに残存)。

#### 次セッションで真っ先にやること

1. ユーザーが Supabase Management Token + 読取専用ロール作成を完了したか確認
2. 完了していれば `.env.local` 確認 → dev 再起動 → テスト質問で本番データが見えるか確認
3. 動けば PR 作成判断をユーザーに仰ぐ

---

### 2026-05-01 (2): API キー復旧 + UX 大幅改善

#### やったこと

- ユーザーから新 Anthropic API キー受領、`.env.local` 更新
- curl で疎通確認: HTTP 200 (Haiku 4.5 から `Hi! How can I help you today?` 取得)
- dev サーバー再起動
- `/api/advisor/chat` 401 (System Admin 認証ガード) で正常動作確認

#### 学び・注意点

- 旧キーは **Anthropic Console 側で revoke されていた** (理由不明)。401 invalid x-api-key の最有力原因はこれ。
- curl での直接疎通確認はキーの真贋判別に必須。

---

### 2026-05-01 (1): UI/コア実装完了

#### やったこと

- legacy `_legacy_agent-hub` UI を 100% 流用 → CA/Canvas/Notification/PCStatus を全削除して Advisor 化
- Sonnet/Opus/Haiku 3 モデル切替対応
- ツールリストを Advisor 用 (ログ調査/システムアドバイス/指標集計/DB状態確認)
- ポップアップ・吹き出しの色を System Admin デザイン (slate) に統一
- SSE バッファリング処理を追加 (チャンク跨ぎ JSON 対応)
- サンプルボタン 3 つ (ログ集計/追加機能検討/仕様質問) 即送信
- Tailwind config に `./src/**/*` 追加 (重要)
- middleware で `/api/advisor` を NextAuth スキップ対象に登録
- DB は ローカル Docker のみ反映

#### ブロッカー

- Anthropic API キー 401 (次回セッションで解決)

---

## 9. 引き継ぎチェックリスト (新セッション開始時)

- [ ] このファイルの「Status Snapshot」と「Open Tasks」を読む
- [ ] 直近のセッションログを 1〜2 個読む
- [ ] dev サーバーが起動しているか確認 (`curl http://localhost:3000/system-admin/login`)
- [ ] ユーザーから現在の意図を聞いてから動く
- [ ] 作業終了時、本ファイル末尾の「セッションログ」に **新節を上に追記** する
