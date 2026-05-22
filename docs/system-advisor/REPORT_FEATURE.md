# Canvas + レポート機能 — 全体設計とチャットフロー

**スコープ**: 右側 Canvas UI と「レポート作成」機能
**最終更新**: 2026-05-02

このドキュメントは「**チャットからレポート完成までの一連の流れ**」を、
ユーザー操作・LLM ツール呼び出し・DB 状態・UI 表示の対応関係まで含めて
**漏れなく**追えるようにすることが目的。

別資料との関係:
- [HANDOFF.md](./HANDOFF.md) — Advisor 全体の引き継ぎ (チャット本体、認証、知識同期等)
- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — デプロイ手順
- [system-prompt.md](./system-prompt.md) — Claude のシステムプロンプト

---

## 0. 用語

| 用語 | 意味 | DB / コード |
|---|---|---|
| **レポート要件** | タイトル / 期間 / データソース / metric_keys / outline / notes | `AdvisorReportDraft` の各カラム |
| **ドラフト本体** | 0 埋めの表骨格 + 章立てが入った Markdown (Canvas のプレビュー) | `AdvisorReportDraft.skeleton_markdown` |
| **元の要望** | このドラフトを作るきっかけになったユーザー初回メッセージ | `AdvisorReportDraft.original_request` |
| **レポート (本文)** | 数字 / 表 / コメントが実際に入った最終 Markdown | `AdvisorReportVersion.result_markdown` |
| **ドラフト** | 上記 4 つを総称した「準備状態」 | `AdvisorReportDraft` 1 行 |

「**ドラフト更新**」と「**レポート作成 (本文生成)**」は別工程。
ドラフト更新は軽い (DB upsert)、レポート作成は重い (Gemini 呼び出し、10〜30 秒、課金あり)。

---

## 1. 全体アーキテクチャ

```
┌─────────────────┐                ┌──────────────────────┐
│ Chat (Anthropic) │                │ Right Canvas (UI)    │
│  - Sonnet 4      │                │  - ドラフト要件編集   │
│  - tool use      │                │  - ドラフト本体表示   │
└────────┬─────────┘                │  - 手動編集          │
         │                          │  - レポート作成ボタン │
         │ ① update_report_draft    └────────┬─────────────┘
         │   (要件 / skeleton 更新)          │ ⑤ 2 秒間隔ポーリング
         ▼                                    │   getDraftForSession()
┌─────────────────────────────────────────────▼─────┐
│  AdvisorReportDraft テーブル (1 セッション 1 行) │
│  - title / goal / range / data_sources           │
│  - metric_keys / outline / notes                 │
│  - original_request / skeleton_markdown          │
│  - status / result_markdown / result_model       │
└─────────────────┬─────────────────────────────────┘
                  │ ④「レポート作成」ボタン押下
                  │   POST /api/advisor/report/generate
                  ▼
┌─────────────────────────────────────────────────────┐
│ reports/generate.ts                                  │
│  ① collectReportData() で並列にデータ収集           │
│     - query_metric を全 supportedGroupBy で叩く      │
│     - query_ga4 / get_jobs_summary etc.              │
│  ② buildUserPrompt() で Gemini プロンプト構築       │
│     - 要件 + original_request + skeleton + 収集 JSON │
│  ③ Gemini 2.5 Flash で本文生成                       │
│  ④ AdvisorReportVersion として保存                   │
└─────────────────────────────────────────────────────┘
```

### 1-2. 第二経路: Gemini Canvas 連携 (2026-05-03 追加)

Anthropic ノードアフィニティ問題 (loop=1 TTFB 100 秒級) を構造的に回避するため、
重い編集処理をブラウザの Gemini Canvas (gemini.google.com) に外出しする経路を追加。
既存の Anthropic + サーバー側 Gemini 経路と並行して使えるハイブリッド構成。

```
[ユーザー]「Gemini Canvas で編集」ボタン押下
   ↓
[クライアント] getDraftWithCollectedData(sessionId)
   ↓
[サーバー] reports/collect.ts でデータ収集 → ドラフト + 収集データを返す
   ↓
[クライアント] gemini-canvas-bridge.ts:
   ① buildGeminiPrompt() で雛形 + 収集データ + 指示文を組立
   ② navigator.clipboard.writeText() で自動コピー
   ③ window.open('https://gemini.google.com/app?text=...') で別タブ表示
   ↓
[ユーザー] Gemini Canvas タブで Cmd+V 貼り付け → Canvas で編集 → コピー
   ↓
[ユーザー] TASTAS タブに戻る (focus イベント)
   ↓
[クライアント] navigator.clipboard.readText() でクリップボード覗き
   ↓ looksLikeReportMarkdown() で markdown らしさ判定
   ↓ 確認ダイアログ → OK で textarea に自動投入
   ↓
[ユーザー]「確定して保存」押下
   ↓
[サーバー] saveGeminiCanvasVersion() で AdvisorReportVersion (source='gemini_canvas') として保存
```

**メリット**:
- Anthropic loop=1 TTFB 問題の影響を受けない
- Gemini API キー不要 (ブラウザの Gemini を使う)、追加コストゼロ
- ベンダーロックインを緩和 (Anthropic 障害時も Gemini で運用継続)
- ユーザーが Gemini Canvas の編集機能をそのまま使える

**デメリット**:
- 手動でタブ切替が必要 (UX が一手間多い)
- クリップボード経由のため大量データには不向き
- Gemini Canvas の出力品質はユーザーが目視確認する必要あり

**役割分担**: 「**Anthropic Claude で対話的に要件固め → Gemini で本文生成**」。
重い本文生成を Anthropic のツールループで処理しないことで、Advisor 全体の速度とコストを安定させる。

---

## 2. ユーザーが見える 6 つの動線

### 動線 A: チャットでレポートを依頼する (初回)

```
[ユーザー] 「ツール ▼ → レポート作成 を選択」
[ユーザー] 「先週のUUアクセスページランキング、データは提案して」を送信
   ↓ メッセージ先頭に [TOOL:report_create] hidden hint が付く (ユーザーには見えない)
   ↓
[サーバー] orchestrator.ts:
   - hidden hint を剥がして DB 永続化 / audit ログ
   - Claude に hint 込みで送る (文脈判断用)
   ↓
[Claude] update_report_draft ツールを 1 回だけ呼ぶ:
   - title / goal / range / data_sources / metric_keys / outline / notes / skeleton_markdown
   - 全部一括セット
   - サーバーが original_request にユーザーの初回メッセージを自動保存
   ↓
[Claude] tool 実行後 1〜2 行の差分説明を text で返す:
   - 例: 「LP 別実績表 (LP1〜LP3) と GA4 ページビューを含めたドラフトを作りました」
   ↓
[Canvas] 右ペインが自動オープン:
   - 上: ドラフト本体プレビュー (skeleton_markdown を Markdown で描画)
   - 下: レポート要件 (折りたたみで隠れる、開けば編集可)
   - フッター: [ドラフト更新] [レポート作成 (本文生成)] の縦並び
```

### 動線 B: チャットでドラフトを修正する

```
[ユーザー] (Canvas 開いた状態でチャット入力欄)
   ↓ ChatInput が forcedTool="draft_revise" を自動オン (誤選択防止のため通常メニューには出さない)
[ユーザー] 「LP5 まで足して」を送信 → [TOOL:draft_revise] LP5 まで足して
   ↓
[サーバー] orchestrator.ts:
   - hidden hint を剥がして DB / audit に保存
   - **system prompt の dynamic 部分に現在のドラフト全体を埋めて Claude に渡す**
     (これによって get_report_draft ツール往復が不要、loop=1 の TTFB 100 秒問題を回避)
   ↓
[Claude] update_report_draft で差分を送る:
   - skeleton_markdown を書き換え (LP1〜LP5 の表に拡張)
   - 必要なら outline / metric_keys / notes も同時更新
   ↓
[Claude] 1〜2 行の差分説明を text で返す:
   - 例: 「LP 別実績表を LP1〜LP5 に拡張しました」
   ↓
[Canvas] 2 秒間隔のポーリングで skeleton_markdown 更新を検知 → プレビュー再描画
```

### 動線 C: ユーザーが Canvas で要件を直接編集する

```
[ユーザー] レポート要件を展開 (折りたたみクリック)
[ユーザー] タイトル / 目的 / 期間 (date picker) / データソース (チェックボックス)
            metric_keys (チェックボックス) / outline / notes を直接編集
   ↓ 各フィールドの onChange でローカル state (draftEdit) に蓄積
   ↓ チャット側のポーリング (Claude の更新) は draftEdit が non-null の間ポーズ
   ↓
[ユーザー] フッターの [ドラフト更新] ボタン押下
   ↓
[Server Action] updateDraftBulk():
   - 全フィールドを一括 upsert (Claude 経由しないので 100% 反映)
   - 編集ロックを解除
   ↓ ポーリング再開
[Canvas] 「保存しました ✓」を 1.8 秒表示
```

### 動線 D: ユーザーが Canvas で skeleton_markdown を直接編集する

```
[ユーザー] レポートプレビューの「手動編集」ボタン押下
   ↓ Markdown textarea が展開 (現状の skeleton_markdown が入っている)
[ユーザー] 自由に編集 → [保存]
   ↓
[Server Action] updateDraftBulk({ skeletonMarkdown: ... })
   ↓
[Canvas] 編集モード終了、プレビュー再描画
```

### 動線 E: ドラフト送信中の競合

```
[ユーザー] Canvas でフィールド編集中 (draftEdit が non-null)
   ↓ ポーリング停止 (Claude の更新があっても上書きされない)
[ユーザー] チャットで指示送信
   ↓ chat-layout.tsx:
   - discardCanvasEditTrigger を +1
   - ReportCanvas が draftEdit = null にリセット (未保存変更は破棄)
   ↓ ポーリング再開
[Claude] DB 更新 → 次のポーリングで Canvas に反映
```

ポリシー: **チャットで指示が送られた瞬間、ユーザーの未保存編集は破棄される**
(「書き換えが始まったら無視」というユーザー合意)。

### 動線 F: 「レポート作成 (本文生成)」ボタン

```
[ユーザー] フッターの [レポート作成 (本文生成)] 押下
   ↓
[Client] POST /api/advisor/report/generate (sessionId のみ)
   ↓
[Server] reports/generate.ts:
   1. AdvisorReportDraft を読む
   2. status = 'generating'
   3. collectReportData() — 並列データ収集
   4. Gemini 2.5 Flash に投入
   5. [自動補完フック (動線 G)] (ADVISOR_AUTO_FILL_ENABLED=true のとき)
   6. 結果を AdvisorReportVersion (新バージョン) として保存
   7. status = 'completed'
   ↓
[Canvas] 「ドラフト / レポート (v1)」タブが現れる
[Canvas] レポートタブを自動表示 (生成直後のみ)
[Canvas] フッターのボタン群が変わる: コピー / 編集 / Chat に送信 / レポート作成 (再作成)
```

### 動線 G: レポート自動補完 (Claude Haiku、2026-05-07 追加 / 2026-05-17 強化)

> **目的**: Gemini 単発の skeleton 埋めではデータが不足する空セルを、Claude が tool-use で
> 取り直して埋める。Gemini = レイアウト整形 / Claude = 取りこぼし補完 の分業構造。

```
[Server] reports/generate.ts:
   ...
   5. auto-fill フック (ADVISOR_AUTO_FILL_ENABLED=true):
      a. gap-detector.detectGapBlocks() で表を走査
         - 全セル空率 >= 80% の表
         - または「1 列以上が完全に空」の表 (PV だけ埋まり LINE クリックは "-" のような部分空)
      b. groupGapBlocks() で章単位にまとめる
      c. autoFillReportGaps() が各ブロックを並列に処理:
         - 1 ブロック = 1 Claude Haiku 4.5 セッション
         - 渡すツール 4 種: query_metric / query_ga4 / query_search_console / get_table
         - 渡すユーザープロンプト: 現在の JST 日付 / 集計期間 / 章タイトル / 元 Markdown ブロック
         - システムプロンプトは METRIC_CATALOG から動的生成 (利用可能 / 取得不可指標を網羅)
         - MAX_TOOL_LOOPS=8、1 ブロック 30 秒タイムアウト
         - 失敗時は元の Markdown をそのまま返す (壊さない)
      d. anySuccess=true なら finalMarkdown を Claude 出力で置換
      e. createReportVersion() の resultModel に "+autofill" サフィックス付与
```

**設計判断**:
- **モデル**: Claude Haiku 4.5 (Sonnet の 1/3 価格)。表整形は単純なので Haiku で十分。1 レポートあたり推定 $0.01〜0.05
- **ツール選定**: `execute_sql` は意図的に外す (ユーザー承認モーダル前提 + 試行錯誤の token 浪費リスク)
- **再帰しない**: 失敗ブロックでもループせず、tool_use loop 上限で打ち切り、元 Markdown を保持
- **opt-in**: env `ADVISOR_AUTO_FILL_ENABLED=true` で有効化。デフォルト OFF
- **デバッグ**: `ADVISOR_AUTO_FILL_DEBUG=true` で詳細ログ (`[auto-fill:claude]` プレフィックス)

**実装ファイル**:
- `src/lib/advisor/reports/gap-detector.ts` — 空セル検出 (列単位 / 全体閾値の二段)
- `src/lib/advisor/reports/auto-fill.ts` — Claude Tool Use ループ本体

---

## 3. データモデル

### `AdvisorReportDraft` (1 セッション 1 行)

| フィールド | 型 | 用途 | 誰が書くか |
|---|---|---|---|
| id | cuid | PK | auto |
| session_id | string UNIQUE | `AdvisorChatSession.id` 参照 | auto |
| admin_id | int | `SystemAdmin.id` | auto |
| title | string? | レポートタイトル | Claude / 手動編集 |
| goal | text? | 目的・問い | Claude / 手動編集 |
| data_sources | Json? | ツールキー配列 | Claude / 手動編集 |
| metric_keys | Json? | query_metric の取得対象 metric キー配列 | Claude / 手動編集 |
| range_start | string? | YYYY-MM-DD (JST) | Claude / 手動編集 |
| range_end | string? | YYYY-MM-DD (JST) | Claude / 手動編集 |
| outline | text? | 章立て (見出しだけ 3〜6 行) | Claude / 手動編集 |
| notes | text? | 追加メモ・除外条件 | Claude / 手動編集 |
| **original_request** | text? | ユーザー初回要望 (生のメッセージ) | サーバー (初回 update_report_draft 時のみ) |
| **skeleton_markdown** | text? | ドラフト本体 (0 埋めの表骨格) Markdown | Claude / 手動編集 |
| status | string | `drafting` / `generating` / `completed` / `failed` | サーバー |
| result_markdown | text? | (legacy) 旧バージョンキャッシュ | サーバー |
| result_model | string? | `gemini-2.5-flash` | サーバー |
| error_message | text? | 失敗時 | サーバー |
| generation_count | int | 累積生成回数 | サーバー |
| generated_at | DateTime? | 最終生成時刻 | サーバー |

### `AdvisorReportVersion` (本文の世代管理)

```
draft_id ── 1 ─── N ── result_markdown (各バージョン)
```

| ソース種別 | 意味 |
|---|---|
| `generated` | Gemini が初版・再作成で生成 |
| `manual_edit` | ユーザーが Canvas 編集モードで保存 |
| `llm_edit` | チャットで「○章を簡潔に」依頼 → `edit_report_section` ツール経由 |

---

## 4. Anthropic ツール一覧 (レポート関連)

| ツール名 | 役割 | 配置 |
|---|---|---|
| `update_report_draft` | 要件 / skeleton_markdown / 元要望 (初回のみ) を一括 upsert | `tools/reports/update-report-draft.ts` |
| `edit_report_section` | 生成済みレポート本文を Gemini で部分修正 (新バージョン作成) | `tools/reports/edit-report-section.ts` |

**廃止済み**: `get_report_draft` (2026-05-02 削除)。dynamic system prompt にドラフト全体が埋め込まれるためツール往復が不要に。

---

## 5. システムプロンプトの構造 (Claude 側)

```
┌── cachedPart (5 分 ephemeral cache 対象) ──────────┐
│ ROLE_AND_MISSION                                   │
│ CRITICAL_CONSTRAINTS                                │
│ TOOLS_HINT                                          │
│   - レポート作成モードのフロー                      │
│   - グラフ未対応の制約                              │
│   - draft_revise の対応パターン                     │
│ buildMetricsCatalogSection()                        │
│   - METRIC_CATALOG を Markdown 表で展開             │
│ RESPONSE_STYLE                                      │
│ SAFETY_FALLBACK                                     │
│ プロジェクト知識ブロック                            │
│   - CLAUDE.md / schema.prisma / docs                │
└────────────────────────────────────────────────────┘

┌── dynamicPart (毎リクエスト変わる) ─────────────────┐
│ # このセッションの情報                              │
│   - 質問者 / 現在時刻 (JST) / セッション ID         │
│ # 現在のレポートドラフト状態 (ドラフトがあれば)     │
│   - original_request (元の要望)                     │
│   - 要件メタ (title / goal / range / data_sources)  │
│   - outline / notes                                  │
│   - skeleton_markdown (Markdown コードブロック)      │
└────────────────────────────────────────────────────┘
```

**重要**: 最後の「現在のレポートドラフト状態」を毎回入れることで、
Claude は `get_report_draft` ツールを呼ばずにドラフト全体を把握できる。

---

## 6. UI フロー詳細 (Canvas)

### 6-1. オープン契機

| 契機 | コード位置 |
|---|---|
| 会話切替時 | `chat-layout.tsx` `useEffect([conversationId])` で `getDraftForSession()` を叩く |
| 「レポート作成」ツール送信時 | `handleChatSubmit()` で `setHasDraft(true)` + `setCanvasOpen(true)` |
| Claude が `update_report_draft` を呼んだ時 | streamRequest の sources に含まれていれば自動オープン |

### 6-2. Canvas のレイアウト

```
┌─ ヘッダー: タイトル + 🔴ドラフトバッジ + 再読込 / ゴミ箱 ────┐
├─ アニメーション帯 (ドラフト作成中 / 生成中のみ) ─────────────┤
├─ タブ (本文ある時のみ): [ドラフト] [レポート (vN)] ──────────┤
├─ コンテンツ (ScrollArea):                                       │
│  ┌─ ドラフトビュー: ───────────────────────────────────────┐ │
│  │ レポートプレビュー (skeleton_markdown を描画)             │ │
│  │   - 「手動編集」ボタンで textarea 展開                   │ │
│  │ レポート要件 (折りたたみ、デフォルト閉じ):                │ │
│  │   - タイトル / 目的 (textarea)                           │ │
│  │   - 期間 (date picker × 2)                                │ │
│  │   - データソース (チェックボックス × 10)                  │ │
│  │   - 取得指標 (チェックボックス × 14、available のみ選択可) │ │
│  │   - アウトライン / メモ (textarea)                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  または レポート結果ビュー: Gemini が生成した Markdown      │
├─ フッター:                                                     │
│  ドラフト時 → [ドラフト更新] (上) / [レポート作成] (下、縦並び) │
│  本文あり → [コピー] [編集] [Chat に送信] [レポート作成]        │
└────────────────────────────────────────────────────────────────┘
```

### 6-3. リサイズ

- Canvas とチャット領域の境界 (`width=4px` の縦バー) をマウスドラッグで横幅変更
- 範囲: `360px` 〜 `(window.width - 320)px`
- localStorage `advisor-canvas-width` に保存 (再訪復元)
- デフォルト: `720px` (チャット欄より広い)

### 6-4. 進行中アニメーション

| フェーズ | 表示 |
|---|---|
| `drafting` (Claude が初回ドラフト作成中) | 「ドラフトを作成しています...」 + 青 shimmer |
| `updating` (Claude がドラフト修正中) | 「ドラフトを更新しています...」 + 青 shimmer |
| `generating` (Gemini が本文生成中) | 「レポートを生成しています...」 + 青 shimmer |
| `idle` | 非表示 |

---

## 7. データ収集 (`reports/collect.ts`)

`buildInputFor()` でツール別の引数を組み立て、並列実行する。

| ツールキー | レポート用引数 | 用途 |
|---|---|---|
| `query_metric` | metric_key × supportedGroupBy 全部で並列 (LP_PV なら 4 通り) | 各メトリクスの合計 + 内訳 (日別 / LP 別 / キャンペーン別) |
| `query_ga4` | report_type=overview, range | GA4 概要 |
| `query_search_console` | range, dimensions=[query], row_limit=50 | 検索キーワード |
| `get_jobs_summary` | なし | 求人スナップショット |
| `get_users_summary` | なし | ユーザースナップショット |
| `get_recent_errors` | limit=50 | 直近エラー |
| `get_supabase_logs` | window=last_24h, limit=100 | Supabase ログ |
| `get_vercel_logs` | limit=100 | Vercel ログ |
| `get_vercel_deployments` | limit=20 | デプロイ履歴 |
| `get_recent_commits` | limit=30 | GitHub コミット |

**廃止**: `list_available_metrics` (ツール自体が削除されたため自動スキップ)。

`query_metric` の挙動:
- ドラフトの `metric_keys` 配列の各キーについて、`METRIC_CATALOG.supportedGroupBy` 全て叩く
- 例: `LP_PV` → `none / day / lp_id / campaign_code` の 4 回 = LP 別表 + 日別グラフ素材が同時に揃う

---

## 8. Gemini プロンプト構造 (`reports/generate.ts`)

```
[システムプロンプト]
- データに無い数字を捏造しない
- skipped 章は省略 or 明記
- 数値は単位 + 期間明記
- JST 基準
- 文字数 500〜2000 字
- skeleton_markdown を踏襲して数字を埋める
- 同じ metric の複数 group_by を活用 (LP 別 / 日別 / キャンペーン別)
- グラフ生成は未対応 → 表で代替

[ユーザープロンプト]
# レポート要件
  - タイトル / 目的 / 期間
## ユーザー初回要望 (発端の文脈)   ← original_request
## アウトライン
## ドラフト本体テンプレート       ← skeleton_markdown を ```markdown でラップ
## 追加メモ・除外条件             ← notes

# 収集データ
## query_metric (LP_PV / group_by=none) ...
## query_metric (LP_PV / group_by=lp_id) ...
## query_ga4 ...
... (各ツールの結果を JSON で 50KB まで)
```

---

## 9. パフォーマンス特性

### 計測ツール

```bash
npx tsx scripts/advisor-latency-trace.ts          # 直近セッションの時系列内訳
grep advisor:trace /tmp/advisor-dev.log | tail   # ループ単位の詳細トレース
```

### 既知のボトルネック

- **Anthropic API のツール後 loop=1 TTFB**: 最終 text 生成で 100 秒級になることがある
  - 対策 1: dynamic system prompt にドラフト状態を埋めて get_report_draft 往復を排除
  - 対策 2: loop>0 で `max_tokens=512` に制限 (orchestrator.ts)
  - 対策 3: prompt cache を活用 (cachedPart で 5 分間 ephemeral)

- **Gemini Flash のレポート生成**: 10〜30 秒 (収集データ量による)
  - 対策: `collectReportData` 並列実行、各ツール 50KB に切り詰め

---

## 10. 動作確認手順 (ローカル)

```bash
# 0. 前提: ローカル DB に schema 反映済み
npx prisma db push

# 1. .env.local に GEMINI_API_KEY を追加 (https://aistudio.google.com/apikey)
echo 'GEMINI_API_KEY=AIza...' >> .env.local

# 2. dev 起動
rm -rf .next && npm run dev
```

ブラウザで `/system-admin/advisor`:

| # | 操作 | 期待 |
|---|---|---|
| 1 | ツール ▼ → 「レポート作成」を選択して送信 | Canvas が右に開いて、要件 + 0 埋め skeleton が表示される |
| 2 | チャットで「LP5 まで増やして」 | skeleton の表が LP1〜LP5 に広がる |
| 3 | Canvas の「手動編集」で skeleton 直接編集 → 保存 | 内容が反映される |
| 4 | レポート要件を直接編集 → [ドラフト更新] | フィールドが保存される |
| 5 | フッターの [レポート作成 (本文生成)] 押下 | Gemini が走り、本文が生成される (10〜30 秒) |
| 6 | 「コピー」「編集」「Chat に送信」が動く | OK |
| 7 | 結果ビューで [レポート作成] (= 再作成) | 新バージョンが作られる |

---

## 11. デバッグ tips

| 症状 | 確認 |
|---|---|
| Canvas が出ない | DevTools Console の `[advisor]` ログ / sources に `update_report_draft` が含まれているか |
| ドラフトが指示通り更新されない | audit_log の `update_report_draft` の input フィールドを確認 (`scripts/advisor-detailed-audit.ts`) |
| 「○○グラフ」と書かれて空のまま | システムプロンプトの「グラフ未対応」が効いていない可能性 → Gemini に表で代替させる指示を確認 |
| レポート生成 500 エラー | `GEMINI_API_KEY` 確認 / サーバーログ `Gemini 呼び出し失敗:` |
| 2 分以上かかる | `npx tsx scripts/advisor-latency-trace.ts` で loop 単位の TTFB を見る |
| 古い会話で `[TOOL:xxx]` が表示される | `stripToolHintPrefix` が `chat-layout.tsx` / `history-client.tsx` で呼ばれているか |

DB を直接見る:
```bash
npx prisma studio
# advisor_report_drafts / advisor_report_versions / advisor_audit_logs
```

---

## 12. 主要ファイル一覧

### スキーマ
- `prisma/schema.prisma` — `AdvisorReportDraft` / `AdvisorReportVersion`

### サーバー側ロジック
| ファイル | 役割 |
|---|---|
| `src/lib/advisor/llm/gemini.ts` | `@google/genai` 薄ラッパー (gemini-2.5-flash) |
| `src/lib/advisor/persistence/report-drafts.ts` | Prisma 操作 (upsert / get / markGenerating / saveResult) |
| `src/lib/advisor/persistence/report-versions.ts` | バージョン管理 (createVersion / getLatestVersion) |
| `src/lib/advisor/reports/collect.ts` | dataSources 並列収集 + query_metric の supportedGroupBy 展開 |
| `src/lib/advisor/reports/generate.ts` | collect → Gemini → save パイプライン |
| `src/lib/advisor/actions/report-drafts.ts` | Server Actions (`getDraftForSession`, `updateDraftBulk`, `clearDraftForSession`) |
| `src/lib/advisor/actions/report-versions.ts` | バージョン Server Actions |
| `src/lib/advisor/system-prompt.ts` | Claude のシステムプロンプト + dynamic ドラフト埋め込み |
| `src/lib/advisor/orchestrator.ts` | tool ループ本体 + 計測ログ + max_tokens loop 別制御 |
| `src/lib/advisor/message-display.ts` | `[TOOL:xxx]` 剥がしユーティリティ |

### Anthropic ツール
| ツール | 配置 |
|---|---|
| `update_report_draft` | `tools/reports/update-report-draft.ts` |
| `edit_report_section` | `tools/reports/edit-report-section.ts` |

### API
- `POST /api/advisor/report/generate` — body: `{ sessionId }` / `maxDuration: 120`

### UI
- `src/components/advisor/report/report-canvas.tsx` — Canvas 本体 (リサイズ / プレビュー / 要件編集)
- `src/components/advisor/chat/chat-layout.tsx` — Canvas との連携 / forcedTool=draft_revise
- `src/components/advisor/chat/chat-input.tsx` — ChatInput (forcedTool 受け入れ)
- `src/components/advisor/reports/reports-list.tsx` — `/system-admin/advisor/reports` 一覧
- `src/components/advisor/reports/report-detail.tsx` — バージョン詳細

### 検証スクリプト
- `scripts/advisor-latency-trace.ts` — セッション時系列分析
- `scripts/advisor-detailed-audit.ts` — audit_log 全件ダンプ
- `scripts/check-metrics-consistency.ts` — METRIC_CATALOG ↔ query-metric.ts の整合性 CI

---

## 13. 既知の制約

- **グラフ生成は未対応**。Markdown 出力のみ。グラフ要求時は表で代替表示する設計。
- **ファイル添付エクスポート未対応** (PDF / Excel)。コピーで Markdown を取り出す運用。
- **同時編集ロック未対応** (`lockEditing` はあるが UI で別管理者衝突を完全には防げない)。
- **Anthropic API loop=1 TTFB が時々 100 秒以上になる**。dynamic prompt 化と max_tokens 制限で軽減済みだが、API 側の問題は残存可能性あり。
- **ステージング / 本番 DB に列追加が必要** (`original_request`, `skeleton_markdown`, `metric_keys`)。`STAGING_DEPLOY_REQUEST.md` 参照。
