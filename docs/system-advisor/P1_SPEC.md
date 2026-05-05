# Advisor P1 実装仕様 (確認後・確定版)

**対象**: feature/system-advisor-chatbot ブランチで P1 として実装する 8 項目
**スコープ**: 仕様確定済み、実装順次着手中。
**最終更新**: 2026-05-01 (v2: ユーザー確認後の改訂版)

## 改訂履歴
- 2026-05-01 v1: 初版 (7項目)
- 2026-05-01 v2: ユーザー確認反映
  - **P1-4 PDF/HTML エクスポート → 削除** (不要)
  - **P1-5 Slack/メール配信 → Google Chat Webhook 配信に変更**
  - **P1-3 履歴一覧 → 全部残す + 個別削除可能の方針確定**
  - **P1-8 新規追加**: チャット欄に「レポート作成」ボタン
  - **P1-9 新規追加**: 結果ビュー上での編集 (手動編集 + LLM 部分修正の双方対応、Gemini Canvas 風)

> このドキュメントは「すでに大枠は固まっている」前提の確認用。
> 各項目は **(A) 現状 → (B) 変更内容 → (C) 仕様** の 3 段で記述。
> ユーザー確認 OK な項目は ☑、修正したい項目は メモ追記、で進める。

---

## P1-1. Search Console API 統合 ☐

### 現状
- [src/lib/advisor/tools/future/query-search-console.ts](../../src/lib/advisor/tools/future/query-search-console.ts) にスタブのみ
- `available()` は常に `ready: false` を返す
- 実際の API 呼び出しは未実装

### 変更内容
1. `tools/future/` → `tools/external/` に移動 (本実装になるので)
2. Google Search Console API の認証・呼び出しコードを実装
3. `external/index.ts` に登録 (registry.ts は不要 = `external/index.ts` から自動 import)
4. `tool-source-labels.ts` の登録は既にあるので不要、ラベル文言だけ確認

### 仕様

**ツール名**: `query_search_console` (現状のまま)

**入力 (確定)**:
```json
{
  "type": "object",
  "properties": {
    "start_date": { "type": "string", "description": "YYYY-MM-DD (JST)" },
    "end_date":   { "type": "string", "description": "YYYY-MM-DD (JST)" },
    "dimensions": {
      "type": "array",
      "items": { "type": "string", "enum": ["query", "page", "country", "device", "date"] },
      "description": "集計軸 (例: ['query'] で検索ワード別集計)"
    },
    "row_limit":  { "type": "integer", "default": 50, "maximum": 500 },
    "search_type": {
      "type": "string",
      "enum": ["web", "image", "video", "news"],
      "default": "web"
    }
  },
  "required": ["start_date", "end_date"]
}
```

**出力**:
```json
{
  "rows": [
    { "keys": ["看護師 求人 大阪"], "clicks": 12, "impressions": 340, "ctr": 0.035, "position": 8.4 }
  ],
  "totals": { "clicks": 1234, "impressions": 56789 },
  "period": { "start": "2026-04-24", "end": "2026-04-30" },
  "site_url": "sc-domain:tastas.work"
}
```

**認証**:
- GA4 と同じ Service Account を流用 (`GOOGLE_APPLICATION_CREDENTIALS` または `GA_CREDENTIALS_JSON`)
- ただし Search Console 側で Service Account のメールアドレスを **「ユーザーと権限」に追加する必要あり** (制限付きユーザー以上)
- これは **ユーザー作業** (Claude Code 操作不可)

**環境変数 (追加)**:
| 変数名 | 用途 | 例 |
|---|---|---|
| `SEARCH_CONSOLE_SITE_URL` | 対象サイトの property URL | `sc-domain:tastas.work` または `https://tastas.work/` |

**available() ロジック**:
- GA4 と同じ認証情報があり、`SEARCH_CONSOLE_SITE_URL` が設定されているか
- 認証情報なし or site_url 未設定 → ready: false

**実装ファイル**:
- 新規: `src/lib/advisor/tools/external/query-search-console.ts`
- 削除: `src/lib/advisor/tools/future/query-search-console.ts`
- 編集: `src/lib/advisor/tools/external/index.ts` (export 追加)
- 編集: `src/lib/advisor/tools/future/index.ts` (export 削除)
- 新規 (任意): `src/lib/search-console-client.ts` (GA4 と同じパターンで wrapper)

**npm 依存**:
- `googleapis` (GA4 で既に入っている可能性大、確認)

**ユーザー作業**:
1. Service Account のメールアドレスを Google Search Console で property に追加
2. `.env.local` に `SEARCH_CONSOLE_SITE_URL=sc-domain:tastas.work` を追加
3. 動作確認: 「先週の検索流入トップ 10」など

---

## P1-2. 長時間ツール status 改善 ☐

### 現状
- [src/lib/advisor/orchestrator.ts:106-130](../../src/lib/advisor/orchestrator.ts) に `TOOL_STATUS_LABEL` で固定文言
- 5 秒ごとに heartbeat イベントが飛ぶが、ラベル自体は変わらない
- ユーザーは経過秒数で「動いてるか」を判断する

### 変更内容
heartbeat の `label` フィールドを **経過時間によって動的に変える**。

### 仕様

**経過時間ベースのラベル更新ルール**:

| 経過時間 (ツールフェーズ中) | ラベル例 |
|---|---|
| 0〜5 秒 | `Vercel ログを取得中...` (現状のまま) |
| 5〜15 秒 | `Vercel ログを取得中... (まだ取得中)` |
| 15〜30 秒 | `Vercel ログを取得中... (時間がかかっています)` |
| 30 秒〜 | `Vercel ログを取得中... (もうしばらくお待ちください)` |

**実装場所**: [orchestrator.ts](../../src/lib/advisor/orchestrator.ts) の heartbeat タイマー内

```typescript
// pseudo-code
const heartbeatTimer = setInterval(() => {
  const elapsed = Date.now() - phaseStartedAtMs   // ← 新規: フェーズ単位の経過時間
  let label = currentPhaseLabel
  if (currentPhase === 'tool') {
    if (elapsed > 30_000)      label = `${currentPhaseLabel} (もうしばらくお待ちください)`
    else if (elapsed > 15_000) label = `${currentPhaseLabel} (時間がかかっています)`
    else if (elapsed > 5_000)  label = `${currentPhaseLabel} (まだ取得中)`
  }
  input.onEvent({ type: 'heartbeat', phase: currentPhase, label, elapsedMs: ..., outputTokens: ... })
}, HEARTBEAT_INTERVAL_MS)
```

**追加変数**: `phaseStartedAtMs` (フェーズ切替時にリセット)
- `currentPhase`/`currentPhaseLabel` を更新する 4 箇所すべてで `phaseStartedAtMs = Date.now()` をセット

**UI 側変更**:
- [status-indicator.tsx](../../src/components/advisor/chat/status-indicator.tsx) は label を表示するだけなので**変更不要**

**監査ログへの影響**: なし (UI 表示のみ)

---

## P1-3. レポート: 履歴一覧画面 (R1) ☐

### 現状
- `AdvisorReportDraft` は `session_id @unique` で **1 セッション = 1 ドラフトのみ保持**
- 再生成すると `result_markdown` が上書きされ、過去版は消える
- `generation_count` カウンタはあるが過去版本文は残らない

### 方針 (確定)
- **全バージョンを保持** (上限なし、ストレージ消費は年間 30MB 未満想定)
- **個別削除は admin 操作で可能** (UI に削除ボタン)
- 自動削除ポリシーは設けない (将来 admin が "古いレポートを一括削除" のような UI が必要になったら追加検討)

### 変更内容
**過去版を残せるように DB スキーマを変更** + 履歴一覧画面を追加。

### 仕様

**スキーマ変更案**:

新規モデル `AdvisorReportVersion` を追加 (旧 result_markdown を切り出す):

```prisma
model AdvisorReportVersion {
  id              String   @id @default(cuid())
  draft_id        String   /// AdvisorReportDraft.id 参照
  version_number  Int      /// 1, 2, 3... (draft_id 内でユニーク)
  result_markdown String   @db.Text
  result_model    String   @db.VarChar(100)
  /// 生成時のドラフトのスナップショット (title, goal, dataSources, range, outline, notes)
  /// 生成後にドラフトを編集しても、このバージョンの "元" が分かるように残す
  draft_snapshot  Json
  /// 生成にかかった ms
  generated_ms    Int?
  /// 生成時の入力トークン (Gemini)
  input_tokens    Int?
  output_tokens   Int?
  created_at      DateTime @default(now())

  @@unique([draft_id, version_number])
  @@index([draft_id])
  @@map("advisor_report_versions")
}
```

`AdvisorReportDraft` への変更:
- `result_markdown` / `result_model` / `error_message` / `generated_at` フィールドはそのまま保持 (= 最新版のキャッシュ)
- 新規生成時は **AdvisorReportVersion に行追加 + AdvisorReportDraft の "最新キャッシュ" も更新** の二重書き込み

**画面**:
- 新規: `/system-admin/advisor/reports` — 全 admin の生成済みレポート横断一覧
- 新規: `/system-admin/advisor/reports/[versionId]` — 個別レポート閲覧 (Markdown 全文 + ドラフトスナップショット)
- 既存 Canvas でも、ドロップダウン or タブで「v1 / v2 / v3」を切替できるようにする

**画面 1: 一覧** `/system-admin/advisor/reports`
- カラム: 日付 / タイトル / 期間 / データソース数 / 生成 admin / バージョン / 結果サイズ
- 検索: タイトル text 検索 + 期間フィルタ
- 並び替え: 生成日時 DESC デフォルト
- ページング: 50 件ずつ
- クリック → 個別画面へ遷移

**画面 2: 個別** `/system-admin/advisor/reports/[versionId]`
- ヘッダー: タイトル / 期間 / 生成日時 / 生成 admin / バージョン番号
- 本文: ReactMarkdown で Markdown レンダリング (Canvas 結果ビューと同じ)
- アクション: コピー / **PDF / HTML エクスポート (P1-4 と統合)** / 「このセッションを開く」リンク
- ドラフトスナップショット (展開可能なアコーディオン): title/goal/dataSources/range/outline/notes

**Canvas での過去版アクセス**:
- 結果タブのバージョン表示が `v3` → ドロップダウンで `v1, v2, v3` 選択可能に
- 選択すると `result_markdown` を切替

**実装ファイル**:
- 編集: `prisma/schema.prisma` (AdvisorReportVersion 追加)
- 編集: `src/lib/advisor/persistence/report-drafts.ts` (`saveResult` でバージョン行も追加)
- 編集: `src/lib/advisor/actions/report-drafts.ts` (`listReportVersions`, `getReportVersion` Server Action 追加)
- 新規: `app/system-admin/advisor/reports/page.tsx`
- 新規: `app/system-admin/advisor/reports/[versionId]/page.tsx`
- 新規: `src/components/advisor/reports/reports-list.tsx`
- 新規: `src/components/advisor/reports/report-detail.tsx`
- 編集: `src/components/advisor/report/report-canvas.tsx` (バージョン切替)
- 編集: `src/components/system-admin/SystemAdminLayout.tsx` (ナビにリンク追加)

**DB 変更**: あり (1 テーブル新規追加 = `advisor_report_versions`)
- ローカル: `npx prisma db push` (ユーザー作業)
- ステージング/本番: DEPLOY_CHECKLIST.md に追記 (8 → 9 → 10 テーブルに)

**マイグレーション戦略**:
- 既存の `AdvisorReportDraft.result_markdown` がある行は、移行スクリプトで AdvisorReportVersion に v1 として複製する
- 移行スクリプトは `scripts/migrate-report-drafts-to-versions.ts` として用意 (ユーザー手動実行)

---

## P1-4. ~~PDF / HTML エクスポート~~ → 削除 ✗

ユーザー確認の結果、**PDF・HTML エクスポートともに不要**。
コピー機能 (現状実装済み) + Google Chat 配信 (P1-5) で十分とのこと。

→ 番号は欠番のまま (順序の都合で再番号しない)。

---

## P1-5. レポート: Google Chat 配信 ☐

### 現状
- 配信機能なし (コピーして手動で貼り付ける運用)

### 変更内容
個別レポート画面 + Canvas 結果ビューに「Google Chat に送信」ボタン追加。

### 仕様

**Google Chat Incoming Webhook**:

| 項目 | 仕様 |
|---|---|
| 送信先 | 環境変数 `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` で 1 つ固定 (P1 段階) |
| メッセージ形式 | Card v2 形式 (タイトル / 期間 / 本文プレビュー 3000 文字 / 個別画面 URL) |
| API | `POST /api/advisor/report/[versionId]/notify-gchat` |
| 認証 | System Admin |
| 重複防止 | なし (admin の判断で複数回送信可) |

**Google Chat Card v2 サンプル**:
```json
{
  "cardsV2": [
    {
      "cardId": "advisor-report-{versionId}",
      "card": {
        "header": {
          "title": "{レポートタイトル}",
          "subtitle": "{rangeStart} 〜 {rangeEnd}  ·  v{versionNumber}",
          "imageUrl": "https://tastas.work/icon.png"
        },
        "sections": [
          {
            "widgets": [
              { "textParagraph": { "text": "{本文プレビュー 3000文字}" } },
              {
                "buttonList": {
                  "buttons": [
                    {
                      "text": "全文を見る",
                      "onClick": { "openLink": { "url": "https://tastas.work/system-admin/advisor/reports/{versionId}" } }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**環境変数 (追加)**:
| 変数名 | 用途 |
|---|---|
| `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` | レポート配信先の Google Chat Space webhook |

**ユーザー作業**:
1. Google Chat の対象 Space を開く
2. Space 設定 → アプリと統合 → Webhook を追加 → 名前 "TASTAS Advisor" / アイコンは任意
3. 生成された URL を `.env.local` に `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/...` で追加
4. Vercel ダッシュボードでも Preview / Production 両方に追加 (CLAUDE.md ルールにより Claude Code は操作不可)

**実装ファイル**:
- 新規: `app/api/advisor/report/[versionId]/notify-gchat/route.ts`
- 新規: `src/lib/advisor/reports/notify-google-chat.ts`
- 編集: `src/components/advisor/reports/report-detail.tsx` (送信ボタン)
- 編集: `src/components/advisor/report/report-canvas.tsx` (送信ボタン)

**監査ログ**:
- `AdvisorAuditLog` に `eventType: 'report_notify'` で `{ versionId, target: 'google_chat', ok: boolean }` を記録

**エラーハンドリング**:
- Webhook URL 未設定: 400 + 「ADVISOR_GOOGLE_CHAT_WEBHOOK_URL が未設定です」
- Webhook 呼び出し失敗 (network / 4xx / 5xx): 502 + 詳細をログ
- 成功時: ボタンを 2 秒間「送信済み ✓」表示

---

## P1-6. レポート: query_metric 対応 (R4) ☐

### 現状
- [src/lib/advisor/reports/collect.ts:70-74](../../src/lib/advisor/reports/collect.ts#L70-L74) で `query_metric` は `null` 返却 (skipped)
- 理由: どの指標を取るか確定できないため

### 変更内容
ドラフトに **取得する指標キー一覧** を保存できるようにする。

### 仕様

**スキーマ変更**:
`AdvisorReportDraft` に `metric_keys: Json?` フィールド追加 (例: `["LP_PV", "LP_TO_LINE_CONV"]`)

**LLM への指示変更**:
- `update_report_draft` ツールに `metric_keys` 引数追加 (string[])
- システムプロンプトの「レポート作成モード」章に "metric_keys を選んでください" 指示追加
- LLM が `list_available_metrics` を先に呼んで利用可能 metric を確認 → ユーザー要件に合うものを選んで `update_report_draft({ metric_keys: [...] })`

**collect.ts 改修**:
```typescript
case 'query_metric': {
  if (!range.start || !range.end) return null
  // metric_keys がドラフトに無ければ取得不可
  // (collect.ts に metric_keys を渡す引数を追加する)
  const keys = options.metricKeys ?? []
  if (keys.length === 0) return null
  // 各 metric_key を並列で query_metric 呼び出し
  return { __batch: keys.map(k => ({ metric_key: k, start_date: range.start, end_date: range.end })) }
}
```

注: `__batch` は擬似仕様。実際は collect.ts 内で metric_keys に対して `executeToolByName('query_metric', ...)` を **複数回ループ実行**して個別 CollectedItem としてまとめる方が綺麗 (1 metric = 1 item)。

**Canvas UI**:
- ドラフトに「取得する指標」セクション追加 (metric_keys のチップ表示)
- 編集 (P1 段階では LLM が更新するのみ、手動編集は後回し可)

**DB 変更**: あり (`AdvisorReportDraft.metric_keys` 追加)

**実装ファイル**:
- 編集: `prisma/schema.prisma`
- 編集: `src/lib/advisor/tools/reports/update-report-draft.ts` (input schema 拡張)
- 編集: `src/lib/advisor/persistence/report-drafts.ts` (metric_keys 永続化)
- 編集: `src/lib/advisor/reports/collect.ts` (metric_keys 対応)
- 編集: `src/lib/advisor/system-prompt.ts` (LLM 指示)
- 編集: `src/components/advisor/report/report-canvas.tsx` (UI 表示)

---

## P1-7. レポート: 生成中の中断ボタン (R5) ☐

### 現状
- `/api/advisor/report/generate` は `maxDuration: 120` で動く
- 一度開始すると Gemini 応答が返るまでクライアント側で止められない
- AbortController 未対応

### 変更内容
Canvas の「生成中...」表示に「キャンセル」ボタン追加。

### 仕様

**実装方針**:

1. クライアント: `fetch` を `AbortController` 付きで起動、キャンセル時は `controller.abort()`
2. サーバー: `request.signal` を受け取って Gemini SDK に渡す (`@google/genai` の AbortSignal 対応を確認)
3. Gemini SDK が AbortSignal 非対応の場合: HTTP リクエスト層で打ち切る (Node.js fetch level)
4. キャンセル成功時: `AdvisorReportDraft.status` を `drafting` に戻す + `error_message: 'cancelled by user'`

**SDK 対応 (実装方針)**:
1. まず `@google/genai` SDK の `generateContent` の第 2 引数に `{ signal }` を渡せるか試す
2. SDK が AbortSignal 未対応の場合は **fetch ラップで対応**:
   - SDK の内部実装は標準 `fetch` を使っているので、グローバル `fetch` を `(...args) => originalFetch(args[0], { ...args[1], signal })` でラップ
   - または SDK を経由せず Vertex AI / Generative Language API に直接 fetch する薄ラッパーに切替
3. どちらの場合も中断時は `AbortError` を catch して `markError(reportId, 'cancelled by user')` を呼ぶ

**UI 仕様**:
- Canvas の「生成中...」スピナー横に小さい × ボタン
- クリック → `controller.abort()` → 確認ダイアログ「生成を中止しますか?」 → サーバーが abort 検知して状態を戻す
- 中断後はドラフトに戻り、再度「レポート作成」ボタンで再試行可

**監査ログ**:
- `AdvisorAuditLog` に `eventType: 'report_cancelled'` で記録

**実装ファイル**:
- 編集: `app/api/advisor/report/generate/route.ts` (AbortSignal を generate.ts に渡す)
- 編集: `src/lib/advisor/reports/generate.ts` (AbortSignal を Gemini に渡す)
- 編集: `src/lib/advisor/llm/gemini.ts` (AbortSignal 対応)
- 編集: `src/components/advisor/report/report-canvas.tsx` (キャンセルボタン + AbortController)

---

## P1-8. チャット入力欄の「レポート作成」ボタン ☐

### 現状
- レポート機能は **完全に自然言語駆動** (「先週のKPIまとめて」のような依頼に LLM が反応)
- レポート機能の存在を知らない admin には発見されにくい

### 変更内容
チャット入力欄の上 (送信ボタンの直近) に **「📊 レポート作成」ボタン** を追加。
クリックすると初期メッセージを自動投入してレポート作成フローを起動する。

### 仕様

**ボタン配置**:
- [chat-input.tsx](../../src/components/advisor/chat/chat-input.tsx) の入力欄上部 (メッセージ送信ボタンの並び、もしくは入力欄の少し上)
- アイコン: `lucide-react` の `FileText` または `BarChart3`
- ラベル: 「レポート作成」(短い)
- 配色: slate-700 / hover で slate-900 (System Admin デザインに合わせる)

**クリック時の挙動**:
1. 入力欄に **テンプレート文** を投入 (= 自動送信ではなく、admin が編集してから送信できる状態にする)
2. テンプレート例:
   ```
   レポートを作成したいです。
   - 対象期間: (例: 先週、2026-04-24〜2026-04-30)
   - レポートの目的: (例: 週次 KPI レビュー / 不具合の振り返り)
   - 含めたいデータ: (例: GA4 流入、求人推移、エラーログ)
   ```
3. ユーザーが必要に応じて埋めて送信 → LLM が `update_report_draft` を呼び始める

**自動送信は NG**:
- 空のメッセージで送ると LLM が "何を作るか" 聞き返すだけで価値が薄い
- テンプレで埋めてもらった方が初手から具体的なドラフトが作られる

**実装ファイル**:
- 編集: `src/components/advisor/chat/chat-input.tsx` (ボタン追加)
- もしくは `chat-layout.tsx` 側でボタンを管理しても良い (chat-input がシンプルになる)

**監査ログ**: 不要 (テンプレ投入は通常のユーザー入力と同じ扱い)

---

## P1-9. レポート結果の編集機能 (Gemini Canvas 風) ☐

### 現状
- 結果ビュー (`view === 'result'`) は ReactMarkdown で **表示専用**
- 修正したい時はドラフトに戻って "再生成" するしかない (= 全文再生成)
- 部分的な手直し (タイトルだけ直したい、特定章を書き直したい等) ができない

### 方針 (確定)
**Gemini Canvas のような "双方向編集" 体験** を提供する:
- 手動編集モード (右ペイン Canvas で Markdown を直接書き換え)
- LLM 部分修正モード (左ペインのチャットで「3 章を簡潔に」と依頼 → 該当箇所のみ書き換え)
- 編集履歴は P1-3 のバージョンに乗せる (= 編集後の保存で v(N+1) として記録)

### 仕様

#### 9-A. 手動編集モード (Canvas 内編集)

**UI**:
- 結果ビューの右上に「編集」ボタン (アイコン `Pencil`)
- クリック → Markdown が **textarea に変わる** (もしくは Markdown エディタ風: 左半分 textarea + 右半分プレビュー)
- 「保存」ボタンで現在のバージョンを上書き or 新バージョンとして保存
- 「キャンセル」ボタンで編集破棄

**保存方針 (重要・ユーザー確認希望)**:
2 通りの選択肢:

| 案 | 動作 |
|---|---|
| α-1: 同じバージョンを上書き | v3 を編集 → v3 のまま `result_markdown` 更新。`updated_at` だけ進める |
| α-2: 新バージョンとして保存 | v3 を編集して保存 → v4 として新規追加。「v3 を手動編集したもの」と分かるよう `draft_snapshot.note: 'manual_edit_from_v3'` を付与 |

**推奨**: **α-2 (新バージョン)**。理由は履歴保持 (P1-3 と整合) と "編集前に戻れる" 価値。

**編集中のロック**:
- 編集中に他 admin が同じレポートを開いても警告は出さない (P1 段階)
- 同時編集による上書きリスクは低い (admin 数は数名)

**Markdown エディタの選定**:
- ライブラリ: 標準の textarea で十分 (リッチエディタは不要)
- プレビュー: Canvas 結果ビューと同じ ReactMarkdown を流用
- 編集中はデフォルトでプレビュー無し → 「プレビュー」トグルで表示する 2 ペイン UI も検討余地あり

#### 9-B. LLM 部分修正モード (チャットで依頼)

**UI**:
- 結果ビューを表示中に、左ペインのチャットで「3 章のグラフ説明を簡潔にして」のようにメッセージ送信
- LLM はチャット応答時に `edit_report_draft` のような **新ツール** を呼んで部分修正版を返す
- Canvas が自動で v(N+1) として更新

**新ツール `edit_report_section`**:
```typescript
{
  name: 'edit_report_section',
  description: 'すでに生成されたレポートの一部を修正します。' +
    '結果ビューを表示中に「ここを直して」と依頼された時に使ってください。' +
    'instruction には「何をどう直すか」を、target_section には対象見出し名を入れます。' +
    'editor_mode が true なら admin が手動編集を始めようとしている兆候なので、このツールは呼ばずチャットで案内するに留めます。',
  inputSchema: {
    type: 'object',
    properties: {
      session_id:    { type: 'string', description: '対象セッション ID' },
      target_section: { type: 'string', description: '対象の見出しテキスト (省略時は全体)' },
      instruction:   { type: 'string', description: '修正指示 (例: "簡潔にして", "数値を 4/24-4/30 で更新")' },
    },
    required: ['session_id', 'instruction'],
  },
}
```

**サーバーサイドの動作**:
1. 現在の最新バージョンの `result_markdown` を読む
2. Gemini に「現在のレポート全文 + 修正指示 + 該当箇所」を投げて **diff ベースの修正版** を得る
   - プロンプト戦略: 「全文を返さず、`<<<REPLACE_FROM>>>` 〜 `<<<REPLACE_TO>>>` 〜 `<<<WITH>>>` 〜 `<<<END>>>` のような区切りで部分置換指示を返してください」
   - 簡易実装版: 全文をそのまま返してもらい、サーバーで diff を取らずに置き換え (品質優先・コストはやや上)
3. 修正版を v(N+1) として保存
4. `update_report_draft` のように Canvas が自動でポーリングして反映

**簡易版で OK ならまずは「全文再生成」で実装**:
- 修正指示を含む system prompt + 元レポート全文 → 修正版全文を 1 ショットで返してもらう
- diff 抽出ロジックは P2 に回しても十分実用的
- これなら新ツール 1 つ追加するだけで動く (`edit_report_section`)

#### 9-A と 9-B の連携

- 9-A 編集中に 9-B のツールが発火しないよう、編集モード中は server action 側で排他制御 (`status: 'editing'` を追加)
- もしくは admin に「LLM が修正中です。手動編集はキャンセルされました」のような警告
- P1 段階では **片方しか動かない前提でシンプルに**:
  - admin が「編集」ボタンを押した瞬間 → サーバーに `lockEditing(versionId, adminId)` リクエスト
  - 解除されるまで LLM の `edit_report_section` ツールは "別の admin が編集中です" を返す
  - タブを閉じても 5 分でロック自動解除

#### スキーマ変更

`AdvisorReportVersion` に以下フィールド追加 (P1-3 で追加するモデル):
- `editing_lock_admin_id: Int?` — 現在編集中の admin
- `editing_lock_at: DateTime?` — ロック取得時刻 (5 分でタイムアウト)
- `source: 'generated' | 'manual_edit' | 'llm_edit'` — どう作られたバージョンか
- `parent_version_id: String?` — 元バージョン参照 (手動編集 v4 が v3 から派生したことを示す)

#### 実装ファイル

- 編集: `prisma/schema.prisma` (P1-3 の `AdvisorReportVersion` に上記 4 フィールド追加)
- 新規: `src/lib/advisor/tools/reports/edit-report-section.ts` (LLM 用ツール)
- 編集: `src/lib/advisor/tools/reports/index.ts` (登録)
- 編集: `src/lib/advisor/tool-source-labels.ts` (ラベル追加)
- 編集: `src/lib/advisor/orchestrator.ts` (`TOOL_STATUS_LABEL` に追加)
- 編集: `src/lib/advisor/system-prompt.ts` (「結果ビュー表示中の修正依頼」章を追加)
- 編集: `src/lib/advisor/persistence/report-drafts.ts` (`createVersion(parentId, source, markdown)` 追加)
- 新規: `src/lib/advisor/actions/report-versions.ts` (Server Action: `lockEditing` / `saveManualEdit` / `unlockEditing`)
- 編集: `src/components/advisor/report/report-canvas.tsx` (編集モード UI 追加、ロック制御)

#### 動作確認シナリオ

1. レポート v1 が生成された状態で、Canvas 右上の「編集」ボタン → textarea になる
2. Markdown を直接書き換え → 「保存」 → v2 として保存される
3. ドロップダウンで v1/v2 を切り替えできる (P1-3 の機能)
4. 結果ビュー表示中にチャットで「2 章のグラフ説明を簡潔にして」 → LLM が `edit_report_section` を呼ぶ → v3 として保存
5. 編集中 (textarea を開いている時) に LLM が修正依頼を受けた → 「別の admin が編集中です」エラー

---

## 実装順序 (確定: 2 → 1 → 7 → 8 → 5 → 6 → 9 → 3)

軽い順 + 依存関係考慮:

| 順 | 項目 | 規模 | DB | 備考 |
|---|------|------|----|------|
| 1 | **P1-2** 長時間ツール status | 小 | なし | orchestrator.ts のみ、最初の足慣らし |
| 2 | **P1-1** Search Console API | 中 | なし | 新規ツール 1 個、Vercel 環境変数追加要 |
| 3 | **P1-7** 生成中断ボタン | 小 | なし | UI + API、AbortController |
| 4 | **P1-8** チャット欄レポート作成ボタン | 小 | なし | テンプレ投入のみ |
| 5 | **P1-5** Google Chat 配信 | 小 | なし | Webhook URL 1 つ |
| 6 | **P1-6** query_metric 対応 | 中 | カラム追加 | metric_keys 永続化 |
| 7 | **P1-9** レポート編集機能 | **大** | フィールド追加 (P1-3 と同時) | 手動編集 + LLM 部分修正 |
| 8 | **P1-3** 履歴一覧画面 | **大** | 新テーブル | バージョン管理 + 一覧画面 + 個別画面 |

注: **P1-9 と P1-3 は同じテーブル (`AdvisorReportVersion`) を使うので、実装は併走推奨**。
DB スキーマは P1-9 着手時に "P1-3 の AdvisorReportVersion + P1-9 の追加 4 フィールド" を一度に追加してしまう。

→ 軽い順で進めれば部分リリース可能 (1-4 まで完了した時点でも価値あり)。

## DB 変更まとめ (DEPLOY_CHECKLIST.md 更新対象)

P1 完了時点で増えるもの:

**新規テーブル**:
- `advisor_report_versions` (P1-3 + P1-9)
  - 基本フィールド (P1-3): id / draft_id / version_number / result_markdown / result_model / draft_snapshot / generated_ms / input_tokens / output_tokens / created_at
  - 追加フィールド (P1-9): editing_lock_admin_id / editing_lock_at / source / parent_version_id

**カラム追加**:
- `advisor_report_drafts.metric_keys: Json?` (P1-6)

DEPLOY_CHECKLIST.md の "9 → 10 テーブル" + "1 列追加" として記載 (現在 9 個 → P1 後 10 個)。

## 環境変数まとめ

新規追加:
- `SEARCH_CONSOLE_SITE_URL` (P1-1)
- `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` (P1-5)

既存流用:
- `GA_CREDENTIALS_JSON` または `GOOGLE_APPLICATION_CREDENTIALS` (P1-1)

DEPLOY_CHECKLIST.md の Vercel 環境変数表に追加 (Preview/Production 両方)。

## ユーザー作業まとめ

| # | 作業 | 対象環境 |
|---|------|---------|
| 1 | Service Account を Search Console property に追加 (権限付与) | 該当 GSC プロパティ |
| 2 | `SEARCH_CONSOLE_SITE_URL` を `.env.local` に追加 | ローカル |
| 3 | `SEARCH_CONSOLE_SITE_URL` を Vercel に追加 (Preview / Production) | Vercel |
| 4 | Google Chat Space で Webhook 作成 | 任意の Space |
| 5 | `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` を `.env.local` に追加 | ローカル |
| 6 | `ADVISOR_GOOGLE_CHAT_WEBHOOK_URL` を Vercel に追加 | Vercel |
| 7 | `npx prisma db push` をローカル Docker DB に実行 (P1-3, P1-6, P1-9 の DB 変更後) | ローカル |
| 8 | ステージング DB / 本番 DB へ反映 (DEPLOY_CHECKLIST.md 通り) | Supabase |

## 確認済み (ユーザー回答済み)

- ✅ P1-3 履歴: 全部残す + 個別削除可能
- ✅ P1-4: 削除 (PDF も HTML も不要)
- ✅ P1-5: Google Chat に変更 (Slack/メールは廃止)
- ✅ P1-7: SDK signal → 駄目なら fetch ラップ
- ✅ P1-8: チャット欄に「レポート作成」ボタン追加 (テンプレ投入)
- ✅ P1-9: 手動編集 + LLM 部分修正 (Gemini Canvas 風)
- ✅ 実装順序: 2-1-7-8-5-6-9-3

## 残る未確認ポイント (P1-9 着手時に再確認)

- P1-9 編集の保存方針: 同じバージョン上書き (α-1) vs 新バージョン追加 (α-2)
  - 推奨: α-2 (新バージョン)
  - 着手時に再度確認

- P1-9 LLM 部分修正の実装粒度:
  - 簡易版: 全文再生成 (Gemini に修正版全文を返してもらう)
  - 高度版: diff ベース置換 (一部だけ書き換え)
  - 推奨: まず簡易版、コスト/品質次第で高度版へ
  - 着手時に再度確認
