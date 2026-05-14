# 00. TASTAS System Advisor 概要 (3 分で読む)

**この文書の目的**: hub-platform 側 LLM が「何を見ているか」を最短時間で把握する。
詳細は 01-08 に分散している。

---

## 1. これは何か (1 行で)

**TASTAS の System Admin が、業務 KPI / GA4 / DB / ログ / GitHub を横断的に
LLM に質問できるチャット + Canvas でレポートを組み立てる管理ツール**。

URL: `/system-admin/advisor` (TASTAS 本番運用想定 / ローカル動作確認済み)

---

## 2. 画面構成 (3 つだけ覚える)

| 画面 | 役割 |
|---|---|
| **メイン画面** (`/system-admin/advisor`) | 左: チャット + サイドバー / 右: ReportCanvas |
| **履歴一覧** (`/system-admin/advisor/history` / `/reports`) | 過去のチャット / レポート一覧 |
| **公開シェアページ** (`/advisor/r/[token]`) | 認証なしで誰でもレポート閲覧可 (有効期限 30 日) |

詳細: [06_UI_BEHAVIOR_SPEC.md](./06_UI_BEHAVIOR_SPEC.md)

---

## 3. 機能の構成 (4 つだけ覚える)

### 3.1 一般チャット
ユーザーの自由文 → Anthropic Claude Sonnet 4.6 が判断してツール呼び出し → 結果を
混ぜて回答。19 個のツールから自動選択。

### 3.2 Canvas (レポート要件 + 0 埋め skeleton)
ユーザーが「ツール ▼ → レポート作成」で起動。LLM が要件 (タイトル / 期間 / 取得指標 / 章立て) と
0 埋めの表骨格 (`skeleton_markdown`) を 1 ターンで生成 → 右ペインに常時表示。
編集はチャット指示でも、ユーザー手動でも可。

### 3.3 レポート本文生成
Canvas フッターの「レポート作成 (本文生成)」ボタン → サーバー側で並列にデータ収集 →
**Gemini 2.5 Flash** で構造化 Markdown を生成 (15-30 秒) → `AdvisorReportVersion` として保存。
バージョン管理あり (vN, vN+1, ...)。

### 3.4 共有・しおり・自動削除
- 公開シェア URL (有効期限 30 日 + 延長 + 即時停止)
- しおり (永続保存) — しおり OFF なセッションは Draft / Versions が 30 日で cron 削除
- 監査ログは 90 日 (report 系は 180 日) 保持

---

## 4. アーキテクチャの肝 (これだけは絶対知っておく)

### 4.1 LLM 二本立て

| 用途 | モデル | 理由 |
|---|---|---|
| 一般チャット (質疑 / ツール選択) | Anthropic Claude Sonnet 4.6 | tool use の精度が高い |
| **レポート系 (重い処理)** | **Gemini 2.5 Flash 直叩きでバイパス** | Anthropic の loop=1 TTFB が 100 秒級になる事象を回避 |

詳細: [knowledge/DESIGN_DECISIONS.md](../knowledge/DESIGN_DECISIONS.md) §1.1

→ ユーザー入力先頭に hidden hint (`[TOOL:report_create|draft_revise|result_edit]`) があれば
   orchestrator が Gemini ルートに分岐。それ以外は通常の Anthropic ツールループ。

### 4.2 本番 DB は読み取り専用 (二重防御)

- **Postgres レベル**: `advisor_readonly` ロール (SELECT 権限のみ、INSERT/UPDATE/DELETE/TRUNCATE 剥奪)
- **アプリレベル**: `runReadOnly()` で `SET TRANSACTION READ ONLY` ラップ
- **ORM 分離**: `advisorDataPrisma` (本番 Supabase 用) と `prisma` (Advisor 自身のテーブル用) を別インスタンスに

詳細: [07_SECURITY_COST.md](./07_SECURITY_COST.md)

### 4.3 prompt cache + dynamic prompt

- **cachedPart** (5 分 ephemeral cache): METRIC_CATALOG + プロジェクト知識 + 制約
- **dynamicPart** (毎回): セッション情報 + **現在のレポートドラフト全体**

dynamic に毎回ドラフトを埋め込むことで、Claude が `get_report_draft` ツールを
呼ぶ往復を排除 (= loop=1 TTFB 短縮)。

詳細: [05_SYSTEM_PROMPT.md](./05_SYSTEM_PROMPT.md)

---

## 5. データモデル (10 テーブル)

| テーブル | 役割 |
|---|---|
| `AdvisorChatSession` | 会話セッション + しおり (`bookmarked`) |
| `AdvisorChatMessage` | メッセージ単位 (user/assistant/tool) |
| `AdvisorAuditLog` | 監査ログ (`payload.kind` で `report_*` を分類) |
| `AdvisorKnowledgeCache` | GitHub から同期した知識 |
| `AdvisorKnowledgeSyncLog` | 知識同期の実行ログ |
| `AdvisorSavedPrompt` | 保存プロンプト |
| `AdvisorUsageDaily` | 日次トークン使用量 (`date_jst` で集計) |
| `AdvisorReportDraft` | Canvas で固める要件 + skeleton_markdown |
| `AdvisorReportVersion` | レポート本文の版管理 + 共有 URL (`share_token` / `shared_until`) |
| `AdvisorSettings` | システム設定シングルトン |

詳細: [02_DATA_MODEL.md](./02_DATA_MODEL.md) (+ [prisma/schema-advisor.prisma](../prisma/schema-advisor.prisma))

---

## 6. ツール 19 個

5 カテゴリ:

| カテゴリ | 数 | 主なツール |
|---|---|---|
| **Core** | 5 | `read_repo_file` / `search_codebase` / `read_doc` / `get_recent_commits` / `list_directory` |
| **TASTAS Data** | 5 | `query_metric` / `get_jobs_summary` / `get_users_summary` / `get_recent_errors` / `describe_db_table` |
| **External** | 5 | `query_ga4` / `query_search_console` / `get_supabase_logs` / `get_vercel_logs` / `get_vercel_deployments` |
| **Future** | 2 | `query_lstep_events` / `query_line_friends` (placeholder) |
| **Reports** | 2 | `update_report_draft` / `edit_report_section` |

詳細: [03_TOOLS_SPEC.md](./03_TOOLS_SPEC.md)

---

## 7. 設計判断のなぜ (絶対に押さえる)

| なぜ | 結論 | 詳細 |
|---|---|---|
| なぜ Anthropic + Gemini の二本立て? | Anthropic の loop=1 TTFB が 100 秒級になる事象を回避するため | DESIGN_DECISIONS §1.1 |
| なぜ Gemini フォールバックを撤去? | 失敗時に Anthropic に流すと結局 100 秒待たされて UX 最悪 | DESIGN_DECISIONS §1.2 |
| なぜ get_report_draft ツール廃止? | dynamic system prompt に埋め込むことで往復排除 | 05_SYSTEM_PROMPT |
| なぜ list_available_metrics ツール廃止? | METRIC_CATALOG を system prompt に静的埋め込み | 05_SYSTEM_PROMPT |
| なぜポーリング停止条件を作らない? | 「Claude が更新したのに反映されない」事故を恐れる | ANTI_PATTERNS |
| なぜ skeleton で具体的 LP 名を書かせない? | LP 名取得バグの再発防止 (BUG_FIX_PLAYBOOK にエピソード) | ANTI_PATTERNS |
| なぜ checkCostCap がある? | 1 日のトークン上限ガード (chat/route.ts:143 で呼ばれている) | DESIGN_DECISIONS |
| なぜ in-memory 集計に take=100k? | OOM 防止 + JST 境界処理を SQL で書き換える事故リスク回避 | BUG_FIX_PLAYBOOK |

詳細: [knowledge/DESIGN_DECISIONS.md](../knowledge/DESIGN_DECISIONS.md)

---

## 8. 次に読むもの

- [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) — 全体構成図
- [04_REPORT_FEATURE.md](./04_REPORT_FEATURE.md) — Canvas + レポートの動線詳細
- [knowledge/DESIGN_DECISIONS.md](../knowledge/DESIGN_DECISIONS.md) — なぜこの設計か
- [knowledge/BUG_FIX_PLAYBOOK.md](../knowledge/BUG_FIX_PLAYBOOK.md) — 過去のバグ集
