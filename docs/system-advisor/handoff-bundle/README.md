# TASTAS System Advisor → hub-platform 移送パッケージ

**作成**: 2026-05-04
**作成者**: TASTAS 側 Claude Code (川島依頼)
**読み手**: hub-platform 側 LLM (Claude / その他)
**目的**: TASTAS で稼働中の **System Advisor** を hub-platform にどう統合するかを相談するための完全資料一式

---

## 0. このパッケージは何か (3 行で)

- TASTAS で内製した「System Admin 専用 LLM チャット + Canvas + レポート機能」(System Advisor) の **コード / 仕様 / 設計判断 / 失敗の歴史 / 環境構築情報** を全部詰め込んだもの
- hub-platform 側で `packages/advisor-core` 等として汎用化するための **議論材料**
- **本パッケージそのまま動かそうとしないこと**。読んで理解 → 相談 → 統合方針決定 → 実装、の順

---

## 1. 必ず読む順序

⚠️ **この順番を守らないと迷子になります**。コードからいきなり読まないでください。

| # | ファイル | なぜここから |
|---|---|---|
| **1** | このファイル (README.md) | 全体像とパッケージの構成把握 |
| **2** | [HANDOFF_FROM_TASTAS.md](./HANDOFF_FROM_TASTAS.md) | 議論経緯・何を相談したいか・触ってはいけないもの |
| **3** | [BUNDLE_MANIFEST.md](./BUNDLE_MANIFEST.md) | このパッケージに何が入っているか一覧 |
| **4** | [docs/00_OVERVIEW.md](./docs/00_OVERVIEW.md) | Advisor とは何か (3 分で読める) |
| **5** | [docs/01_ARCHITECTURE.md](./docs/01_ARCHITECTURE.md) | 全体構成 + Anthropic / Gemini 2 系統 LLM の役割分担 |
| **6** | [docs/04_REPORT_FEATURE.md](./docs/04_REPORT_FEATURE.md) | Canvas + レポート機能の動線 (Advisor の主機能) |
| **7** | [knowledge/INDEX.md](./knowledge/INDEX.md) | ナレッジの全体目次 |
| **8** | [knowledge/DESIGN_DECISIONS.md](./knowledge/DESIGN_DECISIONS.md) | **★ 最重要**: なぜこの設計か (Gemini バイパス / Anthropic フォールバック撤去 等) |
| **9** | [knowledge/BUG_FIX_PLAYBOOK.md](./knowledge/BUG_FIX_PLAYBOOK.md) | 過去に踏んだバグ → 修正パターン集 |
| **10** | [knowledge/ANTI_PATTERNS.md](./knowledge/ANTI_PATTERNS.md) | やってはいけないこと (再発防止) |
| **11** | [INTEGRATION_QUESTIONS.md](./INTEGRATION_QUESTIONS.md) | hub-platform 側 LLM への質問リスト (回答してほしい) |

ここまで読めば「何が出来ているか」「なぜこの設計か」「何で苦労したか」が掴める。
そのあとで **コード ([src/_README.md](./src/_README.md))** に入る。

---

## 2. パッケージの構造

```
handoff-bundle/
├── 📍 入口 (このファイル + 2 つ)
│   ├── README.md                        ← 今読んでるファイル
│   ├── HANDOFF_FROM_TASTAS.md           ← 議論経緯 + 相談したいこと
│   └── BUNDLE_MANIFEST.md               ← 全ファイル一覧
│
├── 📐 仕様書 (理解用ドキュメント、9 ファイル)
│   └── docs/
│       ├── 00_OVERVIEW.md               ← 3 分で読める概要
│       ├── 01_ARCHITECTURE.md           ← 全体構成
│       ├── 02_DATA_MODEL.md             ← Prisma 10 テーブル
│       ├── 03_TOOLS_SPEC.md             ← 19 ツール仕様
│       ├── 04_REPORT_FEATURE.md         ← Canvas + レポート機能
│       ├── 05_SYSTEM_PROMPT.md          ← Anthropic / Gemini プロンプト全文
│       ├── 06_UI_BEHAVIOR_SPEC.md       ← ★ UI 完全マッピング (粒度最大)
│       ├── 07_SECURITY_COST.md          ← 二重防御 + コスト設計
│       └── 08_DEPLOY_REQUIREMENTS.md    ← デプロイ要件
│
├── 🧠 ナレッジ (失敗 → 修正の蓄積、8 ファイル)
│   └── knowledge/
│       ├── INDEX.md                     ← ナレッジ目次
│       ├── DESIGN_DECISIONS.md          ← ★ なぜこの設計か
│       ├── PROMPT_PATTERNS.md           ← プロンプト設計の教訓
│       ├── DATA_COLLECTION_PATTERNS.md  ← collect.ts の教訓
│       ├── LATENCY_HISTORY.md           ← 速度改善の歴史
│       ├── BUG_FIX_PLAYBOOK.md          ← 失敗 → 修正のエピソード集
│       ├── AUDIT_REPORT_2026-05-04.md   ← Antigravity 監査結果
│       └── ANTI_PATTERNS.md             ← やってはいけないこと
│
├── 💻 コード (参考用、TASTAS 本番のスナップショット)
│   └── src/
│       ├── _README.md                   ← コード読書のガイド
│       ├── lib/advisor/                 ← orchestrator / Gemini / tools / prompts
│       ├── components/advisor/          ← Canvas / Chat UI
│       ├── app/system-admin/advisor/    ← 画面 + ページ
│       ├── app/api/advisor/             ← API ルート (chat / report/generate)
│       ├── app/api/cron/                ← cron (advisor-cleanup / knowledge-sync)
│       └── app/advisor/r/               ← 公開シェアページ
│
├── 🗄 スキーマ
│   └── prisma/
│       ├── schema-advisor.prisma        ← Advisor 関連 model 全部
│       └── schema-related.prisma        ← 参照される業務テーブル
│
├── ⚙️ 環境構築情報
│   ├── package-deps.md                  ← npm 依存パッケージ + バージョン
│   ├── env-vars.md                      ← 環境変数 + 取得方法
│   ├── vercel-config.md                 ← vercel.json 抜粋
│   └── extra-config/                    ← 設定ファイル原本
│       ├── middleware.ts
│       ├── globals.css
│       ├── tailwind.config.ts
│       ├── package.json
│       ├── vercel.json
│       └── tsconfig.json
│
└── 🤝 統合相談用
    └── INTEGRATION_QUESTIONS.md         ← hub-platform 側 LLM に投げる質問
```

---

## 3. このパッケージの作り方 (TASTAS 側)

`scripts/build-advisor-handoff.sh` で機械的部分は再生成可能。
手書きドキュメント (docs/ + knowledge/ + 入口) は静的に管理。

```bash
# TASTAS 側で更新があったら再生成
bash scripts/build-advisor-handoff.sh
```

---

## 4. hub-platform 側でやること (読んだ後)

1. **このパッケージ全体を読む** (推奨順序: §1 の通り、1-2 時間)
2. **[INTEGRATION_QUESTIONS.md](./INTEGRATION_QUESTIONS.md) の質問に回答する**
3. **hub-platform 側の現状ドキュメントと突き合わせる**:
   - `hub-platform/docs/PLATFORM_VISION.md`
   - `hub-platform/SYSTEM_OVERVIEW.md`
   - `hub-platform/AI_AGENT_SPEC.md` (agent-hub の現状把握)
   - `hub-platform/CA_CANVAS_SPEC.md`
4. **統合方針案を 2-3 個提示** + それぞれの工数 / リスク / メリット
5. ユーザー (川島) と議論 → 方針決定

---

## 5. 触ってはいけないこと

- 本パッケージは **読み取り専用**。本コピーを編集して TASTAS 本体に push しない (元コピーは TASTAS で本番運用中)
- hub-platform 側 LLM は **既存 agent-hub をいきなり改造しない** (Phase 7 まで触らない方針)
- **TASTAS 側の本番 DB / Vercel 環境変数を絶対に触らない** (本パッケージにそれらの認証情報は入っていない)

---

## 6. 何かおかしい時

- このパッケージの矛盾 / 古い情報を見つけたら → ユーザー (川島) に報告
- 仕様書とコードが食い違ったら → **コードが正** (仕様書は陳腐化リスクがあるため)
- ナレッジが理解できない → BUG_FIX_PLAYBOOK の該当エピソードに戻って文脈を補完

---

## 7. このパッケージの限界 (= 何が入っていないか)

- **本番のリアルデータ**: テストデータも含めて一切なし (個人情報保護)
- **API キー / シークレット**: env-vars.md に「変数名と取得方法」のみ。実値はなし
- **動作確認済みの hub-platform 側統合方針**: まだ決まっていない (これから相談)
- **ユーザーの "好み"**: 大半はナレッジに書いたが、暗黙的に守られているものは漏れてる可能性あり
