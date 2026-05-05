# TASTAS 側からの引き継ぎサマリ

**作成**: 2026-05-04
**ユーザー**: 川島一郎 (ichiro0712@gmail.com)
**TASTAS リポジトリ**: `/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ`

---

## 1. このパッケージを作った理由

### 1.1 ユーザーからの依頼 (原文)

> いや、まだ hub プラットフォームにどう統合するか決めていないよ。
>
> ・まず、今のシステムアドバイザーのプログラム、仕様一式を、hub-platform 側で
>   理解できりるようにローカルでコピーして、そのフォルダを hub-platform にいれ、
>   hub-platform 側の LLM と同融合するか相談したい。
>
> ・その際きをつけたいのが
>   - 細かい仕様や UI も完璧につかいたい (細かくチューニングしたので、どこでどの
>     表示が出て、どういう時にどういう挙動になって、ボタンはこう、文字はこう、
>     全く同じに使いたい)
>   - 過去失敗してこうなおしたなどのナレッジも共有したい

### 1.2 つまりやってほしいこと

| やること | やらないこと |
|---|---|
| TASTAS Advisor の機能 / UI / 設計判断を **完全に理解** する | この場で統合方針を決めて実装に着手する |
| hub-platform にどう統合するか **方針案を 2-3 個** 提示する | 既存 agent-hub をいきなり改造する |
| 過去のバグ → 修正経緯を踏襲して **同じ失敗を繰り返さない** | TASTAS 本体のコードを改変する |
| UI を **ピクセル単位 / 文言単位** で再現する想定で議論する | 大幅に UI を変えてユーザーに馴染ませ直す |

---

## 2. 議論経緯 (2026-05-03 〜 2026-05-04)

### 2.1 当初: SaaS として外販する案

[docs/SAAS_PRODUCTIZATION.md (TASTAS 側)] で議論されていたが、外販するには
マルチテナント / 課金 / サブドメイン管理など別物の作り込みが必要で重い。

### 2.2 確定方針 (2026-05-03): hub-platform に吸収

ユーザーから提起:
- TASTAS 以外の事業 (寿司屋 / hub-platform / バンド) でも System Advisor が欲しい
- 「**UI を 1 つ作れば全プロジェクトに反映**」させたい
- MCP 経由で複数 Advisor が連携する未来を想定

→ **hub-platform を「Advisor Platform」として育てる**方針で合意。
   外販ではなく、自社事業の統合基盤に。

### 2.3 採用予定の設計 (案)

```
hub-platform/
├── packages/
│   ├── llm-usage/          (既存)
│   └── advisor-core/       (🆕 ← これが今回の議論の本丸)
│       ├── chat/
│       ├── canvas/
│       ├── orchestrator/   (Gemini バイパス / auto-redraft 含む)
│       ├── tool-registry/  (プラガブル)
│       └── prompts/
│
├── apps/
│   ├── agent-hub/          (既存、統合司令塔)
│   ├── project-hub/        (既存)
│   ├── health-hub/         (既存)
│   ├── sushi-hub/          (🆕 内蔵 Advisor)
│   ├── band-hub/           (🆕 内蔵 Advisor)
│   └── tastas-hub/         (🆕 TASTAS 統合、または MCP 経由)
```

ただし **これも案**。hub-platform 側で見て「もっと良い設計がある」と思えば
INTEGRATION_QUESTIONS.md で代案を出してください。

### 2.4 今回 (2026-05-04) の依頼

「**まだ統合方針は決めていない**。まず TASTAS Advisor を hub-platform 側 LLM が
完全に理解できる状態にしてから、向こうの LLM と相談する」 → このパッケージ作成。

---

## 3. TASTAS Advisor の現状 (一言でいうと)

「**System Admin が日々の業務 KPI / GA4 / DB / Vercel ログ / GitHub を横断的に
質問できる LLM チャット + レポート作成 Canvas**」。

### 3.1 主要機能

- **チャット** (Anthropic Claude Sonnet 4.6 / Opus / Haiku 切替可、System Admin 認証必須)
- **ツール 19 個** (本番 DB / GA4 / Search Console / Supabase / Vercel / GitHub)
- **Canvas** (右ペインで「レポート要件 + 0 埋め skeleton」をチャットしながら固める)
- **レポート本文生成** (Gemini 2.5 Flash で 15-30 秒、構造化 Markdown)
- **バージョン管理** (生成 / 手動編集 / LLM 編集の履歴を保持)
- **公開シェア URL** (有効期限 30 日 + 延長 + 共有者表示)
- **しおり (永続保存)** + 自動削除 cron (毎日 04:00 JST)

### 3.2 アーキテクチャの特徴

- **Anthropic + Gemini の二本立て**
  - 一般チャット = Anthropic Claude Sonnet 4.6
  - レポート系 (重い処理) = **Gemini 2.5 Flash 直叩きでバイパス** (Anthropic の loop=1 TTFB 100 秒問題回避)
  - 詳細: [knowledge/DESIGN_DECISIONS.md](./knowledge/DESIGN_DECISIONS.md) §1.1
- **本番 DB 読み取り専用接続** (二重防御: Postgres ロール + アプリ側 READ ONLY tx)
- **dynamic system prompt にドラフト全体を毎回埋め込み** (`get_report_draft` ツール往復不要)
- **prompt cache 5 分 ephemeral** (cachedPart で METRIC_CATALOG + 知識を固定、dynamicPart で可変部分を分離)

### 3.3 開発体制

- **Phase 1** (TASTAS Advisor の完成度向上): **現在進行中**
- ローカル動作確認: ✅ 済み
- ステージング展開: ⏸ 未 (DEPLOY_CHECKLIST.md で進捗管理)
- 本番展開: ⏸ 未

---

## 4. ユーザー (川島) の好み・癖 (重要)

hub-platform 側 LLM が TASTAS 側 Claude Code と同じ流儀でユーザーと話せるように、
過去の指示や反応から得た "暗黙のルール" を明文化する。

### 4.1 コミュニケーション

- **日本語で会話** (ユーザーは日本語、Claude Code 側も日本語で返す)
- **コミットメッセージも日本語** (`機能追加: ...`, `バグ修正: ...`, `リファクタリング: ...`)
- **長文の説明より結論先行**を好む。1-2 文でまず答え、必要なら詳細を箇条書き
- **「やった方がいいもの全部やりたい」と言われた時は、リスク・コストを先に提示**して合意を得る
- **ユーザーは技術的に詳しい**。専門用語をぼかさずに使ってよい

### 4.2 仕事の進め方

- **デプロイ系作業は Claude Code は実行しない** (本番 DB / Vercel env / git push --force / gh pr merge 等)
- **PR 作成までが Claude Code の役割**。マージはユーザー手動
- **マージ先は必ず確認**。明示が無い場合 main へのマージは絶対にしない
- **大きい変更 / 高リスク変更は 2 段階確認** (「本当に実行しますか？」「最終確認です」)

### 4.3 設計判断

- **「迷ったら更新する側に倒す」「✅/❌ 具体例併記」「JST 基準」**等のプロンプトルールを徹底
- **本番分析の数字を変えるリスク**を非常に嫌う (例: query_metric の SQL 化を検討した時、JST 境界処理ミスで数字がズレるリスクを理由に却下)
- **誤指摘や見落としには厳しい** (Antigravity の監査が誤指摘 5/6 だった件で「もれなくやって」と再依頼された)
- **アーキテクチャの一貫性を重視** (一度決めた設計判断 — Anthropic フォールバック撤去等 — を勝手に戻さない)

### 4.4 UI の好み

- **角丸カード化 + 浮かぶレイアウト** (Gemini Canvas 風、`rounded-xl border shadow-sm`)
- **ヘッダー 1 行集約**を好む (タイトル + タブ + アクション + メニューを横一列)
- **状態専用ヘッダーで統一** (drafting / updating / generating すべて「⏳ ○○中... + 中止」)
- **disabled 状態でも tooltip 表示** (`<span title>` でラップする)
- **アクションは「アイコンのみ + マウスオーバー説明」**を好む。primary なテキスト付きボタンは最小限
- **段階的ポーリング** OK だが「停止」は嫌う (反映遅延の事故を恐れる)

---

## 5. このパッケージで特に注目してほしいファイル (再掲)

| ファイル | なぜ |
|---|---|
| [knowledge/DESIGN_DECISIONS.md](./knowledge/DESIGN_DECISIONS.md) | なぜこの設計か (Gemini バイパス等) — これを理解せず壊さないで |
| [knowledge/ANTI_PATTERNS.md](./knowledge/ANTI_PATTERNS.md) | やってはいけないこと — 同じ失敗を繰り返さないで |
| [docs/06_UI_BEHAVIOR_SPEC.md](./docs/06_UI_BEHAVIOR_SPEC.md) | UI 完全マッピング — 「全く同じに使いたい」を実現するため |
| [knowledge/BUG_FIX_PLAYBOOK.md](./knowledge/BUG_FIX_PLAYBOOK.md) | 過去のバグ集 — 統合時に同じ罠を踏まない |
| [INTEGRATION_QUESTIONS.md](./INTEGRATION_QUESTIONS.md) | 相談したいことリスト |

---

## 6. 想定される統合方針の選択肢 (材料)

これも **案**。hub-platform 側で見て決めてほしい。

### 案 A: `packages/advisor-core` に汎用化 (推奨候補)

- TASTAS Advisor を `packages/advisor-core` として抽出
- 各 Hub (sushi-hub / band-hub / tastas-hub / agent-hub) が core を import して使う
- **メリット**: 「UI 1 つ作れば全反映」の理想
- **デメリット**: 抽象化作業が大変。Tenant / Tool 注入の I/F 設計が必要

### 案 B: agent-hub に取り込んで Tool として提供

- TASTAS Advisor は単独存在せず、agent-hub の 1 機能として動く
- 各 Hub からは agent-hub に問い合わせる
- **メリット**: agent-hub が既に Multi-Agent 機構を持っているなら自然
- **デメリット**: 各 Hub 固有の業務データ取得 (TASTAS なら求人 KPI) を agent-hub 側で抽象化する必要

### 案 C: TASTAS 側を MCP server 化して agent-hub から繋ぐ

- TASTAS Advisor は今のまま TASTAS 側に残す
- agent-hub が MCP 経由で「TASTAS の指標を取って」と問い合わせる
- **メリット**: 移行コスト最小、TASTAS 側の安定性を保てる
- **デメリット**: 「UI 1 つ作れば全反映」は実現しない (UI が分散)

→ **どの案が良いかは hub-platform 側の現状次第**。INTEGRATION_QUESTIONS.md で議論する。

---

## 7. 連絡先

- ユーザー: 川島一郎 (ichiro0712@gmail.com / GitHub: @ichiro0712-dotcom)
- TASTAS 側のセッション履歴: `/docs/system-advisor/HANDOFF.md` (パッケージ内には含めていない、適宜聞く)
- 不明点 / 矛盾 / 古い情報を見つけたら → ユーザーに報告
