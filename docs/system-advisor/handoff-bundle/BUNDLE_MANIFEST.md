# パッケージ内容一覧 (BUNDLE_MANIFEST)

**作成**: 2026-05-04
**生成スクリプト**: `scripts/build-advisor-handoff.sh` (TASTAS 側)

---

## 1. 全ファイルツリー (深さ 4)

```
handoff-bundle/
├── README.md                                ★入口
├── HANDOFF_FROM_TASTAS.md                   ★議論経緯
├── BUNDLE_MANIFEST.md                       ★このファイル
├── INTEGRATION_QUESTIONS.md                 ★相談リスト
│
├── docs/                                    📐 仕様書 (9 ファイル)
│   ├── 00_OVERVIEW.md
│   ├── 01_ARCHITECTURE.md
│   ├── 02_DATA_MODEL.md
│   ├── 03_TOOLS_SPEC.md
│   ├── 04_REPORT_FEATURE.md
│   ├── 05_SYSTEM_PROMPT.md
│   ├── 06_UI_BEHAVIOR_SPEC.md               ★UI 完全マッピング
│   ├── 07_SECURITY_COST.md
│   └── 08_DEPLOY_REQUIREMENTS.md
│
├── knowledge/                               🧠 ナレッジ (8 ファイル)
│   ├── INDEX.md
│   ├── DESIGN_DECISIONS.md                  ★なぜこの設計か
│   ├── PROMPT_PATTERNS.md
│   ├── DATA_COLLECTION_PATTERNS.md
│   ├── LATENCY_HISTORY.md
│   ├── BUG_FIX_PLAYBOOK.md                  ★失敗 → 修正集
│   ├── AUDIT_REPORT_2026-05-04.md
│   └── ANTI_PATTERNS.md                     ★やってはいけないこと
│
├── src/                                     💻 コード (TASTAS 本番のスナップショット)
│   ├── _README.md                           ← コード読書ガイド
│   ├── lib/advisor/
│   │   ├── orchestrator.ts                   メインループ
│   │   ├── system-prompt.ts                  cachedPart + dynamicPart
│   │   ├── claude.ts                         Anthropic SDK ラッパー
│   │   ├── prompt-cache.ts
│   │   ├── models.ts                         モデル alias 定義
│   │   ├── auth.ts                           iron-session ガード
│   │   ├── rate-limit.ts
│   │   ├── cost-guard.ts                     checkCostCap / incrementUsage
│   │   ├── jst.ts                            JST ヘルパー
│   │   ├── llm-stream.ts                     SSE 整形
│   │   ├── message-display.ts                [TOOL:xxx] 剥がし
│   │   ├── tool-source-labels.ts             英語キー ↔ 日本語ラベル
│   │   ├── agent-icons.tsx
│   │   ├── db.ts                             advisorDataPrisma + runReadOnly
│   │   ├── llm/
│   │   │   ├── gemini.ts                     @google/genai 薄ラッパー
│   │   │   ├── gemini-draft-create.ts        [TOOL:report_create] バイパス
│   │   │   ├── gemini-edit.ts                [TOOL:draft_revise] バイパス
│   │   │   ├── gemini-result-edit.ts         [TOOL:result_edit] バイパス
│   │   │   ├── chat-history-context.ts       履歴を Gemini に渡す
│   │   │   └── data-source-capabilities.ts
│   │   ├── knowledge/
│   │   │   ├── store.ts
│   │   │   ├── github-source.ts              GitHub Contents API
│   │   │   └── sync.ts                       cron 用同期
│   │   ├── tools/
│   │   │   ├── registry.ts                   19 ツール集約
│   │   │   ├── types.ts                      AdvisorTool 型
│   │   │   ├── core/                         5 個 (read_repo_file 他)
│   │   │   ├── tastas-data/                  5 個 (query_metric 他)
│   │   │   ├── external/                     5 個 (query_ga4 他)
│   │   │   ├── future/                       2 個 (placeholder)
│   │   │   └── reports/                      2 個 (update_report_draft / edit_report_section)
│   │   ├── persistence/
│   │   │   ├── sessions.ts
│   │   │   ├── messages.ts                   getRecentMessagesForOrchestrator
│   │   │   ├── audit.ts                      recordAudit
│   │   │   ├── settings.ts
│   │   │   ├── report-drafts.ts
│   │   │   └── report-versions.ts            share_token 発行 / 期限管理
│   │   ├── actions/                          Server Actions
│   │   │   ├── conversations.ts              toggleBookmark 等
│   │   │   ├── report-drafts.ts
│   │   │   ├── report-versions.ts            enableShare / extendShare
│   │   │   ├── settings.ts
│   │   │   ├── saved-prompts.ts
│   │   │   ├── custom-agents.ts
│   │   │   └── pending-actions.ts
│   │   └── reports/
│   │       ├── collect.ts                    並列展開
│   │       └── generate.ts                   Gemini パイプライン
│   │
│   ├── components/advisor/
│   │   ├── chat/
│   │   │   ├── chat-layout.tsx               最大 (~1700 行)
│   │   │   ├── chat-input.tsx                forcedTool / prefill
│   │   │   ├── unified-message.tsx
│   │   │   └── markdown-table.tsx
│   │   ├── report/
│   │   │   └── report-canvas.tsx             最重要 (~1700 行)
│   │   ├── history/
│   │   │   └── history-client.tsx
│   │   └── reports/
│   │       ├── reports-list.tsx              全バージョン横断
│   │       └── report-detail.tsx
│   │
│   ├── app/system-admin/advisor/
│   │   ├── page.tsx                          メイン
│   │   ├── loading.tsx
│   │   ├── settings/page.tsx                 設定ページ
│   │   ├── history/page.tsx                  チャット履歴
│   │   └── reports/
│   │       ├── page.tsx                      全バージョン一覧
│   │       └── [versionId]/page.tsx          バージョン詳細
│   │
│   ├── app/api/advisor/
│   │   ├── chat/route.ts                     SSE
│   │   └── report/generate/route.ts          Gemini レポート生成
│   │
│   ├── app/api/cron/
│   │   ├── advisor-cleanup/route.ts          毎日 04:00 JST
│   │   └── advisor-knowledge-sync/route.ts   GitHub 知識同期
│   │
│   └── app/advisor/r/[token]/
│       └── page.tsx                          公開シェアページ (認証なし)
│
├── prisma/
│   ├── schema-advisor.prisma                 Advisor 関連 model 全部 (10 テーブル)
│   └── schema-related.prisma                 参照される業務テーブル
│
├── extra-config/                             📦 設定ファイル原本
│   ├── middleware.ts                         publicPaths に /advisor/r/ を追加
│   ├── globals.css                           Tailwind preflight 注意点 (bullet 消失)
│   ├── tailwind.config.ts
│   ├── package.json
│   ├── vercel.json                           cron 設定 (advisor-cleanup)
│   └── tsconfig.json
│
├── package-deps.md                           ⚙️ npm 依存解説
├── env-vars.md                               ⚙️ 環境変数解説
└── vercel-config.md                          ⚙️ vercel.json 解説
```

---

## 2. ファイル数 / サイズ

| 種別 | ファイル数 | おおよそのサイズ |
|---|---|---|
| 入口 (4) | 4 | 30 KB |
| 仕様書 (docs/) | 9 | 200 KB |
| ナレッジ (knowledge/) | 8 | 150 KB |
| コード (src/) | ~70 | 500 KB |
| スキーマ (prisma/) | 2 | 30 KB |
| 環境構築 (extra-config/ + .md) | 9 | 50 KB |
| **合計** | **~100** | **~1 MB** |

---

## 3. このパッケージに **入っていない** もの

意図的に除外したもの:

| カテゴリ | 入っていないもの | 理由 |
|---|---|---|
| 認証情報 | API キー / トークン / 接続 URL の実値 | セキュリティ |
| データ | 本番のテストデータ / レポート実例 | 個人情報保護 |
| 開発履歴 | git log / セッションログ全文 (HANDOFF.md は含めない) | 量が多すぎる、ナレッジに要約済み |
| 依存パッケージ本体 | `node_modules/` | サイズ |
| ビルド成果物 | `.next/` 等 | 生成物 |
| 他機能 | TASTAS の Advisor 以外の機能 (求人マッチング本体) | スコープ外 |

セッション履歴 (HANDOFF.md) は要約版が `knowledge/BUG_FIX_PLAYBOOK.md` 等に
分散して入っている。「セッション X で何があった」を時系列で見たい場合は
**ユーザー (川島) に直接聞く** こと。

---

## 4. このパッケージの再生成方法 (TASTAS 側で更新があった時)

```bash
cd "/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ"
bash scripts/build-advisor-handoff.sh
```

機械生成部分 (src/ + prisma/ + extra-config/) のみ再生成され、
手書きドキュメント (docs/ + knowledge/ + 入口) は温存される。

更新後に hub-platform 側に再配置:
```bash
TODAY=$(date +%Y-%m-%d)
cp -r docs/system-advisor/handoff-bundle \
  /Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/scratch/advisor-import-${TODAY}
```

(Claude Code は CLAUDE.md ルールにより hub-platform に直接コピーしないため、
ユーザー手動。)
