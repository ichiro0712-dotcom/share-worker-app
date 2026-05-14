# Hub Platform 統合 — 着手予定 TODO (2026-05-03 議論で確定)

**作成**: 2026-05-03
**ステータス**: **着手保留 (TASTAS Advisor の完成度を上げてから着手)**
**前提**: TASTAS Advisor が本番安定運用に入った後、本ドキュメントの手順を実行する

---

## 0. このドキュメントの目的

2026-05-03 のセッションで、ユーザーから提起された「複数事業 (TASTAS / 寿司屋 / hubpratform / バンド) で
共通の System Advisor を持ちたい」という構想について議論し、**hub-platform にすべて取り込む方針**で合意した。

ただし、**TASTAS Advisor の完成度を高めるのが先**という判断のもと、移行作業は保留。
本ドキュメントは「**TASTAS Advisor が安定したら、すぐに着手できる状態**」を維持するための方針 + TODO。

---

## 1. 議論の結論 (2026-05-03)

### 1.1 大きな方針

> **「SaaS を作る」のではなく「自分の hub-platform に各事業を吸収し、各 Hub に System Advisor を持たせる」**

### 1.2 hub-platform の現状 (重要)

`/Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/` は既に **Turborepo モノレポ**で、
以下のアプリが動作中・設計中:

| アプリ | 役割 | 状態 |
|---|---|---|
| `apps/agent-hub` | AI 統合司令塔 (チャット + Canvas + マルチエージェント + MCP) | 稼働中 (本番: agent-hub-one-sooty.vercel.app) |
| `apps/project-hub` | プロジェクト・予算・WBS・タスク管理 | 稼働中 (本番: hub-web-seven.vercel.app) |
| `apps/health-hub` | 健康データ管理 | 稼働中 (本番: health-hub-eight.vercel.app) |
| `apps/communication-hub` | メール・チャット統合 | 開発中 |
| `apps/autocast` | SNS 自動投稿 | 稼働中 |
| `apps/mcp-server` | MCP サーバー | 既存 |
| `apps/hub` | 統合 FE | 既存 |

**重要な発見**:
- 統合 Supabase + schema 分離 (`agent_hub.*` / `project_hub.*` / `health_hub.*` 等) で**マルチテナント済み**
- Agent Hub の Orchestrator + 9 エージェント + Canvas + MCP が**既に実装済み**
- TASTAS Advisor で苦労した抽象化が hub-platform 側で先行解決されている

### 1.3 採用する設計

```
hub-platform/  (既存モノレポを拡張)
├ packages/
│  ├ llm-usage/                    既存
│  └ advisor-core/                  🆕 System Advisor の汎用部品
│     ├ chat/                        チャット UI
│     ├ canvas/                      Canvas + レポート
│     ├ orchestrator/                Gemini バイパス / auto-redraft
│     ├ tool-registry/               プラガブル ツール定義
│     └ prompts/                     汎用プロンプト
│
├ apps/
│  ├ agent-hub/                     既存 (統合司令塔)
│  ├ project-hub/                   既存
│  ├ health-hub/                    既存
│  ├ sushi-hub/                     🆕 寿司屋運営 + 内蔵 Advisor (Phase 1)
│  ├ band-hub/                      🆕 バンド活動 + 内蔵 Advisor (Phase 3)
│  └ tastas-hub/ (or MCP 経由)       🆕 TASTAS 統合 (Phase 4)
│
└ docs/
   └ advisor-core/                   🆕 advisor-core の仕様書 (TASTAS の docs から移植)
```

**設計原則**:
- `packages/advisor-core` を改善 → 全 Hub の Advisor に即反映 (= ユーザー希望の「UI 1 個作れば全反映」)
- 各 Hub 固有のツール・メトリクスは各 `apps/*-hub/lib/` に置く
- agent-hub の Orchestrator が Hub 横断の相談を司る (横串相談)

### 1.4 移行順序 (合意)

| Phase | スコープ | 触らないもの |
|---|---|---|
| **Phase 0** | 本ドキュメント作成 (現在完了) | - |
| **Phase 1** | TASTAS Advisor の完成度向上 (本番展開・安定運用) | hub-platform |
| **Phase 2** | 着手判断 (Phase 1 完了後にユーザーと最終確認) | - |
| **Phase 3** | TASTAS Advisor のコード + ドキュメントを hub-platform にコピー (`scratch/advisor-import-YYYY-MM-DD/`) | TASTAS Advisor 本番運用 |
| **Phase 4** | hub-platform 側で `packages/advisor-core` 抽出作業 | TASTAS Advisor (現役運用継続) |
| **Phase 5** | `apps/sushi-hub` 立ち上げ (MF 会計 1 ソース、月次 PL + 週次売上の 2 レポートだけ) | TASTAS Advisor |
| **Phase 6** | `apps/band-hub` 立ち上げ | TASTAS Advisor |
| **Phase 7** | TASTAS を hub-platform に統合 (`apps/tastas-hub` 移植 or MCP server 化のどちらか) | - |
| **Phase 8** | Hub 間 MCP 連携 (横串相談の実装) | - |

**Phase 1 完了の判定基準** = **「Phase 3 着手の Go サイン」**:
- TASTAS Advisor がステージング・本番で 2 週間以上安定運用 (エラー率 < 1%)
- ユーザーが日次 / 週次でレポートを実運用に使えている
- 残課題リスト (Phase 1 中に発生したもの) が許容範囲内

---

## 2. Phase 3 着手時に **すぐ実行する** 手順 (準備完了)

> 以下は **TASTAS Advisor が完成・安定運用に入った後、ユーザーから「Phase 3 開始」の指示があったら即実行する**手順。
> 現時点では実行しない。

### 2.1 hub-platform への advisor 一式コピー

**コピー先**: `hub-platform/scratch/advisor-import-{YYYY-MM-DD}/`
(`scratch/` を採用する理由: 議論材料であって最終配置先ではないため。安定後に `packages/advisor-core` へ整理移動)

**コピーする内容**:

```
hub-platform/scratch/advisor-import-{YYYY-MM-DD}/
├ README.md                            🆕 hub-platform 側 Claude への入口
├ HANDOFF_FROM_TASTAS.md               🆕 議論経緯 + 合意事項のサマリ
├
├ docs/                                ← TASTAS の docs/system-advisor/** を全コピー
│  ├ HANDOFF.md
│  ├ KNOWLEDGE.md                       (★ 最重要、15 件の改善知見)
│  ├ SAAS_PRODUCTIZATION.md
│  ├ NEXT_SESSION.md
│  ├ HUB_PLATFORM_MIGRATION_TODO.md     (★ 本ドキュメント)
│  ├ REPORT_FEATURE.md
│  ├ system-prompt.md
│  ├ tools-spec.md
│  ├ data-model.md
│  ├ architecture.md
│  ├ DEPLOY_CHECKLIST.md
│  └ ... (全 system-advisor ドキュメント)
│
├ src/                                  ← TASTAS の Advisor コード参照用
│  ├ lib/advisor/**                       orchestrator / Gemini / tools / prompts
│  ├ components/advisor/**                Canvas / Chat UI
│  └ app/system-admin/advisor/**          ページ・ルート
│  └ app/api/advisor/**                   API ルート
│
├ prisma/
│  └ schema-advisor.prisma             🆕 Advisor 関連スキーマ抜粋
│
├ package-deps.md                       🆕 必要な npm 依存パッケージ抜粋
└ env-vars.md                           🆕 必要な環境変数一覧 (GEMINI_API_KEY 等)
```

**コマンド例** (Phase 3 着手時に実行):

```bash
# 1. コピー先作成
TODAY=$(date +%Y-%m-%d)
DEST="/Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/scratch/advisor-import-${TODAY}"
mkdir -p "${DEST}"

# 2. ドキュメント全コピー
cp -r "/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ/docs/system-advisor" "${DEST}/docs"

# 3. コードコピー
SRC="/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ"
mkdir -p "${DEST}/src/lib" "${DEST}/src/components" "${DEST}/src/app/system-admin" "${DEST}/src/app/api"
cp -r "${SRC}/src/lib/advisor"           "${DEST}/src/lib/advisor"
cp -r "${SRC}/src/components/advisor"     "${DEST}/src/components/advisor"
cp -r "${SRC}/src/app/system-admin/advisor" "${DEST}/src/app/system-admin/advisor"
cp -r "${SRC}/src/app/api/advisor"        "${DEST}/src/app/api/advisor"

# 4. Prisma スキーマ抜粋 (要手動編集 — Advisor 関連 model のみ抽出)
grep -A 50 "model Advisor" "${SRC}/prisma/schema.prisma" > "${DEST}/prisma/schema-advisor.prisma"
# 別途、関連 enum / 参照される SystemAdmin テーブル定義も抜粋する

# 5. README + HANDOFF_FROM_TASTAS は手動作成 (テンプレート: 本ドキュメント §3)
```

### 2.2 hub-platform 側 Claude への引き継ぎ

Phase 3 の hub-platform セッション開始時、Claude に以下を読ませる:

1. `hub-platform/scratch/advisor-import-{YYYY-MM-DD}/README.md`
2. `hub-platform/scratch/advisor-import-{YYYY-MM-DD}/HANDOFF_FROM_TASTAS.md`
3. `hub-platform/scratch/advisor-import-{YYYY-MM-DD}/docs/KNOWLEDGE.md`
4. `hub-platform/docs/PLATFORM_VISION.md`
5. `hub-platform/SYSTEM_OVERVIEW.md`
6. `hub-platform/AI_AGENT_SPEC.md` (agent-hub の現状把握)

これで「TASTAS Advisor の知見 + hub-platform の現状」を両方把握した状態で Phase 4 (advisor-core 抽出) に入れる。

---

## 3. Phase 3 で作る 2 つの新規ドキュメント (テンプレート)

### 3.1 `README.md` テンプレート

```markdown
# TASTAS Advisor → Hub Platform Migration Bundle

**コピー作成日**: YYYY-MM-DD
**コピー元**: /Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ
**コピー先**: hub-platform/scratch/advisor-import-YYYY-MM-DD/
**目的**: hub-platform に System Advisor を統合するための参考資料一式

## 読む順序 (hub-platform 側 Claude へ)

1. このファイル (README.md)
2. HANDOFF_FROM_TASTAS.md ← 議論経緯
3. docs/HUB_PLATFORM_MIGRATION_TODO.md ← 移行計画
4. docs/KNOWLEDGE.md ← TASTAS 開発で得た 15 件の改善知見 (★ 最重要)
5. docs/REPORT_FEATURE.md ← Canvas + レポート機能の全体設計
6. (hub-platform 側) docs/PLATFORM_VISION.md
7. (hub-platform 側) AI_AGENT_SPEC.md

## 触ってはいけないもの

- TASTAS Advisor の元コード (本コピーは参考用、元側は本番運用中)
- hub-platform の既存 agent-hub (本格統合は Phase 7、いきなり触らない)

## 次にやること

docs/HUB_PLATFORM_MIGRATION_TODO.md の Phase 4 (advisor-core 抽出) から開始。
```

### 3.2 `HANDOFF_FROM_TASTAS.md` テンプレート

```markdown
# TASTAS Advisor → Hub Platform 引き継ぎサマリ

## 0. 議論の経緯 (2026-05-03)

ユーザー (川嶋一郎) から提起:
- TASTAS 以外の事業 (寿司屋 / hubpratform / バンド) でも System Advisor が欲しい
- 「UI を 1 つ作れば全プロジェクトに反映」させたい
- MCP 経由で複数 Advisor が連携する未来を想定

検討の結果:
- hub-platform が既に Advisor Platform として機能している (agent-hub / Orchestrator / Canvas / MCP)
- TASTAS Advisor を hub-platform に統合する方が、新規 SaaS リポを作るより筋が良い
- 各 Hub に System Advisor を住まわせ、`packages/advisor-core` を共有する設計で合意

## 1. 合意した方針

(本書の §1.3 と同じ — 図含めて転記)

## 2. TASTAS Advisor で得た重要な知見

詳細は docs/KNOWLEDGE.md を参照。要点:
- LLM 役割分担: 一般チャット = Claude Sonnet、レポート系 = Gemini 2.5 Flash 直叩き
- Anthropic フォールバック撤去: Gemini 失敗時は即時エラー (loop=1 TTFB 100s 問題)
- 「迷ったら更新する側に倒す」プロンプト原則
- データソース全展開 (collect.ts で reportType / dimensions 全パターン並列)
- 過去バージョン編集の継承 (previousResultMarkdown を Gemini に渡す)
- 集計期間注釈の出典統合フォーマット
- auto-redraft (result_edit → draft_revise → 再生成 を裏で連続実行)

## 3. 触ってはいけないもの

- TASTAS Advisor の元コード (現役運用中)
- hub-platform の既存 agent-hub (Phase 7 まで触らない)

## 4. 次にやること

docs/HUB_PLATFORM_MIGRATION_TODO.md §4 を参照。
```

---

## 4. 着手判断のフロー (Phase 3 開始の Go サイン)

```
[現在: TASTAS Advisor 開発中 / ローカルテスト継続]
       ↓
[ユーザー: ステージング展開 OK]
       ↓
[2 週間ステージング運用 → エラー率 < 1%]
       ↓
[ユーザー: 本番展開 OK]
       ↓
[2 週間本番運用 → エラー率 < 1% + 実運用フィードバック収集]
       ↓
[ユーザー: 「Phase 3 開始」を明示]
       ↓
[本ドキュメント §2.1 のコマンドで hub-platform にコピー]
       ↓
[hub-platform セッションで Phase 4 (advisor-core 抽出) 開始]
```

**重要**: ユーザーから明示的に Phase 3 開始の指示があるまで、本ドキュメントは「準備された設計図」として残す。
TASTAS Advisor が安定する前に着手しない。

---

## 5. それまでにやること (TASTAS 側 Claude へ)

Phase 1 (TASTAS Advisor の完成度向上) として、以下を継続:

### 5.1 ローカルテスト継続 (NEXT_SESSION.md §2 トピック 1 と同じ)

**観察ポイント**:
- レポート生成後の skeleton と result の整合性
- 集計期間注釈が表の下に正しく出ているか
- 表前置き散文 (「以下の通りです」) が消えているか
- auto-redraft で過去 v の編集が継承されているか
- LP_TO_LINE_CONV が数字付きで表に出るか
- 全 5 種の query_ga4 / 4 種の query_search_console が並列で取れているか

### 5.2 ステージング展開 (DEPLOY_CHECKLIST.md)

DEPLOY_CHECKLIST.md のチェックボックスで進捗管理:
- DB スキーマ反映 (AdvisorReportDraft / AdvisorReportVersion / AdvisorAuditLog の追加カラム)
- Vercel 環境変数追加 (GEMINI_API_KEY 必須)
- ステージングでの動作確認

### 5.3 本番展開 (DEPLOY_CHECKLIST.md)

ステージング 2 週間運用後、本番展開へ。

### 5.4 残課題対応 (発生したら)

- LP 名が ID のまま表示される問題 (LandingPage JOIN 改修、優先度低)
- その他、運用中に発見される問題

---

## 5-bis. Phase 1 中に追加実装済み (2026-05-04 — hub-platform 移行時もそのまま継承)

以下は Phase 1 (TASTAS 完成度向上) で追加された機能。
hub-platform 統合時 (Phase 4 の advisor-core 抽出) で **Core 側に持っていく**機能群。

### 5-bis.1 レポート公開シェア URL (有効期限 30 日)

- スキーマ: `AdvisorReportVersion.share_token` (unique) + `shared_at` + `shared_until`
- 公開ページ: `/advisor/r/[token]` (auth 不要、middleware の publicPaths で許可)
- Server Actions: `enableShare` / `disableShare` / `extendShare` / `getShareState`
- UI: ReportCanvas footer の「共有 ▼」ドロップダウン (本文コピー / URL コピー / +30 日延長 / 停止)
- 公開ページに「共有: {admin.name}」+ 「あと N 日」バッジ表示

### 5-bis.2 しおり (永続保存) 機能 + 自動削除 cron

- スキーマ: `AdvisorChatSession.bookmarked` (Bool, default false) + `(bookmarked, updated_at)` index
- Server Action: `toggleBookmark` / `getSessionBookmarkState`
- UI:
  - サイドバー (chat-layout): セッション行右側にしおりトグル (bookmarked のときは常時表示、それ以外は hover 時)
  - 履歴一覧 (history-client): 同上 + タイトル左にバッジ
  - Canvas: ヘッダー右にトグル + 直下に保持期間バナー (RetentionBanner)
- Cron: `/api/cron/advisor-cleanup` (毎日 04:00 JST)
  - しおりなしセッションの Draft + Versions を 30 日後に削除
  - Audit ログ 90 日 (report_* イベントは 180 日) で削除
  - 失効済み共有 URL の token / shared_at / shared_until を null 化 (掃除)

### 5-bis.3 Markdown 箇条書き表示の修正

- `app/globals.css` の Tailwind preflight が `<ul>` を bullet なしリセット
- `@tailwindcss/typography` 未導入で `prose` クラスが効かない
- 解決: 各 ReactMarkdown 呼び出しの `components` で `ul` / `ol` / `li` を明示スタイル化
- 影響: report-canvas.tsx (Canvas) / unified-message.tsx (チャット) / report-detail.tsx (履歴詳細)

### 5-bis.4 関連ドキュメント

- 保持期間ポリシーは [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) §1-1 に記載
- KNOWLEDGE.md / HANDOFF.md にも反映

---

## 6. 本ドキュメントの更新ルール

- Phase 1 (TASTAS 完成度向上) 中に新しい議論・決定があれば本ドキュメントに追記
- Phase 3 着手時、本ドキュメントごと hub-platform にコピーされる
- 着手後は hub-platform 側で更新 (TASTAS 側は archive 扱い)

---

## 7. 関連ドキュメント

- [HANDOFF.md](./HANDOFF.md) — TASTAS Advisor 引き継ぎ (時系列ログ)
- [KNOWLEDGE.md](./KNOWLEDGE.md) — TASTAS 開発で得た設計知見 (★ Phase 4 で必読)
- [SAAS_PRODUCTIZATION.md](./SAAS_PRODUCTIZATION.md) — 当初の SaaS 化議論 (本ドキュメントで方針が hub-platform 統合に確定)
- [NEXT_SESSION.md](./NEXT_SESSION.md) — 次セッションへのメッセージ
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — Canvas + レポート機能の全体設計
- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — ステージング/本番展開チェックリスト

### hub-platform 側で参照すべきドキュメント (Phase 3 開始時)

- `hub-platform/docs/PLATFORM_VISION.md`
- `hub-platform/SYSTEM_OVERVIEW.md`
- `hub-platform/AI_AGENT_SPEC.md`
- `hub-platform/CA_CANVAS_SPEC.md`
- `hub-platform/docs/MCP_MULTI_AI_CONNECTION.md`
