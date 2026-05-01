# Canvas + レポート機能 引き継ぎ資料

**スコープ**: 右側 Canvas UI と「レポート作成」機能 **のみ**
**実装日**: 2026-05-01 (6)
**最終更新**: 2026-05-01

> 別セッションでこの機能を引き継ぐ人向けの **コンパクトサマリ**。
> Advisor 全体 (チャット本体・認証・知識同期等) は範囲外 — それは [HANDOFF.md](./HANDOFF.md)、
> デプロイ手順は [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) を参照。
>
> このドキュメントだけ読めば、**Canvas / レポート機能の全体像、コード位置、運用方法、未実装** が掴める想定。

---

## 0. 別セッションが最初にやること

1. このファイルを読む (5 分)
2. 動作確認手順 (§9) を実行できる状態か確認
   - ローカル DB に `advisor_report_drafts` テーブルがあるか (`npx prisma studio` で目視)
   - `.env.local` に `GEMINI_API_KEY` が入っているか
3. 改修 / 拡張の指示を受ける
4. 関連ファイルは §3 に全部リスト化済み

---

## 1. 機能概要 (ユーザー視点)

1. ユーザーが Advisor チャットで「先週のKPIをまとめて」のように依頼する
2. LLM (Anthropic Claude) は本文を書かず、**右側 Canvas にレポート要件のドラフトを書き出す**
3. ユーザーは追記指示で要件を固める ("期間は4/24〜4/30で", "GA4 も入れて")
4. 固まったら **「レポート作成」ボタン** を押す
5. サーバーが指定データソースを並列収集 → **Gemini 2.5 Flash** にまとめて投入
6. 生成された Markdown が同じ Canvas の「レポート」タブに表示される
7. 「再生成」「コピー」ボタン、ドラフトに戻って修正→再生成 が可能

---

## 2. アーキテクチャ (1 行で)

**Anthropic で対話的に要件固め → Gemini で本文生成** の役割分担。
Advisor のツールループ上限 (現在 20) を消費せずに重い処理が走る。

```
[Chat (Anthropic)]
      │
      │  ① ユーザー依頼を解釈
      │  ② update_report_draft ツールを呼ぶ (要件をDBに書く)
      ▼
[AdvisorReportDraft テーブル] ←── ⑤ Canvas が 2秒間隔でポーリング
      ▲                                         │
      │ ⑥ markGenerating / saveResult / saveError│
      │                                          │
      │  ④ "レポート作成" ボタン押下             │
      │     POST /api/advisor/report/generate    │
[reports/generate.ts]                            │
      │                                          │
      ├─→ [reports/collect.ts] 並列実行          │
      │     - query_metric / query_ga4 / etc    │
      │                                          │
      ├─→ [llm/gemini.ts] 1回でMarkdown生成      │
      │                                          │
      └─→ result_markdown を保存 ────────────────┘
```

---

## 3. ファイル一覧

### スキーマ
- `prisma/schema.prisma` — `AdvisorReportDraft` モデル (テーブル: `advisor_report_drafts`)

### ライブラリ
| ファイル | 役割 |
|---|---|
| `src/lib/advisor/llm/gemini.ts` | `@google/genai` 薄ラッパー (gemini-2.5-flash, 非ストリーミング) |
| `src/lib/advisor/persistence/report-drafts.ts` | Prisma 操作 (upsert / get / markGenerating / saveResult / saveError / delete) |
| `src/lib/advisor/reports/collect.ts` | dataSources の各ツールを並列実行。引数組立は `buildInputFor()` に集約 |
| `src/lib/advisor/reports/generate.ts` | collect → Gemini → save の生成パイプライン本体 |
| `src/lib/advisor/actions/report-drafts.ts` | Server Actions (`getDraftForSession`, `clearDraftForSession`) |

### Anthropic ツール (Function Calling)
| ツール名 | 役割 | 配置 |
|---|---|---|
| `update_report_draft` | LLM がチャット中にドラフトを部分更新 | `src/lib/advisor/tools/reports/update-report-draft.ts` |
| `get_report_draft` | LLM がドラフトの現在内容を確認 | `src/lib/advisor/tools/reports/get-report-draft.ts` |

`src/lib/advisor/tools/reports/index.ts` で集約 → `registry.ts` に `reportTools` として追加済み。

### API
- `POST /api/advisor/report/generate` — body: `{ sessionId }` / 認証: System Admin / `maxDuration: 120`

### UI
- `src/components/advisor/report/report-canvas.tsx` (420px 幅・右ペイン)
- `src/components/advisor/chat/chat-layout.tsx` に統合済み (LLM が `update_report_draft` 呼ぶと自動オープン)

### 補助
- `src/lib/advisor/tool-source-labels.ts` — `update_report_draft` / `get_report_draft` を登録済み (UI チップ用)
- `src/lib/advisor/orchestrator.ts` — `TOOL_STATUS_LABEL` に進捗ラベル追加済み
- `src/lib/advisor/system-prompt.ts` — 「レポート作成モード」章追加済み (LLM への使用指示)

---

## 4. データモデル

`AdvisorReportDraft` (1 セッション = 0 or 1 ドラフト, `session_id` が UNIQUE):

| フィールド | 型 | 用途 |
|---|---|---|
| id | cuid | PK |
| session_id | string | `AdvisorChatSession.id` 参照 (FK は貼らず論理参照) |
| admin_id | int | SystemAdmin.id |
| title | string? | レポートタイトル |
| goal | text? | 目的・問い |
| data_sources | Json? | ツールキー配列 (例: `["query_metric","query_ga4"]`) |
| range_start / range_end | string? | YYYY-MM-DD (JST) |
| outline | text? | アウトライン (Markdown 箇条書き) |
| notes | text? | 追加メモ・除外条件 |
| status | string | `drafting` / `generating` / `completed` / `failed` |
| result_markdown | text? | 生成完了後の本文 |
| result_model | string? | `gemini-2.5-flash` 等 |
| error_message | text? | 失敗時の詳細 |
| generation_count | int | 再生成カウンタ |
| generated_at | DateTime? | 最終生成時刻 |

---

## 5. 対応している data_sources

`reports/collect.ts` の `buildInputFor()` でデフォルト引数を持っているもの:

| キー | 何を取るか | 引数 |
|---|---|---|
| `query_ga4` | GA4 overview レポート | start_date / end_date 必須 |
| `get_jobs_summary` | 求人スナップショット | なし |
| `get_users_summary` | ユーザースナップショット | なし |
| `get_recent_errors` | 直近エラー 50 件 | limit=50 |
| `list_available_metrics` | 利用可能な指標一覧 | なし |
| `get_supabase_logs` | Supabase 直近 24h ログ 100 件 | window=last_24h |
| `get_vercel_logs` | Vercel ランタイムログ 100 件 | limit=100 |
| `get_vercel_deployments` | Vercel デプロイ履歴 20 件 | limit=20 |
| `get_recent_commits` | GitHub コミット 30 件 | limit=30 |

**未対応**: `query_metric` (どの指標を取るか確定できないため、現状は skipped)。
将来的には list_available_metrics で取れるキー全てを subset で取る等の拡張が必要。

新ツールを追加するときは:
1. `tools/<category>/<your-tool>.ts` 作成
2. `tool-source-labels.ts` にエントリ追加 (UI チップの表示名・カテゴリ)
3. `reports/collect.ts` の `buildInputFor()` に case を足す (レポート対応する場合)
4. `orchestrator.ts` の `TOOL_STATUS_LABEL` に進捗ラベル追加

---

## 6. UI フロー

### Canvas オープン契機 (chat-layout.tsx)
- 会話切替時: `getDraftForSession(conversationId)` を叩いて、ドラフト存在ならオープン
- 応答受信時: `result.sources.includes('update_report_draft')` ならオープン
- ヘッダーの FileText アイコン (条件: `hasDraft === true`) で開閉トグル可

### Canvas 内 (report-canvas.tsx)
- 2 秒間隔で `getDraftForSession` をポーリング (LLM 経由のドラフト変化を反映)
- 結果が無い間: ドラフトフィールド表示 + 「レポート作成」ボタン
- 結果あり: 「ドラフト / レポート (vN)」タブ切替 + 「再生成 / コピー」ボタン
- ステータス `generating` 中はインライン Spinner
- ステータス `failed` または `generateError` がある時は赤いエラーバナー

---

## 7. 環境変数 (新規追加)

| 変数 | 用途 | 取得元 |
|---|---|---|
| `GEMINI_API_KEY` | レポート本文生成 | https://aistudio.google.com/apikey |

`.env.local` に追加 → dev 再起動が必須。
ステージング / 本番は Vercel ダッシュボードから手動追加 (CLAUDE.md ルール、Claude Code 操作不可)。

DEPLOY_CHECKLIST.md の Vercel 環境変数セクションに追加すること。

---

## 8. 既知の制約・運用上の注意

### コスト
- 1 レポート生成 = Gemini Flash 1 コール (収集データを含む長文プロンプト)
- 入力トークン: dataSources の数とサイズに依存。現状は各ツール 50KB に切り詰め
- Anthropic と違いキャッシュ未使用、毎回フルプロンプト送信
- 生成は admin × session 単位でユーザー手動トリガなので暴走リスクは低いが、
  必要なら「1 admin 1日 N 回まで」の制限を report-drafts.ts に足す余地あり (未実装)

### セキュリティ
- API ルートは `requireAdvisorAuth()` で System Admin 認証必須
- ドラフト操作は `admin_id` 一致チェック (別 admin は読み書き不可)
- 収集データは「Advisor が読めるツール」だけなので、本番DB は読み取り専用 tx 経由

### 既知の未実装
- レポート結果の **履歴一覧画面** (現状は最新版のみ表示。`generation_count` は持っているが過去版は保持していない)
- レポート **PDF / HTML エクスポート** (Markdown コピー → 外部ツールで変換が必要)
- **Slack 通知 / メール送信** などの配信
- `query_metric` のレポート用デフォルト引数 (現状 skipped)
- **生成中の中断ボタン** (Gemini 呼び出しは AbortSignal 未対応のまま)

---

## 9. 動作確認手順

```bash
# 1. ローカル DB スキーマ反映 (advisor_report_drafts テーブル作成)
unset DATABASE_URL DIRECT_URL
npx prisma db push

# 2. .env.local に GEMINI_API_KEY を追加
echo 'GEMINI_API_KEY=AIza...' >> .env.local   # 値はユーザーが取得

# 3. dev サーバー再起動
lsof -ti :3000 | xargs kill -9 2>/dev/null
rm -rf .next
npm run dev
```

ブラウザで `/system-admin/advisor` を開き:

1. 新規 chat で「先週のKPIをまとめて」と送信
2. 数秒後、右側に Canvas が自動オープン (タイトル / データソース / 期間が埋まっている)
3. 「期間は 2026-04-24 〜 2026-04-30 で」「GA4 も入れて」など追記指示
4. Canvas のフィールドが順次更新される
5. 「レポート作成」ボタン押下 → Gemini 生成 → 「レポート (v1)」タブ表示
6. 「再生成」で v2 が作れる

---

## 10. デバッグ tips

| 症状 | 確認 |
|---|---|
| Canvas が出ない | LLM 応答の sources に `update_report_draft` があるか / DevTools Console の `[advisor]` ログ |
| ドラフトが更新されない | `update_report_draft` ツールがちゃんと invoke されたか (orchestrator の status イベント) |
| レポート生成 500 エラー | サーバーログで `Gemini 呼び出し失敗:` を grep / `GEMINI_API_KEY` 確認 |
| 収集データが skipped 多発 | `reports/collect.ts` の `buildInputFor()` で対応していないツールキーを使っていないか |
| 生成本文が短い・歪 | dataSources が空か / 各ツールが ok=false (error) で返してないか |

DB を直接見るには:
```bash
npx prisma studio
# advisor_report_drafts テーブルで status / data_sources / result_markdown を確認
```
