# System Advisor 引き継ぎ資料 (継続更新)

**ブランチ**: `feature/system-advisor-chatbot`
**最終更新**: 2026-05-06 — hub-platform 連携 (handoff-bundle 作成 / 追加バグ報告対応 / 機能 3, 8 採用 / Anthropic キー同期問題)
**ステータス**: ローカルで動作確認済み。本番Supabase接続済み (IPv4 アドオン)。ステージング展開待ち。
**大方針** (2026-05-03 確定): TASTAS Advisor 安定運用後に hub-platform へ統合。詳細は [HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md)
**次セッションへ**: [NEXT_SESSION.md](./NEXT_SESSION.md) を最初に読むこと。

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

## 🚨 次セッションへの最優先タスク (2026-05-02 から持ち越し)

**症状**: Canvas でレポートドラフトを作る機能の **応答速度が圧倒的に遅い**
- 表の行を 2 つ増やすだけで 2 分以上かかる
- 直近のセッションで Anthropic API 残高切れ (`credit balance is too low`) も発生
  → ユーザーが残高補充するまで動作確認も止まる
- これまでに以下の対策を入れたが、根本解決していない:
  - `get_report_draft` ツール削除 (dynamic system prompt にドラフト全体を埋める)
  - `update_report_draft` 後の loop で `max_tokens=512` に制限
  - prompt cache 活用 (cachedPart に metric カタログ + project knowledge)
  - LP 別 / 日別データを `collect.ts` で並列取得
  - Anthropic API loop=1 の TTFB が 100 秒級になる現象を確認 (`scripts/advisor-latency-trace.ts`)

**ユーザーから次セッションへの依頼**:

> 「**google gemini の canvas 機能**を想定していたのだが、google gemini の canvas 機能の仕様、
> LLM の役割分担やフローなどを調査、さらに**最新の LLM の canvas の仕様や LLM のレスポンスを早める方法**
> なども調査してから、検証してほしい」

### 🔴 タスク (順番に)

1. **調査フェーズ** (コード変更前)
   - **Google Gemini の Canvas 機能** の仕様を調査:
     - チャットと Canvas の役割分担はどうなっているか
     - 編集中のドラフトを Gemini が読み書きする仕組み (差分送信?全送信?)
     - レスポンス速度の体感 (Gemini Canvas は早いと言われている)
   - **OpenAI の Canvas (ChatGPT Canvas)** も比較対象として調査
   - **Claude Artifacts** との違い
   - **「LLM のレスポンスを早めるテクニック」** の最新ベストプラクティス:
     - prompt cache / context caching
     - tool 呼び出しを減らす設計 (1 ターンで完結させる)
     - streaming で先に体感速度を出す方法
     - モデル選択 (Haiku 4.5 / Gemini Flash / GPT-4o mini など)
     - 並列ツール呼び出し vs 直列
     - 出力 schema の制約で Claude の思考時間を削る方法
     - 部分更新 (差分 JSON) で出力トークンを削る方法

2. **比較フェーズ** (現状の TASTAS Advisor の実装と並べて)
   - 現状: [REPORT_FEATURE.md](./REPORT_FEATURE.md) §1 アーキテクチャ参照
   - Anthropic で対話 + 要件固め + skeleton 生成 → Gemini で本文生成 という構成
   - どこで何秒かかっているかを調査 (`scripts/advisor-latency-trace.ts`)
   - Gemini Canvas のような「Gemini 1 つで完結させる」設計に切り替えるべきか比較検討

3. **検証フェーズ** (調査結果を踏まえてユーザーと議論)
   - 改善案を 2〜3 個 + トレードオフを提示
   - ユーザーと議論して方向性決定
   - その後実装に入る

### 📊 直近のパフォーマンスログ (参考)

```
loop=1 ttfb=122444ms (約 2 分) — get_report_draft 実行後
loop=1 ttfb=117175ms (約 2 分) — update_report_draft 実行後
```

ツール後の最終 text 生成 (loop=1) で Anthropic API が **100 秒級の TTFB** を返してくるのが
最大のボトルネック。Anthropic 側の問題か、こちらのプロンプト構造の問題かは未特定。

### 🧭 計測ベースで動く方針 (2026-05-03 セッション開始時に合意)

「速くなったはず」の推測ではなく、**Step 1: 計測整備 → Step 2: 仮説検証 → Step 3: 対策投入**
の順で進める。Step 1 でも仮説 (cache 破壊 / API 側遅延 / tools cache 漏れ) のうち
どれが正解かを切り分けてから対策を選ぶ。

#### Step 1 の判定基準 (計測結果が出たら次の Step を決める)

| 計測結果 | 解釈 | 次の Step |
|---|---|---|
| loop=1 で `cacheReadInputTokens >= 27,000` | system prompt の cache 自体は効いている | Step 4 (固定文短絡) を検討 — Anthropic API 側の TTFB 問題 |
| loop=1 で `cacheReadInputTokens` が 0 か数百 | system prompt cache が破壊されている | **Step 2 (skeleton を messages 末尾に移動)** に進む |
| loop=0 の `ttfbMs` が既に長い (10s+) | 初回から遅い = tools 配列の cache 漏れ等 | tools 配列に `cache_control: ephemeral` 追加を先に試す |

#### Step 1 の検証実験プロトコル

- Anthropic API 残高補充後、**同じ操作 (例: 「LP5 まで足して」) を 3 回連続実行**
- 中央値で評価 (最大値・最小値は外れ値の可能性)
- 1 回の TTFB だけで「改善した」と判断しない (Anthropic API 側のたまたまの揺れ対策)
- 各 Step 投入後も同様に 3 回計測 → 中央値比較

### 📝 直近の関連変更 (2026-05-02 セッションでの実装)

すべて [REPORT_FEATURE.md](./REPORT_FEATURE.md) に最新仕様を反映済み。
セッションログの「2026-05-02」エントリも参照。

---

---

## 1. 現在のステータス Snapshot

| 項目 | 状態 |
|------|------|
| Anthropic API キー | ⚠️ 残高切れ発生 (2026-05-02 ユーザー側でクレジット補充必要) |
| ローカル DB スキーマ反映 | ✅ Docker Postgres に反映済み (`original_request` / `skeleton_markdown` 含む) |
| ローカル動作確認 | ✅ 一通り動作 (ただし Canvas レポート機能の応答速度に問題あり) |
| 進捗インジケータ (heartbeat) | ✅ Claude Code 風 (経過秒数 + tokens) |
| チャット履歴一覧 | ✅ `/system-admin/advisor/history` |
| 設定ページ (v2) | ✅ `/system-admin/advisor/settings` |
| チャット内テーブル表示 + コピー (v2) | ✅ |
| GA4 接続 | ✅ `query_ga4` |
| Supabase Management API | ✅ |
| 本番 Supabase 読み取り専用接続 | ✅ |
| **Canvas ドラフト本体機能** (2026-05-02) | ✅ ローカル動作確認済み |
| **Canvas レポート機能の応答速度** | ❌ 表 2 行追加で 2 分かかる現象あり (次セッションで調査) |
| ステージング DB スキーマ反映 | ⏸️ 未反映 (`original_request` / `skeleton_markdown` 含めて要 push) |
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

### 🟢 将来課題: Advisor TTFB 問題 — サーバー組立短絡 (案 A) の検討

**現状**: 保留中。Gemini Canvas 連携で重い処理を外出しする方針に転換 (2026-05-03)。

**背景**: System Advisor の Canvas でレポートドラフトを作成・修正する際、
loop=1 (ツール実行後の最終応答) で TTFB 90〜130 秒が頻発する問題があった。

**確定した真因 (2026-05-03 のジッター分析より、`scripts/advisor-jitter-analysis.ts`)**:
- 遅い 7 件すべてが loop=1
- cacheRead 中央値 60,898 tokens (キャッシュは効いている)
- cacheCreate 中央値 493 tokens (完全な再書き込みではない)
- 速かった 2 件 (TTFB 1〜2 秒) は同一セッション内の連続リクエストのみ
- → Anthropic 側のロードバランサーがキャッシュ KV を持つノードと
   別ノードにルーティングし、リハイドレーション (中央ストアから VRAM への
   物理転送) で 90〜130 秒待たされている
- → こちら側では制御不能

**検証で否定された仮説**:
- 仮説 B (TTL 5 分切れ): cacheCreate 中央値 493 tokens、完全再計算なら 50K+
- 仮説 C (ランダム揺らぎ): 7 件全て loop=1 に集中、ランダムなら散らばる
- Sonnet 4 → Sonnet 4.6 切替: 効果なし
- thinking: { type: 'disabled' } 明示: 効果なし
- prompt cache 化、dynamic prompt 化、max_tokens 制限: 効果なし

**短絡対策案 (案 A) の概要**:
update_report_draft ツールの実行後、loop=1 を呼ばずにサーバー側で
fields_updated 配列から動的メッセージを組み立てて短絡する。
以前ユーザーが「機械的」と却下した固定文短絡を、fields ベースの
動的メッセージで再設計したもの。

**短絡対策案 (案 A) のメリット**:
- ドラフト作成・修正の TTFB が 100 秒 → 2 秒に劇的改善
- 1〜2 日で実装可能
- 「機械的」問題を fields ベース動的メッセージで回避

**短絡対策案 (案 A) のデメリット (保留理由)**:
- 短絡対象が update_report_draft のみで、データ調査系チャット
  (query_metric 等) の loop=1 では依然として 100 秒の地雷が残る
- 部分対策に終わる
- 全ツールの loop=1 を短絡すると LLM の自然な応答が失われる

**再検討トリガー**:
- データ調査系チャットで loop=1 100 秒問題が深刻化した時
- Gemini Canvas 連携で吸収しきれない頻繁な遅延が発生した時
- Service Tier Priority 契約を検討する前段の選択肢として

**関連設計メモ**:
案 A 実装時のメッセージ生成方式 (fields ベース動的):
- 初回ドラフト → 「Canvas にレポートドラフトを作成しました...」
- skeleton_markdown 更新 → 「ドラフト本体を更新しました」
- 複数フィールド更新 → 「タイトル、アウトラインを更新しました」
- FIELD_LABELS マッピング: title→タイトル, goal→目的, range_start→期間 (開始), etc.

実装着手時は、過去の検討内容を踏まえて再設計する。

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

### 2026-05-06: hub-platform 連携 (handoff-bundle 作成 + 追加バグ報告対応 + 機能 3/8 採用 + Anthropic キー同期問題)

#### 経緯
ユーザー指示で SaaS 切り出し再開 → hub-platform への移送パッケージ作成 →
hub-platform 側 LLM が機械変換した過程で発見した **追加バグ報告 (旧 8 件 + 新 11 件)** に
対して TASTAS 側が確認 / 修正実施 → 機能追加提案 8 件のうち採用 3 件を実装。
最後に Anthropic API キーの hub-platform 側不一致問題が発覚。

#### 主な作業

##### 1. hub-platform 移送パッケージ作成 (`docs/system-advisor/handoff-bundle/`)
- 122 ファイル / 1.3MB の完全移送パッケージ
- 入口 4 ファイル + 仕様書 9 + ナレッジ 8 + コード ~70 + スキーマ 2 + 環境構築 9 + 統合相談 1
- 粒度最大の **`06_UI_BEHAVIOR_SPEC.md`** (691 行): Canvas / チャット / 履歴 / 公開ページの全ボタン / 色 / 文字 / 状態遷移
- ナレッジ系 (`DESIGN_DECISIONS` / `ANTI_PATTERNS` (16 件) / `BUG_FIX_PLAYBOOK` (18 エピソード))
- 主要コード冒頭に `@spec` アノテーション付与 (14 ファイル)
- 再生成スクリプト `scripts/build-advisor-handoff.sh` (機械生成部分は冪等に再生成可能)
- ユーザーが手動で `hub-platform/scratch/advisor-import-2026-05-04/` にコピー済

##### 2. 旧版バグ報告 8 件への対応 (1 次)
hub-platform 側 LLM の Antigravity 監査結果と機械変換時に発見されたバグの集約。

| # | バグ | 結果 | 対応 |
|---|---|---|---|
| 1 | status='generating' 張り付き | 該当 | `generate.ts` を全体 try/catch でラップ + catch-all で saveDraftError |
| 2 | upsertDraft 部分更新破壊 | 非該当 | Prisma の upsert API は構造的に安全 (Supabase `.upsert()` 機械変換時のみ発生) |
| 3 | `[object Object]` エラー | 該当 | `throw e` → `throw new Error(...)` で必ず Error クラスでラップ |
| 4 | Markdown table 表崩れ | 該当 | `normalizeMarkdown` 共通ヘルパー新設 + 4 ファイルで使用 |
| 5 | 型不整合 | 非該当 | TASTAS は Prisma 継続なので無関係 |
| 6 | 公開シェア URL 認証 | 非該当 | middleware に `/advisor/r` 既登録済 |
| 7 | プロジェクト固定概念 | 非該当 | TASTAS は単一サービス前提 |
| 8 | ダークモード未対応 | 非該当 | 他画面が未対応のため統一性で見送り |

##### 3. 新版バグ報告 (2 次、機能追加報告に同梱) への対応
| # | バグ | 結果 | 対応 |
|---|---|---|---|
| 9 | GitHub repo env 全部必須 silent fail | 該当 | [github-source.ts](src/lib/advisor/knowledge/github-source.ts) — env 全部必須を解除、default 値 (`ichiro0712-dotcom` / `share-worker-app`) + anonymous fallback、`getGithubAccessLevel()` 公開関数追加、`buildGithubHeaders()` で token 有無別ヘッダー |
| 10 | `process.env.X!` non-null 強制 | 該当 (1 ファイル 3 箇所) | [search-codebase.ts](src/lib/advisor/tools/core/search-codebase.ts) — non-null 削除、`?? GITHUB_TOKEN` fallback、execute() 内 null チェック |
| 11 | Gemini SDK Content[] 型不整合 | 非該当 | TASTAS は Gemini Function Calling 未実装 (機能 1 採用時に対応) |

##### 4. 機能追加 8 件の評価と採用
ユーザー判断:
- **機能 1 (Gemini Tool Use)**: 保留 → NEXT_SESSION.md §7.1 に「将来 TODO」として記録 (着手 trigger: Anthropic 月使用額 $200+ 到達)
- **機能 2 (プロジェクト複数選択)**: 不要 (TASTAS は単一サービス)
- **機能 3 (semantic_memory cron)**: ✅ 採用 → 実装完了 (詳細下記)
- **機能 4 (Integration カタログ SoT 化)**: 不要 (連携が固定)
- **機能 5 (業務領域データツール群)**: 不要 (既に 19 ツール完備)
- **機能 6 (ダークモード)**: 不要 (他画面未対応)
- **機能 7 (サイドバー動線)**: 不要 (ユーザー判断)
- **機能 8 (チェックリスト文書)**: ✅ 採用 → [docs/system-advisor/FEATURE_ADDITION_CHECKLIST.md](./FEATURE_ADDITION_CHECKLIST.md) (13 章) 作成

##### 5. 機能 3 (semantic_memory cron) Phase 1 実装

**目的**: しおり (`bookmarked=true`) 付きセッションの最新レポートを自動取り込みし、
新しいチャットで「先月のレポートで言ってた○○」のような文脈依存質問に
LLM が答えられるようにする。

**実装内容**:
- 新規スキーマ `AdvisorSemanticMemory` ([prisma/schema.prisma](../../prisma/schema.prisma))
  - `(admin_id, category, source_type, source_id)` UNIQUE
  - ローカル Docker DB に push 済み
- 新規 persistence `src/lib/advisor/persistence/semantic-memory.ts`
  - `upsertSemanticMemory` / `getRecentSemanticMemory` / `deleteSemanticMemoryBySource`
  - 8,000 字 truncate
- 新規 cron `app/api/cron/advisor-semantic-ingest/route.ts`
  - vercel.json に登録 (`30 19 * * *` UTC = 毎日 04:30 JST、advisor-cleanup の 30 分後)
- system prompt 埋め込み `src/lib/advisor/system-prompt.ts` `renderSemanticMemoryBlock`
  - dynamicPart に最新 5 件のレポート要約を埋め込み

**STAGING_DEPLOY_REQUEST.md 更新済**:
- 新規 DB テーブル数: 10 → 11
- STEP 1 dry-run 期待出力に `advisor_semantic_memory` 追加
- STEP 7 cron 2 種類 → **3 種類** に拡張 (advisor-knowledge-sync / advisor-cleanup / advisor-semantic-ingest)
- 完了報告フォーマット / ロールバック SQL / トラブルシューティングも更新

##### 6. Anthropic API キー同期問題 (発覚、未解決)

hub-platform 側 dev で `401 invalid x-api-key` エラー発生。
指紋テスト (length + 先頭 14 字 + 末尾 6 字) で照合した結果:

| 項目 | TASTAS (動作中) | hub-platform (401) |
|---|---|---|
| length | 108 | 108 |
| head | `sk-ant-api03-y` | `sk-ant-api03-v` |
| tail | `dobwAA` | `_29AAA` |

→ **完全に別キー**。TASTAS 側でキーローテーション後、hub-platform 側に追従しなかった。

**対応** (ユーザー手動):
- TASTAS の `.env.local` の現役キーを hub-platform `.env.local` および本番 Vercel env に手動同期
- 詳細手順は hub-platform 側 LLM が提示済 (`read -s` で安全投入)

**根本原因の運用課題**:
TASTAS と hub-platform の Anthropic キー共有 (§15「A. 共有継続」決定) には
**自動同期メカニズムが無い**。今後 TASTAS 側でローテートした時、hub-platform 側も
手動で更新する運用が必須。
将来対応案: 共有 vault (1Password チーム / Vercel チーム共有 env) 導入

#### 変更ファイル

**bug fix (5 ファイル)**:
- ✏️ `src/lib/advisor/reports/generate.ts` (バグ 1, 3 修正)
- ✏️ `src/lib/advisor/markdown-normalize.ts` (バグ 4 — 新規)
- ✏️ `src/components/advisor/chat/{unified-message,chat-message}.tsx` (バグ 4)
- ✏️ `src/components/advisor/report/report-canvas.tsx` (バグ 4)
- ✏️ `src/components/advisor/reports/report-detail.tsx` (バグ 4)
- ✏️ `app/advisor/r/[token]/page.tsx` (バグ 4)
- ✏️ `src/lib/advisor/knowledge/github-source.ts` (バグ 9)
- ✏️ `src/lib/advisor/tools/core/search-codebase.ts` (バグ 10)

**新機能 (5 ファイル)**:
- ✏️ `prisma/schema.prisma` (`AdvisorSemanticMemory` 追加)
- 🆕 `src/lib/advisor/persistence/semantic-memory.ts`
- 🆕 `app/api/cron/advisor-semantic-ingest/route.ts`
- ✏️ `vercel.json` (cron 登録)
- ✏️ `src/lib/advisor/system-prompt.ts` (`renderSemanticMemoryBlock` 追加)

**ドキュメント (5 ファイル)**:
- 🆕 `docs/system-advisor/handoff-bundle/` 配下 122 ファイル
- 🆕 `scripts/build-advisor-handoff.sh`
- 🆕 `docs/system-advisor/FEATURE_ADDITION_CHECKLIST.md`
- ✏️ `docs/system-advisor/STAGING_DEPLOY_REQUEST.md`
- ✏️ `docs/system-advisor/NEXT_SESSION.md` (§7 将来 TODO)

#### 検証
- TypeScript: `npx tsc --noEmit` exit=0
- ローカル DB: `advisor_semantic_memory` テーブル作成確認済
- TASTAS Anthropic API: `curl` テストで HTTP 200 (キー生存確認)

#### 学び・注意点

- **指紋テスト (length + head + tail)** は実値露出ゼロで秘密値の同一性を判定できる手法。秘密管理に有効
- **Antigravity の指摘は本物 / 誤指摘の検証が必須**: 1 次 6 件中本物 1 件、2 次 + 機能報告 11 件中本物 5 件 (実コード確認しないと誤情報が紛れる)
- **Prisma upsert は安全、Supabase upsert は危険**: `update: {}` に空オブジェクト + 条件 spread すれば正しい部分更新だが、Supabase の `.upsert()` API は payload 全体を update するので別物
- **キー共有運用には同期メカニズムが必須**: 「共有する」と決めただけでは事故になる
- **handoff-bundle のような物理パッケージ**は LLM 越境連携で「コードと仕様とナレッジを一緒に渡す」構造として有効。ScripT で再生成可能にすると陳腐化を防げる
- **JST 境界処理は SQL 化しない方針が改めて妥当**: query-metric の SQL 化を検討した時、JST 変換ミスで数値ズレ事故になりうるため take=100k OOM ガードのみ採用

---

### 2026-05-04 (4): Antigravity 監査レポート検証 + バグ修正 3 件採用

#### 背景

Antigravity (1 次 + 2 次ディープダイブ) から監査レポート [AUDIT_REPORT_2026-05-04.md](./AUDIT_REPORT_2026-05-04.md) を受領。
Claude Code が各指摘を実コードと突き合わせて検証 → 採用判断 → 修正を実施。

#### 検証結果 (指摘 6 件)

- **本物のバグ 1 件 (P0)**: #9 Context Freeze (`asc + take:100` で最古 100 件しか取れない)
- **本物だが将来課題 1 件 (P1)**: #11 query-metric の in-memory 集計 (現状 OOM 未発生だが規模拡大時にリスク)
- **本物だが既存対策で実害なし 1 件 (P1)**: #1 ポーリング (`editing` / `draftEdit` で停止対策済み、SSE 化が本来解だが大規模)
- **誤指摘 / 既存判断 3 件**: #2 (撤去済み判断) / #3 (audit は metadata のみで二重保存ではない) / #10 (cost guard は呼ばれている)

→ Antigravity の監査精度: **本物のバグは 6 件中 1 件**。誤指摘や既存判断見落としが多い。「指摘の有無」ではなく「指摘が本物か」を実コードで突き合わせる工程が必須。

#### 採用した修正 3 件

##### Fix #9: Context Freeze バグ
- ファイル: `src/lib/advisor/persistence/messages.ts`
- `getRecentMessagesForOrchestrator` の `orderBy: 'asc'` → `'desc'` + 取得後 `rows.reverse()`
- 100 メッセージ超のセッションで最新指示が LLM に渡るようになる
- リスクほぼゼロ (本来あるべき状態への修正)

##### Fix #1: ポーリング軽量化 (段階的ポーリング)
- ファイル: `src/components/advisor/report/report-canvas.tsx`
- アクティブ時 (chatPhase / chatLoading / generating / draft.status='generating') 2 秒
- idle 時 8 秒
- **「ポーリング停止」は絶対にしない**設計。最悪 8 秒以内に必ず最新化される
- 「Claude が更新したのに反映されない」UX バグの混入を回避

##### Fix #11: 日別集計の OOM ガード
- ファイル: `src/lib/advisor/tools/tastas-data/query-metric.ts`
- `aggregateByDay` の `findMany` に `take: 100_000` 追加
- 超過時は `truncated: true` を data + metadata に流して LLM に明示
- **JST 変換ロジックは完全保持**。Postgres 側集計への書き換えは JST 境界で数値ズレ事故になりうるため、保守的に件数上限のみ追加
- 数値の正確性: `total` は `count()` で常に正確。日別 rows のみ truncated 時に不完全

#### ユーザー確認

ユーザーから明示的に「リスクとわかっているところは丁寧に進めて」と指示があり、以下を遵守:
- Fix #1 はポーリング停止条件を全マップ ([report-canvas.tsx:215-218, 268, 275-284](../../src/components/advisor/report/report-canvas.tsx)) してから安全な段階的ポーリングに変更
- Fix #11 は SQL 書き換え案を一度検討した後、「JST 境界処理の事故リスクが高い」と判断して `take` 上限のみの保守案に切り替え

#### TypeScript / 動作確認

- `npx tsc --noEmit` → エラーなし
- 動作確認は dev サーバ起動なしで静的解析のみ (Auto モード方針)

#### 変更ファイル

- ✏️ `src/lib/advisor/persistence/messages.ts` (5 行追加 / Context Freeze 修正)
- ✏️ `src/components/advisor/report/report-canvas.tsx` (10 行追加 / 段階的ポーリング)
- ✏️ `src/lib/advisor/tools/tastas-data/query-metric.ts` (8 行追加 / OOM ガード + truncated 流し)
- ✏️ `docs/system-advisor/AUDIT_REPORT_2026-05-04.md` (検証マトリクス + 採用 3 件の追記)
- ✏️ `docs/system-advisor/HANDOFF.md` (本セッションログ追記)

#### 学び・注意点

- **監査レポートは検証なしで信じない**: Antigravity の「クリティカル 3 件発見」のうち 2 件は誤指摘 (実コードを読まずに憶測で書いていた)。レポートを取り込むなら必ず Claude Code 側で実コード確認するワークフローを必須化すべき
- **「やった方がいいものは全部」の判断軸**: ユーザーから「リスクや作業量以外のコストは？」と問われ、各修正の副作用 (トークン増 / 数値ズレ事故 / UX バグ混入) を整理して提示 → 結果として採用すべきものを明確化できた
- **JST 境界処理は触らない方針が正解**: query-metric の SQL 化を一度検討したが、「数値ズレ事故 > パフォーマンス改善効果」と判断し take 上限のみの保守案に変更。本番分析の数字が変わるリスクを避けた
- **ポーリング停止は絶対やらない**: 「停止する条件」を作ると必ずどこかでバグるので、「常に回す + 間隔だけ伸ばす」が安全

---

### 2026-05-04 (3): ドキュメント最新化 (前セッション持ち越し分の解消)

#### 背景

前セッション (2026-05-04 (2)) で時間切れになっていた以下を解消:
- `architecture.md` / `tools-spec.md` / `data-model.md` の最新化 (share_token / shared_until / bookmarked / metric_keys / original_request / skeleton_markdown / advisor-cleanup cron / Gemini バイパス等の反映)
- `STAGING_DEPLOY_REQUEST.md` の schema 追加分 + cron + 動作確認項目の更新

並行して Antigravity 監査 (オプション A) はユーザーが [04-comprehensive-audit.md](./antigravity-tasks/04-comprehensive-audit.md) を渡せば開始できる状態に置いてある。

#### 更新したファイル

##### `docs/system-advisor/data-model.md` (全面書き換え)

- Phase 1 時点の 6 テーブル想定 → 現状の 10 テーブル + カラム追加履歴を完全反映
- `AdvisorChatSession.bookmarked` (しおり) を追加、cron 用 index `(bookmarked, updated_at)` も明記
- `AdvisorReportDraft` の `metric_keys` / `original_request` / `skeleton_markdown` を反映
- `AdvisorReportVersion` の `share_token` / `shared_at` / `shared_until` (公開シェア URL) を反映
- `AdvisorSavedPrompt` / `AdvisorSettings` を新規追加
- `AdvisorAuditLog.payload.kind` の `report_*` プレフィックス運用 (cron 削除分類用) を明記
- 保持期間ポリシー (KNOWLEDGE.md §6-bis) と整合する §6 を追加
- 全カラム解説に「なぜそのカラムがあるか」「どう運用するか」を加筆

##### `docs/system-advisor/architecture.md` (全面書き換え)

- Phase 1 時点の Anthropic 単独構成 → 現状の Anthropic + Gemini バイパス併用構成へ
- `[TOOL:report_create|draft_revise|result_edit]` の hidden hint 経由 Gemini 直叩きフロー (§3.2)
- レポート本文生成 (`/api/advisor/report/generate`) のパイプライン詳細 (§3.3)
- 保持期間 cron (`/api/cron/advisor-cleanup`) の処理シーケンス (§3.5)
- 公開シェアページ (`/advisor/r/[token]`) の RSC ベース処理 (§3.6)
- ToolRegistry 19 個 (Core 5 + TASTAS Data 5 + External 5 + Future 2 + Reports 2) の正確な内訳
- `query_search_console` 追加 / `list_available_metrics` 廃止 / `get_report_draft` 廃止を反映
- Gemini フォールバック撤去の理由 (KNOWLEDGE.md §1.2 と整合)
- ディレクトリ構成も実際のファイル配置に合わせて全面更新

##### `docs/system-advisor/tools-spec.md` (全面書き換え)

- ツール 18 → 19 の差分明記 (`query_search_console` 追加、`list_available_metrics` 廃止)
- `update_report_draft` / `edit_report_section` の現行 input schema を転記
- カテゴリに `reports` / `future` を追加 (`ToolCategory` の現行型に合わせる)
- 廃止された設計判断 (§1.4) を明示し、混乱回避
- 「ツールと Gemini バイパスの関係」を §8 として独立節化
- READ ONLY tx + advisor_readonly ロールの二重防御を §5 で再確認

##### `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` (差分追加)

- STEP 1 dry-run の期待結果に **`bookmarked` 1 個 + ドラフトに 3 個 + バージョンに 3 個 = 計 7 ADD COLUMN + 2 CREATE INDEX** を明記
- STEP 6 動作確認に項目 21-25 (公開シェア / しおり / 保持期間バナー) を追加
- STEP 7 を 2 つの cron (`advisor-knowledge-sync` + `advisor-cleanup`) 対応に拡張
  - `advisor-cleanup` は vercel.json に既登録 (`0 19 * * *` UTC = 04:00 JST) を明記
  - `advisor-knowledge-sync` は vercel.json 未登録、運用判断で追加検討と注記
- 「Chat に送信」削除 (2026-05-04) を反映
- トラブルシューティングに共有 URL 関連 4 項目 + cron 関連 2 項目を追加

#### 変更ファイル

- ✏️ `docs/system-advisor/data-model.md` (270 → 約 350 行、全面書き換え)
- ✏️ `docs/system-advisor/architecture.md` (419 → 約 400 行、全面書き換え)
- ✏️ `docs/system-advisor/tools-spec.md` (398 → 約 320 行、全面書き換え)
- ✏️ `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` (差分追加、474 → 約 510 行)
- ✏️ `docs/system-advisor/HANDOFF.md` (本セッションログ追記)

#### 学び・注意点

- **「正本はコード」原則を全ドキュメントの冒頭に明記**: schema.prisma / registry.ts に齟齬があったらコードを正とする旨を毎ドキュメントの冒頭に書いた。これでドキュメント rot による混乱を回避
- **architecture.md は ASCII 図が陳腐化しやすい**: テーブル一覧 / フロー図 / ディレクトリ構成は変更時にすぐ rot する。今回は実コードを grep / find で確認してから書いたので正確性 > 推測の優先順位を維持
- **STAGING_DEPLOY_REQUEST.md は「dry-run 期待出力」が一番大事**: ここの DDL リストが古いと作業者が破壊的 SQL を見逃すリスクがある。schema 変更のたびに必ずここを更新する運用にする
- **REPORT_FEATURE.md は本セッションでは触らず**: 既に十分詳細に書かれている (498 行)。architecture.md から相互参照する形にして責務分担を明確化

#### 残課題

- ✏️ `security-cost.md` も保持期間 cron / Gemini コスト試算反映の要更新 (本セッションでは時間配分上スキップ)
- ✏️ `system-prompt.md` の最新化 (METRIC_CATALOG 静的埋め込みの仕組み等が反映されているか要確認)
- 上記は次セッション以降に持ち越し

---

### 2026-05-04 (2): Canvas UI 全面リデザイン + サイドバー折り畳み + 楽観的 UI + Antigravity 監査依頼書

#### Canvas UI 改修 (Gemini Canvas 風に刷新)

- **角丸カード化**: Canvas を `rounded-xl border shadow-sm` で囲み、外側に `bg-slate-100 p-2.5` の余白で「浮かぶカード」レイアウト
- **ヘッダー 1 行に集約**: タイトル / タブ / バージョン / アクションボタン群 / その他 (⋯) / 閉じる
  - タイトルは 10 文字超で `…` で切り詰め
  - draft / result タブは選択中のみ色付け (draft=赤、result=青)
  - バージョンドロップダウンはタブの右に配置
- **状態専用ヘッダー**:
  - 編集中: `[✕ キャンセル] [✅ 保存]` のみ
  - **drafting / updating / generating すべて**: `⏳ ○○中... + 中止` の単一ヘッダー (青いバナーは全廃止、ヘッダーで統一)
- **ボタン整理**:
  - draft 表示時: `✏️ 編集` + `[✨ レポート作成]` (黒背景、テキスト付き primary)
  - result 表示時: `✏️ 編集` + `[🔄 レポート更新]` + `🔗 共有` + `⋯` + `✕`
  - フッター完全廃止 (ヘッダーに集約)
- **手動編集**: ヘッダーの ✏️ ボタンで DraftBodyView の編集モードを ON/OFF (state を Canvas に持ち上げ)
- **しおり**: ヘッダーから ⋯ メニュー内に移動 (保持期間情報の真下)
- **その他メニュー (⋯)**: 保持期間 → しおり → 削除 の順
- **アイコンボタンに `<span title>` ラップ**: disabled 時もマウスオーバーで tooltip 表示

#### チャットサイドバー折り畳み

- 開いている時: ヘッダーに `<` トグルボタン追加
- 閉じた時: 36px の細い縦バーに変身 (展開ボタン + 新規 chat アイコン)
- **Canvas が「閉→開」遷移したタイミングで自動折り畳み** (`prevCanvasOpenRef` で 1 回だけ発火)

#### Canvas / チャット幅調整

- Canvas デフォルト幅: 720px → 900px → **960px**
- リサイズハンドル: 透明 (背景と同色) → hover で青、ドラッグで濃い青 (`w-1.5 bg-transparent hover:bg-blue-400/60`)

#### 楽観的 UI (中止ボタンの即時表示)

- 早期 return (`!sessionId` / `loading && !draft` / `!draft`) を 1 つに統合
- `optimisticActive = chatPhase !== 'idle' || chatLoading` で「ドラフト作成中... + 中止」をヘッダーに即時表示
- ReportCanvas の新規 prop:
  - `onCancelChatStream?: () => void` (chat-layout の `handleAbort` を渡す)
  - `chatLoading?: boolean`
- 中止ボタンが drafting / updating でも有効化 (SSE ストリーム abort)

#### TOP のチップに「ログを集計してレポート生成」追加

- 初回チャット画面の suggestion チップに 4 番目を追加
- クリック → ChatInput に `report_create` ツールを選択 + テンプレ文章を入力欄にプリフィル (送信はしない)
- 仕組み: ChatInput に `prefill?: { toolId, text, nonce }` prop 新設、`useEffect([input])` で textarea の自動リサイズも合わせて実行
- 送信時に `setChatPrefill(null)` でクリア (ChatInput 再マウント時の重複適用バグ対応)

#### Markdown 箇条書き表示の修正 (再掲)

- `app/globals.css` の `*` リセット + Tailwind preflight + `@tailwindcss/typography` 未導入で `<ul>` の bullet が消える問題
- 各 ReactMarkdown の `components` で `ul` / `ol` / `li` / `table` を明示スタイル化
- 影響: report-canvas / unified-message / report-detail / 公開シェアページ

#### 「Chat に送信」機能の完全撤去 (再掲)

- ボタン削除、`/api/advisor/report/notify-gchat` 削除、`src/lib/advisor/reports/notify-google-chat.ts` 削除

#### Antigravity 徹底監査依頼書を作成

- `docs/system-advisor/antigravity-tasks/04-comprehensive-audit.md` を新規作成
- 監査の柱 8 つ: Canvas/Agent 仕様の最新性 / バグ / 無駄コード / 非効率設計 / トークンコスト / 速度 / UI/UX / その他
- 外部リサーチ (Gemini Canvas / ChatGPT Canvas / Claude Artifacts / MCP / prompt cache) を最初に実施するよう指示
- 成果物フォーマット (P0/P1/P2 重大度 + 証拠 + 修正案) を厳密に規定
- CLAUDE.md ルール (デプロイしない・push しない・本番 DB 触らない) のチェックリスト含む

#### 変更ファイル (主要)

- 🆕 `docs/system-advisor/antigravity-tasks/04-comprehensive-audit.md`
- ✏️ `docs/system-advisor/antigravity-tasks/README.md` (タスク一覧に 04 追加)
- ✏️ `src/components/advisor/report/report-canvas.tsx` (大規模リデザイン、~1700 行)
- ✏️ `src/components/advisor/chat/chat-layout.tsx` (サイドバー折り畳み、suggestion 拡張、prefill state)
- ✏️ `src/components/advisor/chat/chat-input.tsx` (prefill prop 追加)

#### 学び・注意点

- **状態専用ヘッダーの統一は読みやすさ激変**: 「青い帯が複数」→「ヘッダー 1 個」で UI ノイズ激減
- **楽観的 UI は早期 return 統合とセット**: 3 つに分散していた早期 return ロジックを 1 つに統合してから `chatPhase` を最優先で見る形にしないと、ラグが目立つ
- **ChatInput の prefill バグ**: 送信時に `chatPrefill=null` クリアしないと、ChatInput が `key={conversationId}` で再マウントされた瞬間に再適用される (key の罠)
- **disabled 状態の tooltip**: `<button disabled title>` は Chrome で表示されないため、`<span title>` でラップする必要がある (アクセシビリティ的にも `aria-label` も併記)
- **Antigravity 監査の依頼書を作る上で重要だったこと**: 「外部リサーチを必ず最初にやらせる」「証拠と再現条件を必須にする」「重大度のラベルを強制する」「監査者が手を動かして変更しないルールを明記する」 — これらが無いとレポートが推測ベースで散漫になる

---

### 2026-05-04: 公開シェア URL + しおり (永続保存) + 自動削除 cron 実装

#### やったこと

**1. レポート公開シェア URL 機能 (有効期限 30 日)**
- スキーマ: `AdvisorReportVersion.share_token` (unique) + `shared_at` + `shared_until` 追加
- 公開ページ: `app/advisor/r/[token]/page.tsx` (auth 不要、middleware の publicPaths で許可)
  - WorkerLayout 配下にあるとワーカー BottomNav が表示される問題があったため、`EXCLUDED_PREFIXES` に `/advisor/` 追加
- Server Actions: `enableShare` / `disableShare` / `extendShare` / `getShareState`
  - `enableShare`: 30 日後を `shared_until` にセット、token は `crypto.randomBytes(24).toString('base64url')`
  - `extendShare`: token 維持で `shared_until = now + 30d`
  - `disableShare`: `shared_at` / `shared_until` / `share_token` 全部 null 化
- 公開ページ表示: 「共有: {admin.name}」+ 「公開期限: あと N 日」バッジ (残日数で色変化)

**2. しおり (永続保存) 機能**
- スキーマ: `AdvisorChatSession.bookmarked` (Bool, default false) + `(bookmarked, updated_at)` index
- Server Action: `toggleBookmark` / `getSessionBookmarkState`
- UI:
  - サイドバー: bookmarked のとき amber アイコン常時表示、OFF は hover 時
  - 履歴一覧: 同上 + タイトル左に小バッジ
  - Canvas: ヘッダー右にトグル + 直下に保持期間バナー (RetentionBanner)

**3. 保持期間ステータス表示 (Canvas)**
- bookmarked: 緑「しおりマーク (永続保存)」
- 残り 7 日以上: グレー「保存期間: あと N 日」
- 残り 7 日未満: amber「⚠️ あと N 日で自動削除されます」+「しおりで永続保存する」リンク

**4. 自動削除 cron 実装**
- 新規: `app/api/cron/advisor-cleanup/route.ts`
- 動作:
  - しおりなしセッションの Draft + Versions を 30 日後に削除
  - Audit ログ 90 日 (report_* イベントは 180 日) で削除
  - 失効済み共有 URL の token / shared_at / shared_until を null 化 (掃除)
- vercel.json: `/api/cron/advisor-cleanup` を毎日 19:00 UTC (= 04:00 JST) に追加
- 認証: 既存 `ADVISOR_CRON_SECRET` を流用

**5. UI 改修: 共有メニュー集約**
- フッターの 3 ボタン (`コピー` / `編集` / `URLでシェア`) を 2 ボタン (`編集` / `共有 ▼`) に集約
- 「共有 ▼」クリックでドロップダウン: 本文コピー / URL コピー / +30日延長 / 共有停止

**6. Markdown 箇条書きが見えない問題の修正**
- 真因: `app/globals.css` の `* { padding: 0; margin: 0 }` + Tailwind preflight が `<ul>` をリセット
- `prose` クラスは `@tailwindcss/typography` 未導入なので機能していなかった
- 修正: 各 ReactMarkdown 呼び出しの `components` で `ul` / `ol` / `li` / `table` を明示スタイル化
- 影響: report-canvas / unified-message / report-detail / 公開シェアページ

**7. 「Chat に送信」機能を完全撤去**
- ボタン削除、`/api/advisor/report/notify-gchat` 削除、`src/lib/advisor/reports/notify-google-chat.ts` 削除

**8. UI 細かい改善**
- 過去のチャット (生成済みレポートあり) を開くと自動で result タブを表示 (`initialViewDecidedForSessionRef` で session 単位 1 回)
- result タブのボタン名を「レポート作成」→「レポート更新」に変更 (icon: Sparkles → RefreshCw)

**9. 公開ページから WorkerLayout 系 UI を完全に外した**
- `EXCLUDED_PREFIXES` に `/advisor/` 追加で BottomNav / PWA バナー / 通知プロンプトが消える

**10. 公開ページに共有者表示**
- `draft.adminId` から SystemAdmin の name を取得して「共有: {name}」を表示
- メールは個人情報なので非表示 (name のみ)

#### 議論で決まった保持期間ポリシー

| データ種別 | 保持期間 | 例外 |
|---|---|---|
| Chat Session / Message | 永続 | (手動アーカイブのみ) |
| Draft / Version | 30 日 | しおり付きセッションは永続 |
| Audit ログ (一般) | 90 日 | — |
| Audit ログ (report_*) | 180 日 | — |
| 共有 URL | 30 日 | 「+30日延長」で何度でも可、停止すると即失効 |

#### 学び・注意点

- **Tailwind preflight + 自前 CSS の `*` リセット + `@tailwindcss/typography` 未導入**の三重コンボで `<ul>` の bullet が消える問題は、prose 信仰だと気付きにくい。各 Markdown 描画箇所で `components` を渡すのが安全。
- **route group `(public)` は不要だった**: WorkerLayout 側に EXCLUDED_PREFIXES があるので、そこに 1 行追加するだけで済んだ。route group は最後の手段。
- **共有 URL の失効ポリシー**: 「停止 → 再有効化で同じ token」だと漏れた URL を再アクセス可能にしてしまうので、再有効化時は **新規 token** を発行するのが安全。

#### 変更ファイル

新規:
- `app/advisor/r/[token]/page.tsx` (公開シェアページ)
- `app/api/cron/advisor-cleanup/route.ts` (保持期間 cron)

スキーマ:
- `prisma/schema.prisma` (share_token / shared_at / shared_until / bookmarked)

Server Actions:
- `src/lib/advisor/actions/report-versions.ts` (enableShare / disableShare / extendShare / getShareState)
- `src/lib/advisor/actions/conversations.ts` (toggleBookmark / getSessionBookmarkState)

Persistence:
- `src/lib/advisor/persistence/report-versions.ts` (shareToken / sharedAt / sharedUntil 追加 + 失効チェック)

UI:
- `src/components/advisor/report/report-canvas.tsx` (RetentionBanner / 共有ドロップダウン / しおりトグル / Markdown components / 「レポート更新」リネーム / 初期 view 決定 / Chat送信削除)
- `src/components/advisor/chat/chat-layout.tsx` (サイドバーしおりトグル)
- `src/components/advisor/chat/unified-message.tsx` (Markdown components)
- `src/components/advisor/history/history-client.tsx` (履歴しおりトグル + Markdown components)
- `src/components/advisor/reports/report-detail.tsx` (Markdown components + remarkGfm)
- `components/layout/WorkerLayout.tsx` (EXCLUDED_PREFIXES に `/advisor/` 追加)
- `middleware.ts` (publicPaths に `/advisor/r` 追加)

設定:
- `vercel.json` (advisor-cleanup cron 追加)

ドキュメント:
- `docs/system-advisor/DEPLOY_CHECKLIST.md` (新カラム + cron 追記)
- `docs/system-advisor/HUB_PLATFORM_MIGRATION_TODO.md` (§5-bis 追加 — Phase 1 中の追加実装を Core に持っていく旨)
- `docs/system-advisor/KNOWLEDGE.md` (§6-bis 保持期間ポリシー追加)
- `docs/system-advisor/REPORT_FEATURE.md` (notify-gchat 削除)

削除:
- `app/api/advisor/report/notify-gchat/` (Chat 送信 API)
- `src/lib/advisor/reports/notify-google-chat.ts` (Chat 送信 lib)

---

### 2026-05-03 (5): hub-platform 統合方針確定 + 着手保留 (ドキュメントのみ)

#### 決まったこと

**大方針**: TASTAS Advisor の本番安定運用後に **hub-platform への統合**を実施する。
それまでは TASTAS Advisor の完成度向上に集中。

**hub-platform の現状把握 (新発見)**:
- `/Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/` は既に Turborepo モノレポ
- 7 アプリ稼働: agent-hub / project-hub / health-hub / autocast / communication-hub / mcp-server / hub
- 統合 Supabase + schema 分離 (`agent_hub.*` / `project_hub.*` / `health_hub.*` 等) でマルチテナント済み
- agent-hub に Orchestrator + 9 エージェント + Canvas + MCP が実装済み
- → 新規 SaaS リポを作るより hub-platform 統合が筋が良いと判明

**採用設計**:
```
hub-platform/
├ packages/
│  └ advisor-core/              🆕 System Advisor の汎用部品 (TASTAS から抽出)
├ apps/
│  ├ agent-hub/ (既存)            ← 統合司令塔
│  ├ sushi-hub/                   🆕 Phase 5
│  ├ band-hub/                    🆕 Phase 6
│  └ tastas-hub/ or MCP 連携       🆕 Phase 7
```

**移行順序** (8 Phase):
- Phase 1 (現在): TASTAS Advisor 完成度向上、本番安定運用
- Phase 2: 着手判断 (ユーザーから明示の Go サイン)
- Phase 3: TASTAS の Advisor 一式を hub-platform/scratch/ にコピー
- Phase 4: hub-platform 側で advisor-core 抽出
- Phase 5: sushi-hub 立ち上げ (MF 会計 1 ソース、月次 PL + 週次売上の 2 レポートだけ)
- Phase 6: band-hub 立ち上げ
- Phase 7: TASTAS を hub-platform 統合
- Phase 8: Hub 間 MCP 連携 (横串相談実装)

#### やったこと (ドキュメント整理のみ、コード変更なし)

1. **`docs/system-advisor/HUB_PLATFORM_MIGRATION_TODO.md` を新規作成**
   - 議論結論 / hub-platform 現状 / 採用設計 / 移行 8 Phase / コピーコマンド例 / README + HANDOFF_FROM_TASTAS のテンプレート
   - **TASTAS 完成後にこのドキュメントから即実行できる状態**で保存

2. **`docs/system-advisor/NEXT_SESSION.md` を更新**
   - 「次セッションで議論したい 2 大トピック」 → 「TASTAS 完成度向上 (Phase 1) に集中」に書き換え
   - 引き継ぎ完了サインの台本を更新

3. **`docs/system-advisor/SAAS_PRODUCTIZATION.md` 冒頭に確定方針注釈**
   - 「新規 SaaS リポ案は不採用、hub-platform 統合に確定」を明記
   - 当初議論内容は履歴として保存

4. **本ファイル (HANDOFF.md) のヘッダー更新**
   - 「最終更新」「大方針」を 2026-05-03 (5) に書き換え

#### 議論の経緯

ユーザーから提起:
- TASTAS 以外の事業 (寿司屋 / hubpratform / バンド) でも System Advisor が欲しい
- 「UI 1 個作れば全プロジェクトに反映」させたい
- MCP 経由で複数 Advisor が連携する未来

検討の流れ:
- 当初: 新規 SaaS リポ `advisor-platform` を立ち上げる案を出した
- ユーザーから「agenthub という hub 内エージェントが既にある」と情報提供
- hub-platform を調査 → Turborepo + 7 アプリ + 統合 Supabase + マルチエージェント実装済みと判明
- 当初案を撤回、hub-platform 統合方針へ転換

ユーザー判断: 「TASTAS のデバッグ・完成度向上が先、hub-platform 着手は後」
→ 本セッションでは **方針のドキュメント化のみ実施、コード変更なし**

#### 学び・注意点

- **「新規リポを作る」前に「既存リポをちゃんと見る」**: hub-platform の存在を最初に把握できていれば、SaaS 化議論は不要だった
- **動いているものを止めない原則**: TASTAS Advisor が安定する前に統合作業を始めない判断は正しい
- **Phase 3 の「即実行可能性」を担保**: HUB_PLATFORM_MIGRATION_TODO.md にコマンド例まで書いて、未来の自分 (or 次の Claude) が迷わず着手できる状態に整えた

#### 変更ファイル

- 🆕 `docs/system-advisor/HUB_PLATFORM_MIGRATION_TODO.md` (新規)
- ✏️ `docs/system-advisor/NEXT_SESSION.md`
- ✏️ `docs/system-advisor/SAAS_PRODUCTIZATION.md`
- ✏️ `docs/system-advisor/HANDOFF.md` (本ファイル)

**コード変更なし** (`src/` 配下は touch していない)

---

### 2026-05-03 (4): レポート機能の徹底品質改善 + データソース全展開 + Gemini Canvas 撤去

#### やったこと (15 件、徹底的にユーザーフィードバックに対応)

**1. UI バグ: Canvas のドラフトタブが空表示 → 修正**
- `{!hasResult && <DraftBodyView />}` の条件で result があるとドラフト本体が**非表示**になっていた
- 修正: view='draft' のときは hasResult に関わらず常に表示
- これでユーザーの「ドラフトが消えた」報告が解決

**2. 履歴に複数選択削除 UI 追加**
- `/system-admin/advisor/history` に「選択モード」追加 (チェックボックス + 全選択 + 一括削除)
- `deleteConversations(ids[])` Server Action 追加 (既存 `deleteConversation` の bulk 版)

**3. Gemini バイパス系の失敗時 fallback 撤去**
- 旧: Gemini 失敗 → Anthropic に流れる → loop=1 TTFB 100 秒で結局答え返らない最悪 UX
- 新: Gemini 失敗 → 即時エラー表示 (5〜10 秒で「失敗、再試行を」)
- 前提条件 NG (no draft / admin mismatch) のみ Anthropic に流す

**4. revise の同期: skeleton 変更 → 要件メタも自動更新**
- `gemini-edit.ts` の出力に `updated_data_sources` / `updated_metric_keys` / `updated_outline` / `updated_goal` / `updated_title` 追加
- skeleton で章を増やしたら → dataSources / metric_keys / outline / title / goal も同期更新
- プロンプトで「迷ったら更新する側に倒す」「null は文言修正のみのときだけ」を強化
- これで「LP_PV しか入ってないのに skeleton には流入経路ある」状態が解消

**5. result_edit (生成済みレポート編集) 経路を新設**
- `gemini-result-edit.ts` 新設、`[TOOL:result_edit]` 専用 Gemini バイパス
- Canvas タブ ('draft' or 'result') を chat-layout に持ち上げ、forcedTool を view 連動:
  - view='draft' → `draft_revise` (skeleton 編集)
  - view='result' && hasResult → `result_edit` (生成済み本文編集)
- ChatInput に「ドラフト修正指示」「レポート修正指示」が状態で切り替わる

**6. 自動「ドラフト修正 → 再生成」フロー (auto-redraft)**
- result_edit 中に「○○の表を追加」など新データ取得が必要な指示を Gemini が判定
- `redirect_to_draft=true` + `draft_instruction` を返す → orchestrator が自動で:
  1. draft_revise で skeleton 更新
  2. upsertDraft
  3. generateReport で再生成
- ユーザーは Canvas で待つだけで新バージョンが完成 (40 秒前後)

**7. Gemini に直近チャット履歴を渡す**
- `chat-history-context.ts` 新設 (直近 8 件を Markdown 整形)
- draft_revise / result_edit の両方で prompt 先頭に展開
- ユーザー指摘「Gemini はチャット読めてるの?」 → No だった → 修正
- 「さっき言った〇〇の続きで」のような文脈依存指示が動くように

**8. チャットにイベントラベル追加**
- 「📋 ドラフトを作成しました」「📝 ドラフトを更新しました」「📊 レポート v1 を生成しました」「✏️ レポート v2 を編集しました」「🔄 自動再生成しました」
- ユーザーが履歴を見たときにフローが分かる + 次回 Gemini が読む履歴にも入って文脈になる
- generate.ts でレポート生成完了時に assistant メッセージ永続化 + Canvas → chat-layout に reload callback

**9. ヘッダーバッジの動的化**
- 未生成: 赤「ドラフト」/ 生成済み: 青「レポート調整」
- ステータスアイコンとして役立つ

**10. CanvasStatusBar を動的テキスト化**
- 旧: 「レポート生成中」固定
- 新: orchestrator が SSE で送る「ドラフト更新中...」「レポート再生成中...」を `liveStatusText` で受けて表示

**11. 過去 v の編集が消える問題を修正 (最重要)**
- 真因: auto-redraft の最後の generateReport は完全新規生成 → v(N-1) で日付フォーマット直したのが消える
- 修正: generate.ts で `previousResultMarkdown` を取得して Gemini に渡す
- システムプロンプトに「**最重要ルール 1: 前回バージョンの編集スタイルを絶対維持**」追加

**12. 表ごとの集計期間を出典行に統合 + 表前置き散文を禁止**
- 注釈フォーマット: `*集計期間: ○○ / 出典: 本番 DB 指標集計 (LP_PV / LP別)*`
- 表の前置き「以下の通りです」「上位 5 件は次の通り」を禁止 (情報量ゼロ)
- ヘッダー直下の「対象期間: ○○ (JST)」固定形式も禁止 (色々なレポート形式に対応)
- データソース別の期間表記:
  - 期間集計系: `2026-04-27 〜 2026-05-03 (JST)`
  - スナップショット系: `現時点スナップショット (取得: ○○)`
  - 直近 N 期間系: `直近 24 時間`
  - 直近 N 件系: `直近 30 件`

**13. データソース全展開 (落としてた取得軸を全網羅)**
- 真因 1: query_ga4 を `overview` 1 種だけで呼んでた → `traffic` (流入経路) `pages` (ページ別) `lpPerformance` `comparison` 全 5 種に並列展開
- 真因 2: query_search_console を `[query]` 1 種 → `[query, page, device, country]` 4 種に展開
- get_supabase_logs → source 別 (postgres/api/auth) 3 種
- get_vercel_logs → level 別 (error/warning/info) 3 種
- get_vercel_deployments → env 別 (production/preview) 2 種
- 1 レポートあたりリクエスト数: 12 → 22 (Promise.all 並列なので体感速度変わらず)
- これで「流入経路データが取得できない」「ページ別検索流入が空」が解決

**14. LP_TO_LINE_CONV メトリクス実装**
- 真因: 6 箇所のプロンプトで「例: LP_TO_LINE_CONV」と書いてあった → Gemini が実在指標と誤認 → query_metric が「不明な metric_key」で弾く
- 修正: METRIC_CATALOG に実装 (LpClickEvent.button_id が `line_*` で始まるレコードを集計)
- LP 別 / 日別 / キャンペーン別 全部対応
- DB 動作確認: 全期間 37 件 (LP 7: 24, LP 3: 10, LP 5: 2, LP 6: 1)

**15. Gemini Canvas 機能を完全撤去**
- ユーザー判断: Gemini API 直叩きが安定動作するため Canvas UI 連携は重複機能
- 削除: `gemini-canvas-bridge.ts` ファイル、`saveGeminiCanvasVersion` action、`getDraftWithCollectedData` action、Canvas 内 state/UI/ボタン全撤去
- DB の `source: 'gemini_canvas'` レコードは過去データの参照互換のため型は残す

#### Phase 別効果

| Phase | 効果 |
|---|---|
| Phase A (revise バイパス) | TTFB 100s → 4〜10s |
| Phase B (create バイパス) | 同 (初回も) |
| Phase C (本セッション、品質向上) | 「動作はする」→「使い物になる」レベルへ |

#### 残課題 (次セッション)

- ✅ ほぼなし (実機テスト継続中)
- 観察ポイント:
  - LP 名が ID 数字のまま (`| LP ID 5 | 5 |`) — LandingPage テーブルから JOIN して name 取得する改修案あり (低優先)
  - 過去ドラフトに古い skeleton 形式 (出典行なし、空行なし) が残っている — 必要なら revise で「全表に空行 + 出典追加して」で再構築可

#### 変更ファイル (主要)

新規:
- `src/lib/advisor/llm/gemini-result-edit.ts`
- `src/lib/advisor/llm/chat-history-context.ts`

編集 (主なもの):
- `src/lib/advisor/orchestrator.ts` — result_edit 分岐 + auto-redraft フロー + 履歴渡し + イベントラベル
- `src/lib/advisor/llm/gemini-edit.ts` — 同期フィールド追加 + 履歴受け取り + 出典フォーマット
- `src/lib/advisor/llm/gemini-draft-create.ts` — 同上
- `src/lib/advisor/reports/generate.ts` — previousResultMarkdown / 集計期間注釈 / ヘッダー型強制禁止 / 散文禁止
- `src/lib/advisor/reports/collect.ts` — 4 系統の expand 関数追加 (search_console / supabase / vercel logs / deployments) + ga4 5 種展開
- `src/lib/advisor/tools/tastas-data/metrics-catalog.ts` — LP_TO_LINE_CONV 追加
- `src/lib/advisor/tools/tastas-data/query-metric.ts` — LP_TO_LINE_CONV 集計ロジック
- `src/lib/advisor/system-prompt.ts` — レポート作成モードセクション 140 行 → 15 行に圧縮
- `src/components/advisor/report/report-canvas.tsx` — view 通知 callback / liveStatusText / バッジ動的化 / Gemini Canvas 撤去 / DraftBodyView 表示修正
- `src/components/advisor/chat/chat-layout.tsx` — view 連動 forcedTool / messages reload
- `src/components/advisor/chat/chat-input.tsx` — result_edit ツール追加
- `src/components/advisor/history/history-client.tsx` — 複数選択削除 UI

削除:
- `src/lib/advisor/gemini-canvas-bridge.ts`

#### 学び・注意点

- **「Gemini が嘘をつく」事象は大半がプロンプトに「例」として書いた架空指標が原因**。
  例示は実在する指標だけにする (LP_TO_LINE_CONV のように一見もっともらしい架空名を出さない)
- **データソースの「能力フル展開」が collect 側でできていなかった**ことが、レポート品質低下の最大要因だった。
  ツール側に reportType / dimensions / source などの enum がある場合、レポート用 collect では
  デフォルトで全展開する設計が筋 (個別レポートで使わなくても並列なので速度影響なし)
- **「過去 v の手作業修正を継承」設計は previousResultMarkdown を Gemini に渡すだけで実現可能**。
  シンプルだが効果絶大。
- **チャット履歴を Gemini バイパスに渡してなかった**のは初期実装の盲点。stateless な単発リクエストで動かしていたため、
  ユーザーの直前の意図と不整合な編集が起きていた。直近 8 件渡すだけで文脈整合性が大幅改善。

---

### 2026-05-03 (3): 初回ドラフト作成も Gemini 直叩きに拡張 + UX 微調整 (Phase B 完了)

#### やったこと

**1. 初回 `[TOOL:report_create]` も Gemini バイパスに拡張**
- `src/lib/advisor/llm/gemini-draft-create.ts` 新設、`createDraftWithGemini()` で
  ユーザー自由文要望 → 要件 (title/goal/range/data_sources/metric_keys/outline/notes) +
  0 埋め skeleton_markdown を 1 回の JSON 出力で全部生成
- METRIC_CATALOG (available のみ) と DATA_SOURCE_OPTIONS をプロンプトに展開して
  Gemini に metric_keys / data_sources を選ばせる
- 「今日 = YYYY-MM-DD」を JST で渡して「先週」「今月」を解釈させる
- orchestrator に `tryGeminiDraftCreateBypass` を追加、`[TOOL:report_create]` 検知時に
  Anthropic ループに入らず Gemini で全工程処理 → 9.3 秒で完了 (実測値)

**2. Gemini SDK の abortSignal 伝播をやめる致命バグ修正**
- `req.signal` が Next.js streaming 応答開始タイミングで誤検知 abort を返し、
  Gemini SDK が 1.4 秒で `This operation was aborted` を投げる事象を修正
- `gemini.ts` の `ai.models.generateContent` config から `abortSignal` 削除

**3. forcedModelLabel が新規チャット送信時に発火しない問題修正**
- 条件から `conversationId` チェックを削除 (新規チャットでは送信瞬間 null)
- `canvasOpen && hasDraft` だけで判定

**4. UI/UX 微調整 3 件**
- モデルバッジを通常セレクタ風 (青枠なし、文字だけ青) に統一
- Gemini バイパス中の進捗表示が 1 回 status だけで「考え中」固まる事象を修正
  - `setInterval(5000)` で heartbeat を継続送出、try/finally で確実にクリーンアップ
- ドラフト作成プロンプトに「数字へのコメント/考察を一切書かない」を絶対遵守ルール追加
  (Gemini が「LP1 の PV は 0 で大幅減」のような 0 値解釈を勝手に書く事象を防止)

**5. SSE controller close 後の enqueue エラー静音化**
- クライアント Abort や Anthropic タイムアウト後に走る遅延処理 (heartbeat / audit / done)
  が close 済 controller に enqueue する事象 → `streamClosed` フラグで黙って捨てる
- dev log のスタックトレース連発が解消、Phase B のベンチマーク確認が読みやすく

#### Phase A → B の効果実測 (audit log より)

| 操作 | Anthropic 経由 (改善前) | Gemini 直叩き (改善後) |
|---|---|---|
| 初回 `[TOOL:report_create]` | 90〜130 秒 (loop=1 詰まり) | **9.3 秒** |
| `[TOOL:draft_revise]` | 同上 | 数秒 (Phase B 計測予定) |
| 普通の質疑応答 | Anthropic 通常 (空いてれば数秒) | (バイパス対象外) |
| データ調査 | Anthropic 通常 | (バイパス対象外) |

#### 残課題 (次セッション)

1. **Phase B 動作確認の継続** — 「LP5 まで足して」型のドラフト修正を 5〜10 回繰り返し、
   `gemini_direct_edit` の elapsed_ms 中央値を確認
2. **Phase C 評価レポート** — `npx tsx scripts/advisor-jitter-analysis.ts` で
   Anthropic vs Gemini の比較データを集計し、改善幅を数値化
3. **Phase D 検討 (要 Phase C 結果)** — Gemini Canvas UI 連携 (commit 288ce48) は
   重複機能になる可能性があるため、Gemini 直叩きが安定動作を続けるなら撤去判断
4. **forcedModelLabel の発火タイミング微調整** (低優先度) —
   ツール ▼ →「レポート作成」を選んだ瞬間 (送信前) はまだ通常モデル表示。
   送信トリガで切り替わるので実害は無いが、UX 的にはツール選択時から青文字にした方が
   親切な可能性。ChatInput → chat-layout への onToolChange callback を追加する形で実装可能。

#### 変更ファイル

新規:
- `src/lib/advisor/llm/gemini-draft-create.ts`

編集:
- `src/lib/advisor/orchestrator.ts` (tryGeminiDraftCreateBypass 追加 + heartbeat タイマー)
- `src/lib/advisor/llm/gemini.ts` (abortSignal 削除)
- `src/components/advisor/chat/chat-input.tsx` (forcedModelLabel スタイル微調整)
- `src/components/advisor/chat/chat-layout.tsx` (forcedModelLabel から conversationId チェック削除)
- `app/api/advisor/chat/route.ts` (SSE controller close エラー静音化)

#### 学び・注意点

- **`req.signal` を SDK にそのまま渡すと事故る**。Next.js のストリーミング応答開始
  タイミングで誤検知 abort が起きうる。SDK 側の AbortController 連携は要件次第で
  「あえて渡さない」方が安定するケースがある (Gemini Flash のように数秒で終わる
  リクエストではメリット < リスク)。
- **新規チャットで `conversationId` は送信時点で null**。永続化レイヤを通った後
  setConversationId されるので、UI 上の forcedTool/forcedModelLabel など同期発火が
  必要な条件には conversationId を含めない (永続化に依存しない hasDraft / canvasOpen
  だけで判定する)。
- **進捗表示は heartbeat 必須**。Gemini Flash の 5〜10 秒は Claude より速いとはいえ、
  ユーザー体感では「無音」だと固まったと感じる。Anthropic ルートと同じ heartbeat
  イベントを 5 秒間隔で送れば、Canvas 側の経過秒数表示がそのまま使える。

---

### 2026-05-03 (2): Gemini API 直叩きで [TOOL:draft_revise] をバイパス (Phase A 完了)

#### やったこと

ジッター分析で Anthropic ノードアフィニティ問題が真因と確定し、Gemini Canvas UI 連携を
実装した直後の追加施策。「Anthropic の問題なら Gemini API で構造的に解決」という
ユーザー判断で、ドラフト修正指示を Anthropic ループに入れず Gemini API で直接処理する
バイパス経路を追加。

**1. `src/lib/advisor/llm/gemini-edit.ts` 新設**
- `editDraftWithGemini()` で skeleton_markdown を Gemini Flash で書き換え
- JSON 出力強制 (`responseMimeType: 'application/json'`) + 3 段フォールバックパーサー
  (素のパース → ` ```json fence` → 最初の `{` から最後の `}` までスライス)
- 出力 shape の最低限のバリデーション (updated_skeleton 長さ等)
- `generateWithGemini()` に `jsonMode` オプションを追加

**2. `orchestrator.ts` にバイパス分岐**
- `runOrchestrator` の冒頭、ユーザーメッセージ永続化直後に
  `[TOOL:draft_revise]` を検査
- 該当時は `tryGeminiDraftReviseBypass()` を呼んで Gemini で直接編集
- 成功時: SSE で text/usage/done を送出して `return` (Anthropic に進まない)
- 失敗時: 既存の Anthropic ルートに fall through (堅牢性優先)
- audit に `gemini_direct_edit: true` + `elapsed_ms` を記録

**3. `scripts/advisor-jitter-analysis.ts` を拡張**
- `gemini_direct_edit` フラグの audit を別カテゴリで集計
- 成功時の elapsed_ms 中央値・最小・最大、失敗事例の詳細を表示
- Phase B/C のベンチマーク評価で使う

#### Gemini Canvas UI 連携 (288ce48) との関係

ハイブリッド運用で残す:
- Gemini API 直叩き (本 commit) = 自動経路、ユーザーは何もしない
- Gemini Canvas UI (288ce48) = 手動経路、ユーザーがブラウザで編集
- Phase C で Gemini API 直叩きが安定して動くと評価されたら、UI 側の撤去を判断

#### 既存の Anthropic 利用箇所 (バイパス対象外)

- 普通のチャット質疑応答
- 新規ドラフト作成 (構造化ツール選択 / metric_keys 判定が必要)
- データ調査系 (`query_metric` 等のツール呼び出し)

#### 次セッションで真っ先にやること (Phase B/C)

1. ローカル `/system-admin/advisor` で:
   - 「ツール ▼ → レポート作成」で初回ドラフト作成 (既存 Anthropic ルートで動くはず)
   - チャット欄で「LP5 まで足して」等のドラフト修正指示を 5〜10 回送信
   - audit に `gemini_direct_edit: true` が記録されているか確認
2. `npx tsx scripts/advisor-jitter-analysis.ts` で集計
3. TTFB が安定して数秒以内に収まれば成功
4. 失敗が多ければ Anthropic に戻して別対策を検討

#### 変更ファイル

新規:
- `src/lib/advisor/llm/gemini-edit.ts`

編集:
- `src/lib/advisor/llm/gemini.ts` (jsonMode オプション追加)
- `src/lib/advisor/orchestrator.ts` (バイパス分岐 + tryGeminiDraftReviseBypass)
- `scripts/advisor-jitter-analysis.ts` (gemini_direct_edit 集計)

#### 学び・注意点

- **ベンダーロックインの緩和は速度問題と直交する設計判断**。今回 Anthropic 1 ベンダー
  依存を Gemini で部分的に分散させたことで、Anthropic 側障害時の冗長性も同時に得られた
- **Gemini の構造化出力は `responseMimeType: 'application/json'` を SDK に渡すだけで効く**
  が、稀に ```json fence ``` でラップして返すケースがあるので fallback パーサー必須
- **fall through 設計が肝**。バイパスが新機能なので、失敗しても既存経路が動く形で
  堅牢性を確保 (Phase B のリスクを最小化)

---

### 2026-05-03: TTFB 真因確定 (Anthropic ノードアフィニティ) + Gemini Canvas 連携導入

#### やったこと

**1. Phase 1 計測整備 (loopTraces[] 永続化) を投入**
- `orchestrator.ts` に `LoopTrace` interface 追加。loop ごとに ttfb / stream / input/output tokens /
  cache_read / cache_creation / stop_reason / requestedModelId / responseModelId / thinkingMode を記録
- chat_response audit の payload.loopTraces[] にまとめて永続化
- `scripts/advisor-latency-trace.ts` を拡張、loop 単位で展開表示 + 自動分類

**2. AdvisorSettings に primary_model_id / loop1_model_id カラム追加**
- 設定ページ (`/system-admin/advisor/settings`) からモデルを動的切替可能に
- ChatInput のモデルセレクタに Sonnet 4.6 / Sonnet 4.5 を追加、Sonnet 4 は legacy 表示
- DEFAULT_MODEL_ID を `claude-sonnet-4-6` に変更

**3. 致命的バグ 4 件を修正**
- `app/api/advisor/chat/route.ts` の modelId 解決マップが `claude-sonnet-4-6` を握りつぶして
  Sonnet 4 に強制フォールバックしていた事象を修正 → AVAILABLE_MODELS から正引き
- `orchestrator.ts` の `max_tokens=512` (loop>0) が update_report_draft の JSON を切断して
  リトライ無限ループを発生させていた事象を 4096 に引き上げ
- `update-report-draft.ts` 空入力エラー時のリトライループを no-op (ok:true) で切断
- ChatInput の localStorage migration ('claude-sonnet' → 'claude-sonnet-4-6')

**4. Sonnet 4.6 用に thinking: { type: 'disabled' } を明示**
- Adaptive Thinking 対応モデル (Sonnet 4.6 / Opus 4.6 / 4.7) で
  default 挙動が公式 docs で断定されていないため、disabled 明示で TTFB を最小化

**5. システムプロンプトを強化** (Sonnet 4.6 のツール暴走対策)
- レポート作成モードで「絶対禁止事項」セクション新設
- query_metric / query_ga4 等のデータ収集ツールを呼ぶこと、レポート本文をチャット欄に書くこと、
  ループを 2 周以上回すことを明示的に禁止

**6. ジッター分析で TTFB 真因を確定**
- `scripts/advisor-jitter-analysis.ts` 新設、35 loop entries / 9 chat_response を横断分析
- **遅い 7 件すべてが loop=1**、cacheRead 中央値 60,898 (ヒット済)、cacheCreate 中央値 493
  (完全再書き込みではない)、output 中央値 106 tokens (短文)
- 速かった 2 件 (TTFB 1〜2 秒) は同一セッション内の連続リクエストのみ
- → **真因: Anthropic ロードバランサーが loop=1 で別ノードにルーティング → KV キャッシュの
  リハイドレーション (中央ストアから VRAM への物理転送) で 90〜130 秒待機**
- こちら側で制御不能と確定

**7. Gemini Canvas 連携を実装** (構造的回避策)
- 重いレポート編集処理を、ブラウザの Gemini Canvas (gemini.google.com) に外出し
- `src/lib/advisor/gemini-canvas-bridge.ts` 新設 (buildPrompt / openGeminiCanvas /
  looksLikeReportMarkdown)
- Server Actions: `getDraftWithCollectedData` (`actions/report-drafts.ts`) と
  `saveGeminiCanvasVersion` (`actions/report-versions.ts`) を追加
- `AdvisorReportVersion.source` に新値 `gemini_canvas` を追加 (DB スキーマ変更不要、
  VarChar(20) なので文字列追加のみ)
- Canvas UI フッターに「Gemini Canvas で編集」ボタン追加
- 貼り付け枠 (textarea + 確定ボタン)、focus 時のクリップボード自動検知ダイアログ
- CanvasStatusBar に `gemini_editing` フェーズ追加
- 既存の Anthropic 経由 update_report_draft はハイブリッド運用で残す

**8. 短絡対策 (案 A) を将来課題として TODO 化**
- HANDOFF.md「Open Tasks」セクションに「将来課題: Advisor TTFB 問題 — サーバー組立短絡 (案 A)」
  として記録。検証で否定された仮説、案 A のメリット/デメリット、再検討トリガーを完全文書化

#### 変更ファイル (主要)

新規:
- `scripts/advisor-jitter-analysis.ts`
- `src/lib/advisor/gemini-canvas-bridge.ts`

編集:
- `prisma/schema.prisma` (AdvisorSettings に primary_model_id / loop1_model_id 追加)
- `app/api/advisor/chat/route.ts` (modelId 解決を AVAILABLE_MODELS ベースに刷新)
- `src/lib/advisor/orchestrator.ts` (LoopTrace 計測 + モデル動的切替 + max_tokens 修正 +
  thinking: disabled)
- `src/lib/advisor/persistence/settings.ts` + `actions/settings.ts` (model ID 永続化)
- `src/lib/advisor/persistence/report-versions.ts` (gemini_canvas を ReportVersionSource に追加)
- `src/lib/advisor/actions/report-drafts.ts` (getDraftWithCollectedData 追加)
- `src/lib/advisor/actions/report-versions.ts` (saveGeminiCanvasVersion 追加 +
  inline source union を ReportVersionSource に揃える)
- `src/lib/advisor/system-prompt.ts` (絶対禁止事項セクション)
- `src/lib/advisor/tools/reports/update-report-draft.ts` (空 input 時 no-op)
- `src/lib/advisor/models.ts` (Sonnet 4.6 追加、DEFAULT_MODEL_ID 変更)
- `src/components/advisor/chat/chat-input.tsx` (localStorage migration)
- `src/components/advisor/report/report-canvas.tsx` (Gemini Canvas UI 一式)
- `src/components/advisor/settings/settings-client.tsx` (モデル選択 UI)
- `scripts/advisor-latency-trace.ts` (loopTraces 展開表示)
- `docs/system-advisor/HANDOFF.md` (このファイル)

#### 学び・注意点

- **「同じコード・同じプロンプト・同じモデルで TTFB が 100 倍違う」が起きたら、
  まず計測データを蓄積してから対策を打つ**。今回 Phase 1 計測整備を入れずに
  Sonnet 4.6 切替・thinking disabled・max_tokens 512 などの対策を試したが、
  すべて空振り (= 真因はそもそもこちら側の問題ではなかった)
- **Anthropic loop=1 TTFB はノードアフィニティ問題**。リサーチで「キャッシュヒットしてるのに
  別ノードに割り当てられて KV キャッシュをリハイドレーションしている」という Anthropic 内部の
  挙動が明らかになった (TPU/GPU クラスタの物理 I/O 待ち)
- **クライアント migration はハードリロードしないと適用されない**。サーバー側にも
  最終防衛を置きたいときは、UI で意図したモデルが本当に届くかを loopTraces で必ず確認する
- **API route のハードコードマップ**は新モデル追加時の事故源。今回 `claude-sonnet-4-6` を
  追加した時に握りつぶされていた。AVAILABLE_MODELS から正引きする方式に統一
- **max_tokens=512 は速度最適化のつもりが update_report_draft を物理的に破壊**していた。
  ツール JSON が大きくなる場面では絶対に出力上限を絞らない
- **構造的回避策 (Gemini Canvas 外出し) はベンダーロックインを緩和**する副次効果あり。
  ハイブリッド運用 (Anthropic + Gemini) で片方の障害が全停止につながらない設計に

---

### 2026-05-02: Canvas ドラフト本体機能 + 速度最適化試行 (未解決)

#### やったこと

**1. Canvas のドラフト UX 全面リデザイン**

ユーザー要望から決まった設計:
- レポート要件部分は **全フィールド常時編集可能** (チェックボックス + 日付ピッカー + textarea)
- 鉛筆アイコン廃止、フィールド毎の保存ボタンも廃止
- フッターに **「ドラフト更新」(上) → 「レポート作成 (本文生成)」(下)** の縦並び
- レポート要件は折りたたみ (デフォルト閉じ)、開けば編集可
- Canvas のレポート本体を「**ドラフト本体 (skeleton_markdown)**」と「**最終レポート (Gemini 生成)**」の 2 層に分離
- 「再生成」表現を「レポート作成 (再作成)」に統一 (ユーザーから「再生成は違う」指摘)
- 赤い「ドラフト」バッジを Canvas タイトル横に常時表示
- アニメーション帯 (drafting / updating / generating で文言切替、青 shimmer)

**2. 新フィールド `original_request` / `skeleton_markdown` の追加**
- `prisma/schema.prisma` の `AdvisorReportDraft` に 2 列追加
- `original_request`: ユーザーの初回要望 (生のメッセージ)
  - 修正指示時に Claude が「元々何を求められたか」を見失わないよう保存
  - 初回の `update_report_draft` 呼び出し時にサーバーが自動で書き込む
- `skeleton_markdown`: ドラフト本体の Markdown (0 埋めの表骨格 + 章立て)
  - Claude or 手動編集が書き換える
  - Canvas のプレビューはこれを描画 (固定の `PreviewSkeleton` は廃止)
- ローカル DB は `npx prisma db push` 適用済み
- ステージング/本番 DB は **未反映** ([DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) と
  [STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) に追記済み)

**3. システムプロンプトを大改装**
- `dynamic part` に **現在のドラフト全体** を毎回埋め込むように
  - title / goal / range / data_sources / metric_keys / outline / notes / original_request / skeleton_markdown
  - これにより Claude は `get_report_draft` ツールを呼ばずに済む (ループ往復削減)
- 「グラフは未対応、表で代替」のルールを追加 (Markdown 出力のみ)
- `[TOOL:draft_revise]` プレフィックスの対応パターンを明記

**4. ツールの削除と整理**
- `list_available_metrics` ツールを廃止 (METRIC_CATALOG をシステムプロンプトに静的埋め込みで代替)
- `get_report_draft` ツールを廃止 (dynamic system prompt にドラフト全体が入るため不要)
- `update_report_draft` を拡張: `skeleton_markdown` を書き換え可能に + `original_request` を初回保存

**5. ChatInput の forcedTool 機構**
- Canvas が開いている時、`draft_revise` ツールを **自動的にオン状態で表示**
- 通常時はメニューに出さない (誤選択防止)
- ユーザーが ✕ で外すことも可能

**6. UX バグ修正**
- `[TOOL:xxx]` プレフィックスがチャット履歴・タイトルに表示される問題を修正
  - 共通ユーティリティ `src/lib/advisor/message-display.ts` の `stripToolHintPrefix()`
  - サーバー側 (DB 保存・session title) + クライアント側 (履歴ロード・サイドバー・breadcrumb・履歴一覧) の両方で剥がす
- 新規/別チャット切替時にツール選択がリセットされない問題を修正
  - `<ChatInput key={conversationId ?? 'new'}>` で強制再マウント
- ローカル編集状態がポーリングをロックする問題を修正
  - チャット送信時に `discardCanvasEditTrigger` を +1 して `draftEdit` をリセット
  - 「書き換えが始まったらユーザーの未保存編集は無視」というユーザー合意

**7. 速度最適化の試行 (効果出ず)**
- prompt cache 化 (cachedPart に METRIC_CATALOG + project knowledge を埋め込み)
- `update_report_draft` 後のサーバー側固定文短絡 → ユーザーから「機械的」と指摘されて削除
- loop > 0 で `max_tokens=512` に制限
- Claude に「1〜2 行で何を変えたか短く返す」と system prompt で指示

**8. データ収集の拡張**
- `collect.ts` で `query_metric` を `supportedGroupBy` 全部で並列取得
- 例: `LP_PV` → `none / day / lp_id / campaign_code` の 4 通り
- これで Gemini は LP 別 / 日別の表を作る素材を持つ

**9. CI 整合性チェック追加**
- `scripts/check-metrics-consistency.ts` を新設、`npm run build` 前に実行
- METRIC_CATALOG ↔ query-metric.ts switch case のズレを検出

**10. 計測ログ整備**
- `scripts/advisor-latency-trace.ts`: セッション時系列内訳
- `scripts/advisor-detailed-audit.ts`: audit_log 全件ダンプ
- orchestrator にループ単位の `[advisor:trace]` console.log を埋めた
  (ttfb / stream / in / out / cacheRead / cacheWrite を観測可能)

**11. ドキュメント更新**
- `docs/system-advisor/REPORT_FEATURE.md` を全面リライト (2026-05-02 仕様)
- `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` に新カラムと動作確認項目追加
- `docs/system-advisor/DEPLOY_CHECKLIST.md` に新カラム反映

#### 残った未解決問題

**Anthropic API loop=1 の TTFB 100 秒級**
- ツール実行後の最終 text 生成で TTFB が 100〜120 秒になる現象が再現性高い
- prompt cache hit / dynamic system prompt 化 / max_tokens 制限を入れても改善せず
- Anthropic API 側のサーバー問題か、こちらのプロンプト構造の問題かは未特定
- 残高切れエラー (`credit balance is too low`) も発生
  → ユーザーがクレジット補充するまで動作確認が止まる

#### 変更ファイル (主要)

- 新規:
  - `src/lib/advisor/message-display.ts`
  - `scripts/advisor-latency-trace.ts`
  - `scripts/advisor-detailed-audit.ts`
  - `scripts/check-metrics-consistency.ts`
- 編集:
  - `prisma/schema.prisma` (AdvisorReportDraft に 2 列追加)
  - `src/lib/advisor/system-prompt.ts` (dynamic part にドラフト全展開、グラフ未対応ルール、metric カタログ埋め込み)
  - `src/lib/advisor/orchestrator.ts` (max_tokens loop 別、stripToolHintPrefix、計測ログ)
  - `src/lib/advisor/persistence/report-drafts.ts` (新フィールド対応)
  - `src/lib/advisor/actions/report-drafts.ts` (`updateDraftBulk` 一括更新 Server Action)
  - `src/lib/advisor/tools/reports/update-report-draft.ts` (skeleton_markdown 対応、original_request 自動保存)
  - `src/lib/advisor/tools/reports/index.ts` (get_report_draft 削除)
  - `src/lib/advisor/tools/tastas-data/index.ts` (list_available_metrics 削除)
  - `src/lib/advisor/reports/collect.ts` (supportedGroupBy 全展開)
  - `src/lib/advisor/reports/generate.ts` (skeleton_markdown と original_request を Gemini プロンプトに、グラフ未対応ルール)
  - `src/components/advisor/report/report-canvas.tsx` (大改装: 全フィールド常時編集、Canvas ステータス帯、DraftBodyView、red badge、リサイズ、上下逆転)
  - `src/components/advisor/chat/chat-layout.tsx` (Canvas 連携、reportChatPhase、discardCanvasEditTrigger、stripToolHintPrefix)
  - `src/components/advisor/chat/chat-input.tsx` (forcedTool プロパティ、hiddenFromMenu フラグ、draft_revise ツール追加)
  - `app/api/advisor/chat/route.ts` (タイトル保存時に prefix 剥がし)
  - `package.json` (`check:metrics` スクリプト追加、build に組込)
- 削除:
  - `src/lib/advisor/tools/reports/get-report-draft.ts`
  - `src/lib/advisor/tools/tastas-data/list-available-metrics.ts`

#### 学び・注意点

- **CLAUDE.md ルールの誤解**: 「ローカル Docker への `prisma db push` は OK」を私が勘違いして
  ユーザーに依頼してしまったが、ローカル限定なら Claude 側で実行可能だった (やり直して通った)
- **Anthropic loop=1 TTFB 問題は実装側だけでは解決困難**。サーバー側の挙動かもしれない。
  → 次セッションで Gemini Canvas や他の LLM のレスポンス速度を比較研究するという方針
- **「再生成」「ドラフト更新」など UX ワーディングはユーザーの認識モデルに合わせて調整が必須**。
  我々 (実装者) が思う言葉とユーザーの言葉は一致しないことが多い

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
