# System Advisor — 設計知見 (累積ナレッジ)

**目的**: HANDOFF.md のセッションログから抽出した「**今後も再利用したい設計判断・教訓**」を 1 箇所に集約。
セッションログは時系列の「いつ・何をした」、本ファイルは「**なぜそれが正解だったか / 何を再利用すべきか**」。

**最終更新**: 2026-05-03

---

## 1. アーキテクチャ判断

### 1.1 LLM の役割分担: Anthropic vs Gemini

| 用途 | モデル | 理由 |
|---|---|---|
| 一般チャット (質疑応答 / 調査) | Claude Sonnet 4.6 | tool use の精度が高い、対話品質が高い |
| ドラフト初回作成 (`[TOOL:report_create]`) | **Gemini 2.5 Flash 直叩き** | 構造化 JSON 出力が安定、Anthropic loop=1 TTFB 100s 問題回避 |
| ドラフト修正 (`[TOOL:draft_revise]`) | **Gemini 2.5 Flash 直叩き** | 同上 |
| レポート本文生成 (`/api/advisor/report/generate`) | **Gemini 2.5 Flash** | 長文 + 構造化 + 数値表埋めに強い |
| レポート編集 (`[TOOL:result_edit]`) | **Gemini 2.5 Flash 直叩き** | 部分書き換えに強い、stateless で速い |

**真因の教訓** (2026-05-03 ジッター分析より): Anthropic API は同じノードを再利用 (アフィニティ) するため、混雑したノードに当たると loop=1 の TTFB が 100 秒級になる事象がある。Gemini API では再現せず → **重い処理は Gemini にバイパス**する設計に転換。

### 1.2 Anthropic フォールバックの撤去

**初期設計**: Gemini バイパス失敗 → Anthropic に fall through (堅牢性優先)
**問題**: Anthropic loop=1 で結局 100 秒級になり、ユーザーが 2 分待たされて結局答えが返らない最悪 UX
**現在**: Gemini 失敗 → 即時 `error` イベントで「失敗、再試行を」(5〜10 秒で返る方が遥かにマシ)

**例外**: 前提条件 NG (no draft / admin mismatch) のみ Anthropic に流す (これらは Gemini を呼ぶ意味が無いケース)

### 1.3 Canvas (右ペイン) と チャット (左ペイン) の連動

| 機能 | 実装 |
|---|---|
| Canvas 内タブ ('draft' or 'result') | Canvas 内部 state |
| forcedTool の動的切替 | Canvas → chat-layout に `onViewChange` callback で通知 |
| ドラフト編集中はポーリング停止 | `draftEdit !== null` 時 reload skip |
| チャット送信で未保存編集を破棄 | `discardEditTrigger` カウンターを incr |
| レポート生成イベントをチャットに表示 | Canvas → chat-layout に `onReportGenerated` callback で reload |

**設計原則**: Canvas は内部 state でローカル UX を担当、chat-layout は API state を担当。両者は callback で疎結合に通信。

### 1.4 自動「ドラフト修正 → 再生成」フロー (Phase D / auto-redraft)

result_edit (生成済みレポート編集) で「○○の表を追加」など新データ取得が必要な指示を受けたとき:

1. Gemini が `redirect_to_draft=true` + `draft_instruction` を返す
2. orchestrator が裏で連続実行:
   - editDraftWithGemini → upsertDraft → generateReport
3. 新バージョン (vN+1) として保存
4. ユーザーは Canvas で待つだけ (40 秒前後)

**設計原則**: ユーザーの意図を Gemini が解釈してフロー切り替えする (ユーザーがどのタブでやるべきか考えなくていい)。

---

## 2. プロンプト設計の教訓

### 2.1 「例」として書いた架空指標を Gemini が信じる

**事故例**: 「(例: ["LP_PV", "LP_TO_LINE_CONV"])」と複数箇所に書かれていた → Gemini が `LP_TO_LINE_CONV` を実在指標と誤認 → query_metric が「不明な metric_key」で弾く → 表が空に

**対策**:
- プロンプト・schema コメント・型定義の **「例」** には実在するキーだけ使う
- 命名がもっともらしいダミーは絶対に書かない (`LP_TO_LINE_CONV` のような未実装が紛れる温床)

### 2.2 「迷ったら更新する側に倒す」プロンプト原則

**事故例**: revise で skeleton に流入経路の表を追加したのに dataSources に query_ga4 が追加されず、レポート生成で空表に

**真因**: Gemini は「変更ないかも」と迷うと null (= 変更なし) を返しがち

**対策**: プロンプトで「**迷ったら更新する側に倒す**」「null を返してよいのは文言修正のみのとき」を明示

### 2.3 構造的禁止 + 具体例 (✅ / ❌) を併記

Gemini Flash は短時間で判断するため、抽象的な禁止 (例: 「自由に再構成してはいけない」) より、**「✅ こう書け / ❌ こう書くな」の具体例**を併記する方が遵守率が高い。

例: 表前置き散文の禁止
```
❌ 例 (これを書かない):
## ワーカーTOPページPV推移
今週のワーカーTOPページのPV数推移は以下の通りです。
| 日付 | PV |
...

✅ 正しい:
## ワーカーTOPページPV推移

| 日付 | PV |
...
```

### 2.4 JSON 出力の安定化

Gemini Flash は `responseMimeType: 'application/json'` で構造化出力を強制できるが、稀に:
- ` ```json ... ``` ` でラップ
- 文字列内で生改行 (\n エスケープし忘れ)
- 末尾カンマ

5 段フォールバックパーサーで救う:
1. そのまま JSON.parse
2. fence 抜き出し
3. 最初の `{` から最後の `}` までスライス
4. 文字列内生改行を `\n` にエスケープ (`repairJsonString`)
5. 末尾カンマ除去

プロンプト側でも「**文字列値の中の改行は必ず `\n` にエスケープ**」「**`"` は `\"` にエスケープ**」「**末尾カンマ禁止**」と明示。

### 2.5 ヘッダー型・章構成の固定強制は禁止

レポートは「主要 KPI 集計」「輪切り分析」「ad hoc 調査」「障害振り返り」など多様な用途で使う。
**「サマリ → 主要数値 → 次のアクション」の固定型を強制すると柔軟性を損なう**。
ユーザーが Canvas で作った skeleton をそのまま忠実に踏襲する原則。

### 2.6 ユーザーが指定したデータソースは絶対尊重

**事故例**: ユーザー「**GTA から**取れる LP の PV ランキング」 → Gemini「LP_PV なら DB の query_metric で取れる」と判断 → query_metric を選択 (GA4 を使わず)

**対策**: プロンプトに「ユーザーが GA4 / GTA / アナリティクス / DB / Search Console / GitHub / Vercel / Supabase などを明示指定したら、その指定を絶対に尊重する」「自動判断より明示指定を優先」を明記。

---

## 3. データ収集 (collect.ts) の教訓

### 3.1 ツールの能力を「フル展開」する設計

**事故例**: query_ga4 を `report_type: 'overview'` 1 種だけで呼んでいた → 流入経路 / ページ別 PV のデータが渡されず、Gemini が「データがない」と書く

**対策**: ツール側に enum (reportType / dimensions / source / level / env など) がある場合、**レポート用 collect ではデフォルトで全展開する**。
- `Promise.all` で並列実行なので所要時間は最遅リクエストで律速 = 体感速度変わらず
- 1 レポートあたりのリクエスト数は増えるが、API クォータの範囲内

**現在の展開状況** (2026-05-03 時点):
- query_metric: metric × supportedGroupBy 全展開
- query_ga4: 5 種 (overview / traffic / pages / lpPerformance / comparison)
- query_search_console: 4 種 ([query] / [page] / [device] / [country])
- get_supabase_logs: 3 種 (postgres / api / auth)
- get_vercel_logs: 3 種 (error / warning / info)
- get_vercel_deployments: 2 種 (production / preview)

### 3.2 過去バージョンの手作業修正を継承

**事故例**: ユーザーが result v3 で「日付フォーマットを MM/DD に」修正 → auto-redraft で再生成すると元に戻る

**真因**: generate.ts が skeleton + collected_data から完全新規生成していた (前バージョンを見ていない)

**対策**: `previousResultMarkdown` を Gemini に渡し、システムプロンプトに「**最重要ルール 1: 前回バージョンの編集スタイルを絶対維持**」追加。

---

## 4. UI/UX 設計の教訓

### 4.1 「ドラフト」「レポート」のステータス可視化

| 状態 | バッジ | 意味 |
|---|---|---|
| 未生成 | 赤「ドラフト」 | まだ Gemini が本文生成していない |
| 生成済み | 青「レポート調整」 | 生成済み、再生成・編集が可能 |

ユーザーが「今は何の段階か」を一目で判断できる。

### 4.2 ChatInput の forcedTool が view 連動

| Canvas タブ | ChatInput 表示 | 動作 |
|---|---|---|
| ドラフト | 「ドラフト修正指示」 | `[TOOL:draft_revise]` (skeleton 編集) |
| レポート | 「レポート修正指示」 | `[TOOL:result_edit]` (生成済み本文編集) |

ユーザーが「今レポートを直したい」と思って指示すれば、自動的に正しい経路に流れる。

### 4.3 進捗表示の動的化

CanvasStatusBar は `liveStatusText` 優先で表示:
- orchestrator が SSE で送る「ドラフトを更新中...」「レポートを再生成中... (収集 + Gemini)」がそのまま見える
- 旧: 「レポート生成中」固定 → 30 秒間同じ文言で固まったように見える

### 4.4 イベントラベルでフロー可視化

assistant メッセージの先頭に絵文字ラベル:
- 📋 ドラフトを作成しました
- 📝 ドラフトを更新しました
- 📊 レポート vN を生成しました
- ✏️ レポート vN を編集しました
- 🔄 自動再生成しました

**副次効果**: 次回 Gemini が読む履歴にもラベルが入って文脈になる (履歴を渡す経路を導入したため)。

### 4.5 stale 検知 → 自動 view 切替

レポート再生成で新バージョンができたら、Canvas の view='draft' 状態でも自動で view='result' に切替。
逆に「ドラフトが result 生成後に更新されたら」→ ドラフトタブに 🟠 ドット表示 + result 上部に黄色バッジ。

---

## 5. データソース UI ラベル統一表

UI / プロンプト / 出典注釈すべてで同じ日本語ラベルを使う:

| key | 統一ラベル |
|---|---|
| query_metric | 本番 DB 指標集計 |
| query_ga4 | GA4 アクセス解析 |
| query_search_console | Search Console |
| get_jobs_summary | 求人サマリ |
| get_users_summary | ユーザーサマリ |
| get_recent_errors | エラーログ (DB) |
| get_supabase_logs | Supabase ログ |
| get_vercel_logs | Vercel ログ |
| get_vercel_deployments | Vercel デプロイ履歴 |
| get_recent_commits | GitHub コミット履歴 |

英語キー (`query_metric` 等) は Gemini プロンプトでツール選択時のみ使い、ユーザーに見せる出典等は日本語ラベル統一。

---

## 6. パフォーマンス改善履歴

| Phase | 対応 | TTFB 改善 |
|---|---|---|
| 初期 | Anthropic loop=1 で update_report_draft → 複数 round trip | 100 秒級 |
| Phase A | `[TOOL:draft_revise]` を Gemini 直叩きにバイパス | 4〜10 秒 |
| Phase B | `[TOOL:report_create]` も Gemini 直叩きに拡張 | 9 秒前後 |
| Phase C | `[TOOL:result_edit]` 経路新設 | 5〜10 秒 |
| Phase D | auto-redraft (result_edit → draft_revise → 再生成) 自動化 | 40 秒前後 (3 段階の合計) |

レポート生成本体 (`/api/advisor/report/generate`) は 15〜25 秒で安定。

---

## 6-bis. データ保持期間ポリシー (2026-05-04 確定)

### 設計原則

「**ユーザーが能動的に保存判断したものだけ永続、それ以外は短期で消える**」

| データ種別 | 保持期間 | 保存条件 | 自動削除トリガー |
|---|---|---|---|
| `AdvisorChatSession` | 永続 | (削除しない、知識ベースとして価値) | 手動アーカイブのみ |
| `AdvisorChatMessage` | セッションに従属 | 同上 | セッション削除時 cascade |
| `AdvisorReportDraft` | 30 日 | しおり付きセッションは永続 | cron が `updated_at < now - 30d` で削除 |
| `AdvisorReportVersion` | 30 日 | 同上 (親 Draft が消えれば一緒に消える設計) | 同上 |
| `AdvisorAuditLog` (一般) | 90 日 | — | cron が `created_at < now - 90d` で削除 |
| `AdvisorAuditLog` (report_*) | 180 日 | — | cron が `created_at < now - 180d` で削除 |
| 共有 URL (`shared_until`) | 30 日 | 「+30 日延長」ボタンで何度でも延長可 | cron が失効 token を null 化 |

### しおり (Bookmark) の粒度

- **AdvisorChatSession 単位**: 「このチャット全体を永続保存」=「配下の Draft / Versions 全部を保持」
- 理由: ユーザーが「このチャットは大事」と判断する単位がセッション
- Version 単位ではしおり粒度が細かすぎて UX 上の負担が大きい

### UI 表示原則

- **チャット側 (サイドバー / 履歴)**: しおり ON のとき常時 amber アイコン表示、OFF のとき hover 時のみ
- **Canvas**: ヘッダー右にトグル、直下に保持期間バナー (`RetentionBanner`)
  - bookmarked: 緑「しおりマーク (永続保存)」
  - 残り 7 日以上: グレー「保存期間: あと N 日」
  - 残り 7 日未満: amber「⚠️ あと N 日で自動削除されます」
- **公開シェア URL ページ**: ヘッダーに「公開期限: あと N 日」バッジ (色は残日数で段階的)

### 共有 URL の失効ポリシー

- **デフォルト 30 日**: 月次レポートサイクルと整合、ブラウザ履歴からの再アクセスもこの期間内
- **延長**: token を維持したまま `shared_until = now + 30d` に書き換え (UX 良し)
- **停止**: `shared_at` / `shared_until` / `share_token` 全部 null 化 (= URL 即失効)
- **再有効化時の token**: **新規発行** (失効後はプライバシー観点で旧 token を無効化、漏れた URL のリスク窓を狭める)

### Audit ログ「report_* 系を 180 日保持」の理由

- 一般イベント (chat_request / tool_call) は debug 用途で 90 日で十分
- レポート生成イベント (`kind: 'report_*'`) は **コスト分析・品質遡及**に使うので長期保持
- 半年スパンで「料金推移」「Gemini の出力傾向の変化」を追えるようにする

### Cron の実装上の注意

- **2 段階フィルタ**: `bookmarked = false` セッション → そこに紐づく Draft → そこに紐づく Versions の順で削除
- **新規データを誤削除しない**: Draft 自体の `updated_at < cutoff` も同時にチェック
- **削除処理は `deleteMany` で一括**: 行数を返すのでログに残せる
- **payload.kind の判定**: Prisma の Json `path: ['kind']` + `string_starts_with: 'report_'` で振り分け

### 将来 SaaS 化 (hub-platform 統合) 時の留意

- テナント分離: `organization_id` を key に保持期間ポリシーをテナント別に設定可能にする (Free 7 日 / Pro 30 日 / Enterprise 90 日 等)
- しおり数の上限を Free プランでは制限する (例: 5 個まで)
- Audit ログは Compliance 要件のあるテナント向けに 1 年保持オプション追加

---

## 7. 残課題・既知の制約

### 7.1 LP 名が ID のまま表示される
`query_metric` の group_by=lp_id で `key` が LP の ID 数字のみ。表で「LP 5」と表示される。
本来「LP 5 (○○キャンペーン LP)」のような名前を出したいが、LandingPage テーブルから JOIN が必要。
**優先度: 低** (ユーザー要望が出てから対応)。

### 7.2 ステージング・本番未展開
ローカル (Docker PostgreSQL + .env.local) でしか動作確認していない。
ステージング・本番展開には:
- Vercel 環境変数追加 (GEMINI_API_KEY 必須)
- Supabase に AdvisorReportDraft / AdvisorReportVersion / AdvisorAuditLog 等のスキーマ反映
- DEPLOY_CHECKLIST.md 参照

### 7.3 グラフ生成は未対応
Markdown 出力のみ。`<img>` / Mermaid / 画像 URL は出さない設計。
代わりに表 (GFM table) で代替表示する旨を Gemini プロンプトで明示済み。

### 7.4 添付ファイル / Excel / PDF エクスポート未対応
Markdown コピーで取り出す運用。

---

## 8. 関連ドキュメント

- [HANDOFF.md](./HANDOFF.md) — セッションログ (時系列の作業記録)
- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — ステージング/本番デプロイ手順
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — Canvas + レポート機能の全体設計
- [system-prompt.md](./system-prompt.md) — Anthropic Claude のシステムプロンプト
- [tools-spec.md](./tools-spec.md) — 各ツールの仕様
- [data-model.md](./data-model.md) — DB スキーマ
- [HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md) — **(2026-05-03 確定方針)** TASTAS 安定後に hub-platform へ統合する計画 + 即実行可能な手順
- [NEXT_SESSION.md](./NEXT_SESSION.md) — 次セッションへの引き継ぎメッセージ
- [SAAS_PRODUCTIZATION.md](./SAAS_PRODUCTIZATION.md) — 当初の SaaS 化議論 (履歴、最新方針は HUB_PLATFORM_MIGRATION_TODO.md)
