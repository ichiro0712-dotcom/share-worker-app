# System Advisor 機能追加チェックリスト

**作成**: 2026-05-06
**目的**: System Advisor に新機能を追加するときの **SoT 反映漏れ防止**。
TASTAS は SoT が複数箇所に分散しがちなので、章別に「どこを更新するか」を明文化する。

> 新機能を追加する時は、**該当する章を必ず最初から最後までチェック**してから完了とすること。
> 「あとでやる」は SoT 不整合の温床。

---

## §0. 全機能で必ず確認

| # | 確認 | 場所 |
|---|---|---|
| 0-1 | TypeScript エラーなし | `npx tsc --noEmit` exit=0 |
| 0-2 | KNOWLEDGE.md に新しい設計判断があれば追記 | [docs/system-advisor/KNOWLEDGE.md](./KNOWLEDGE.md) |
| 0-3 | HANDOFF.md にセッションログ追加 | [docs/system-advisor/HANDOFF.md](./HANDOFF.md) |
| 0-4 | 該当する仕様書 (architecture / data-model / tools-spec / REPORT_FEATURE) を更新 | `docs/system-advisor/*.md` |
| 0-5 | DB 変更があれば DEPLOY_CHECKLIST / STAGING_DEPLOY_REQUEST も更新 | `docs/system-advisor/DEPLOY_CHECKLIST.md` / `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` |
| 0-6 | 環境変数追加があれば env-vars.md (handoff-bundle) を更新 | `docs/system-advisor/handoff-bundle/env-vars.md` |
| 0-7 | hub-platform 統合のために handoff-bundle 全体を再生成 (scripts/build-advisor-handoff.sh) | `scripts/build-advisor-handoff.sh` |

⚠️ CLAUDE.md ルール:
- Vercel 環境変数 / 本番 DB / git push --force / gh pr merge は Claude Code が実行禁止
- マージ先確認 (develop か main か) は必ずユーザーに確認してから

---

## §1. 新しい LLM ツール (Anthropic Tool Use 対応) を追加する

例: `query_xxx_metric`, `read_xxx_data` 等

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 1-1 | `src/lib/advisor/tools/<category>/<tool-name>.ts` | 新規ファイル作成 (AdvisorTool 実装) |
| 1-2 | `src/lib/advisor/tools/<category>/index.ts` | 1 行 export 追加 + 配列に push |
| 1-3 | `src/lib/advisor/tool-source-labels.ts` | 日本語ラベル追加 (UI / 出典注釈で統一) |
| 1-4 | `src/lib/advisor/llm/data-source-capabilities.ts` | プロンプト内表現を追加 (Gemini が利用可否を判断する) |
| 1-5 | `src/lib/advisor/reports/collect.ts` | レポート生成時の並列収集対象に追加 (`buildInputFor()`) |
| 1-6 | `src/lib/advisor/reports/generate.ts` | プロンプト内のラベル表に追加 (出典注釈の書き方) |
| 1-7 | `docs/system-advisor/tools-spec.md` | ツール仕様追加 |
| 1-8 | `docs/system-advisor/handoff-bundle/docs/03_TOOLS_SPEC.md` | bundle 側にも反映 |

### よくある漏れ
- `tool-source-labels.ts` 未更新 → レポート出典注釈に英語キーが出る
- `data-source-capabilities.ts` 未更新 → Gemini が「利用可能なツールに無い」と判断して呼ばない
- `collect.ts` 未更新 → ツールは存在するがレポート生成で並列収集されない

### `available()` 設計
- 環境変数チェックは default 値経由で行う (hard fail させない、バグ 9 教訓)
- `process.env.X!` の non-null 強制は禁止 (バグ 10 教訓)

---

## §2. 新しいメトリクス (`query_metric` の metric_key) を追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 2-1 | `src/lib/advisor/tools/tastas-data/metrics-catalog.ts` | METRIC_CATALOG に追加 (key / label / unit / supportedGroupBy / available 等) |
| 2-2 | `src/lib/advisor/tools/tastas-data/query-metric.ts` | `runMetricQuery` の switch case に追加 |
| 2-3 | `app/system-admin/analytics/tabs/MetricDefinitions.tsx` | 同じ key で UI 側にも追加 (CLAUDE.md の同期ルール、必須) |
| 2-4 | `docs/system-design.md` の指標定義セクション | 仕様書にも記述 (CLAUDE.md の同期ルール、必須) |
| 2-5 | `scripts/check-metrics-consistency.ts` で整合性確認 | コマンド: `npx tsx scripts/check-metrics-consistency.ts` |

### よくある漏れ
- `MetricDefinitions.tsx` (UI 側) と `metrics-catalog.ts` (Advisor 側) で **キー / ラベル / 計算ロジックがズレる** → 数字が違う事故
- → CLAUDE.md「指標定義の同期ルール」必読

### LP 別など groupBy 対応する場合
- `groupBy: 'lp_id'` 結果は `rows[].label` に LandingPage.name を JOIN して返すこと (バグ #2 教訓、固有名は本文生成時に実値を埋める)

---

## §3. 新しい外部連携 (GA4 / Search Console / 別 SaaS) を追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 3-1 | `src/lib/<service-name>-client.ts` | 既存パターンに沿って新クライアント (例: `src/lib/ga-client.ts`) |
| 3-2 | `src/lib/advisor/tools/external/<tool-name>.ts` | Advisor ツール作成 (§1 のチェックリスト全部) |
| 3-3 | 環境変数追加 | `.env.local` (ローカル) / `docs/system-advisor/handoff-bundle/env-vars.md` (本番手順は手動) |
| 3-4 | `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` | Vercel 環境変数追加リストに追記 |
| 3-5 | サービス側で必要な権限付与 (例: GCP Service Account を Search Console に追加) | 手順を STAGING_DEPLOY_REQUEST に書く |

### よくある漏れ
- 環境変数を `.env.local` には足したが、`STAGING_DEPLOY_REQUEST.md` を更新し忘れて本番展開時にハマる
- Service Account の権限付与漏れ (例: Search Console プロパティへの追加)

---

## §4. 新しい DB テーブル / カラムを追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 4-1 | `prisma/schema.prisma` | model 定義 (`@@map` で snake_case テーブル名指定) |
| 4-2 | ローカル DB に push | `npx prisma db push` (ローカル Docker のみ、本番は Claude Code が実行禁止) |
| 4-3 | `npx prisma generate` | 型再生成 |
| 4-4 | `docs/system-advisor/data-model.md` | スキーマ仕様書を更新 |
| 4-5 | `docs/system-advisor/handoff-bundle/docs/02_DATA_MODEL.md` | bundle 側にも反映 |
| 4-6 | `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` の STEP 1 dry-run 期待出力 | 新規 ADD COLUMN / CREATE TABLE / CREATE INDEX を追記 |
| 4-7 | `docs/system-advisor/handoff-bundle/prisma/schema-advisor.prisma` を再生成 | `bash scripts/build-advisor-handoff.sh` |

### 必須遵守
- **本番 / ステージング DB に Claude Code が prisma db push しない** (CLAUDE.md ルール)
- 必ずユーザーに「このコマンドを実行してください」と報告して手動実行
- 報告テンプレ:
  ```
  【DB 変更が必要です】
  - 変更内容: (具体的)
  - 対象環境: 本番 / ステージング / 両方
  - 実行コマンド: npx prisma db push
  - ⚠️ ユーザーが直接実行してください
  ```

### よくある漏れ
- ローカルだけ push して本番反映を忘れる
- STAGING_DEPLOY_REQUEST を更新し忘れて、システム責任者の dry-run で「想定外の DDL がある」と止まる

---

## §5. 新しいページ / API ルートを追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 5-1 | `app/system-admin/advisor/<path>/page.tsx` | ページ (RSC + Client コンポーネント分離) |
| 5-2 | `middleware.ts` | 認証ガード (publicPaths に追加するか、System Admin 認証を要求するか) |
| 5-3 | `src/components/advisor/<area>/...` | UI コンポーネント (chat / report / history 等) |
| 5-4 | `docs/system-advisor/handoff-bundle/docs/06_UI_BEHAVIOR_SPEC.md` | UI 仕様書追加 (粒度最大: ボタン / 色 / 状態遷移) |

### 公開 (認証なし) ページの場合
- `middleware.ts` の `publicPaths` 配列に prefix 追加 (例: `/advisor/r/`)
- 認証なしページは個人情報を一切表示しないこと

---

## §6. 新しい Server Action を追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 6-1 | `src/lib/advisor/actions/<file>.ts` の冒頭に `'use server'` | 必須 |
| 6-2 | 認証チェック | `getSystemAdminServerSession()` で `isLoggedIn === true` を確認、不一致なら throw |
| 6-3 | 入力バリデーション | Zod / 手書きでも、最低限 type 確認 |
| 6-4 | エラーハンドリング | エラーは `Error` クラスでラップして throw (バグ #3 教訓: plain object を throw しない) |

### よくある漏れ
- 認証チェック忘れ (Server Action は internal API なのでガード必須)
- `throw e` で plain object を throw → 上位で `[object Object]` 表示

---

## §7. プロンプト変更 (system-prompt / Gemini 系) を行う

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 7-1 | `src/lib/advisor/system-prompt.ts` (Anthropic) または `src/lib/advisor/llm/gemini-*.ts` | プロンプト本文 |
| 7-2 | `docs/system-advisor/system-prompt.md` | プロンプト仕様書 |
| 7-3 | `docs/system-advisor/handoff-bundle/docs/05_SYSTEM_PROMPT.md` | bundle 側にも反映 |
| 7-4 | KNOWLEDGE.md の §2 (プロンプト設計の教訓) に追記 (新パターンが出たら) | `docs/system-advisor/KNOWLEDGE.md` |

### 設計原則 (絶対遵守、KNOWLEDGE.md 由来)
- 「迷ったら更新する側に倒す」を明示する
- ✅ / ❌ 具体例を併記する (抽象指示より遵守率高い)
- 「例」として書く指標 / カラム / API 名は **実在するものだけ** (架空のものは LLM が信じる、バグ #8 教訓)
- skeleton 段階で具体的な LP 名 / キャンペーン名 / 求人名は書かせない (バグ #2 教訓)
- ヘッダー型・章構成を固定強制しない (柔軟性損なう)

---

## §8. 新しい cron を追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 8-1 | `app/api/cron/<name>/route.ts` | エンドポイント実装 |
| 8-2 | `vercel.json` の `crons` 配列に追加 | path + schedule (UTC) |
| 8-3 | 認証チェック (`Authorization: Bearer ${ADVISOR_CRON_SECRET}`) | 必須 |
| 8-4 | `docs/system-advisor/handoff-bundle/vercel-config.md` | cron 設定一覧を更新 |
| 8-5 | `docs/system-advisor/STAGING_DEPLOY_REQUEST.md` | STEP 7 (cron 手動トリガー確認) に項目追加 |

### スケジュール変換 (UTC ↔ JST)
JST = UTC + 9h なので、JST 04:00 = UTC 19:00 = `0 19 * * *`

### よくある漏れ
- `vercel.json` 未追加で「cron 作ったけど発火しない」
- Hobby プランの cron 上限 (1 日 1 回) に注意

---

## §9. 新しい LLM プロバイダ / モデル を追加する

### 必須更新箇所

| # | ファイル | 内容 |
|---|---|---|
| 9-1 | `src/lib/advisor/models.ts` または同等 | モデル定義追加 |
| 9-2 | `src/lib/advisor/orchestrator.ts` | 必要に応じて分岐ロジック (provider 別) |
| 9-3 | コスト計算 (`src/lib/advisor/claude.ts` の `estimateCostUsd` 等) | レート追記 |
| 9-4 | `AdvisorSettings.primary_model_id` のドロップダウン UI を更新 | `app/system-admin/advisor/settings/...` |
| 9-5 | KNOWLEDGE.md §1 (LLM 役割分担) に追記 | `docs/system-advisor/KNOWLEDGE.md` |

### 設計判断 (KNOWLEDGE.md §1.1, 1.2 由来、絶対遵守)
- **Anthropic loop=1 TTFB 100 秒問題は構造的問題**。新しい Anthropic モデルでも再発の可能性
- **Gemini フォールバックは絶対に復活させない**(失敗時は即時エラー、5-10 秒で返す)

---

## §10. UI コンポーネントを追加 / 変更する

### 必須更新箇所

| # | 内容 |
|---|---|
| 10-1 | アイコンボタンは `IconButton` 共通コンポーネント使用 (`<span title>` でラップ + aria-label) |
| 10-2 | Markdown レンダリング箇所では `normalizeMarkdown` を使用 (table 直前に空行補完、バグ #4 教訓) |
| 10-3 | `<ul>` `<ol>` `<li>` は ReactMarkdown の components で明示スタイル化 (Tailwind preflight 対策) |
| 10-4 | ChatInput の prefill 系は送信時に必ずクリア (重複適用バグ防止) |
| 10-5 | ポーリングは段階的に (アクティブ 2s / idle 8s)。**停止条件は絶対作らない** (反映遅延事故防止) |
| 10-6 | `docs/system-advisor/handoff-bundle/docs/06_UI_BEHAVIOR_SPEC.md` を更新 |

---

## §11. 動作確認チェックリスト (デプロイ前)

| # | チェック | コマンド / 場所 |
|---|---|---|
| 11-1 | TS エラーなし | `npx tsc --noEmit` |
| 11-2 | ビルド通る | `npm run build` |
| 11-3 | ローカル DB に変更反映済 | `npx prisma db push` (ローカルのみ) |
| 11-4 | 本番想定の動作確認 | 関連シナリオを手動テスト |
| 11-5 | DEPLOY_CHECKLIST.md のチェックボックス更新 | `docs/system-advisor/DEPLOY_CHECKLIST.md` |

---

## §12. ドキュメント整合性チェック

新機能を追加した後、以下の整合性を必ず確認:

| 確認 | 場所 |
|---|---|
| KNOWLEDGE.md / HANDOFF.md / NEXT_SESSION.md が最新か | `docs/system-advisor/` |
| handoff-bundle 全体が最新か (再生成: `bash scripts/build-advisor-handoff.sh`) | `docs/system-advisor/handoff-bundle/` |
| ANTI_PATTERNS.md / DESIGN_DECISIONS.md と矛盾しないか | `docs/system-advisor/handoff-bundle/knowledge/` |
| metric-related なら `MetricDefinitions.tsx` ↔ `metrics-catalog.ts` ↔ `system-design.md` の 3 箇所同期 | CLAUDE.md ルール |

---

## §13. 関連ドキュメント

- [HANDOFF.md](./HANDOFF.md) — セッションログ
- [KNOWLEDGE.md](./KNOWLEDGE.md) — 設計知見
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — Canvas + レポート機能
- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — デプロイチェックリスト
- [STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) — ステージング展開手順
- [data-model.md](./data-model.md) — DB スキーマ
- [tools-spec.md](./tools-spec.md) — 19 ツール仕様
- [system-prompt.md](./system-prompt.md) — プロンプト
- [handoff-bundle/](./handoff-bundle/) — hub-platform 移送パッケージ
- [CLAUDE.md (リポジトリルート)](../../CLAUDE.md) — プロジェクト全体ルール
