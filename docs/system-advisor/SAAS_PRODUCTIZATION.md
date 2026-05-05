# System Advisor — SaaS 化・汎用化 議論ドキュメント

**作成**: 2026-05-03
**ステータス**: ⚠️ **方針確定済み (本ドキュメントは議論履歴として保存)**
**最新方針**: [HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md) を参照

---

## ⚠️ このドキュメントの位置づけ (2026-05-03 更新)

本ドキュメントで議論した「新規 SaaS リポを立てる案」は**採用されなかった**。

**確定方針**: 既存の hub-platform (Turborepo モノレポ、agent-hub / project-hub / health-hub 等が稼働中) に
TASTAS Advisor を統合する。各 Hub に System Advisor を住まわせ、`packages/advisor-core` を共有する設計。

**理由**:
- hub-platform が既に「Advisor Platform」として機能している
  - 統合 Supabase + schema 分離でマルチテナント済み
  - agent-hub に Orchestrator / マルチエージェント / Canvas / MCP が実装済み
- 新規 SaaS リポを作るより hub-platform に乗る方が、開発・保守・運用ともに筋が良い
- ユーザーが追加したい寿司屋 / バンドも hub-platform の `apps/sushi-hub` / `apps/band-hub` として自然に追加できる

**着手タイミング**: TASTAS Advisor の本番安定運用後 (詳細は [HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md))

以下のセクションは当初議論した内容の保存。最新方針との差分:
- 「マルチテナント DB スキーマ案」「ツール抽象化案」等の概念は hub-platform の `advisor-core` 抽出時の参考資料として有用
- ただし、新規 Organization テーブルを作る案は不要 (hub-platform の schema 分離で代替済み)

---

## (以下、当初議論)

---

## 0. 議論の出発点

ユーザーからの提起 (2026-05-03 セッション末尾):

> ・TASTAS 以外のサービスや、KPI 以外の情報をもつ、会社や飲食店の色々なデータを紐付け、
>   そのサービスや組織のシステムアドバイザーとして役立つ SaaS 的なものをつくりたい。
> ・プロダクト名は、いったんシステムアドバイザー (知識をまとめて教える、表示するもの)
> ・UI や機能追加は、この TASTAS や、将来的に色々なサービスにも反映できる様にしたい
> ・こういうものが可能か議論したい
> ・そのためにも、今のシステムアドバイザーの仕様に、過去の改善履歴やナレッジなども追加したい

**最後の項目** (改善履歴・ナレッジの蓄積) は本セッションで対応:
- [HANDOFF.md](./HANDOFF.md) にセッションログを継続的に積み上げ済み
- [KNOWLEDGE.md](./KNOWLEDGE.md) を新設して「**今後も再利用したい設計判断・教訓**」を構造化

---

## 1. 現状の System Advisor の構成 (汎用化検討の起点)

### 1.1 機能スタック

```
┌──────────────────────────────────────────────────┐
│  チャット UI (左ペイン)                            │
│  - ツール選択 (レポート作成 / ドラフト修正 / レポート修正)│
│  - メッセージ履歴 + イベントラベル                  │
│  - モデル切替 (Sonnet / Gemini)                    │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│  Orchestrator (SSE ストリーム)                    │
│  - メッセージ前処理 + ツール検出                  │
│  - Gemini バイパス (create / revise / result_edit)│
│  - Anthropic ツールループ (フォールバック / 一般チャット)│
│  - auto-redraft フロー (新データ取得が必要時)     │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│  データソース層 (collect.ts)                       │
│  - 本番 DB 指標集計 (query_metric, metric カタログ駆動)│
│  - GA4 (5 種 report_type)                          │
│  - Search Console (4 種 dimensions)                │
│  - 求人/ユーザーサマリ (TASTAS 専用)               │
│  - エラーログ / Supabase / Vercel / GitHub         │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│  レポート生成 (Gemini Flash)                       │
│  - skeleton + previousResultMarkdown + collected を統合│
│  - Markdown レポート生成                           │
│  - AdvisorReportVersion として永続化               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Canvas UI (右ペイン)                              │
│  - ドラフト本体プレビュー (skeleton)                │
│  - 要件編集フォーム                                │
│  - レポート表示 (バージョン切替)                  │
│  - レポート作成ボタン (生成トリガー)               │
└──────────────────────────────────────────────────┘
```

### 1.2 TASTAS 固有 vs 汎用な部分の切り分け

| 区分 | コンポーネント | TASTAS 固有度 |
|---|---|---|
| 汎用 | チャット UI / Canvas UI | ◎ そのまま流用可 |
| 汎用 | Orchestrator / Gemini バイパスフロー | ◎ そのまま流用可 |
| 汎用 | レポート生成パイプライン (collect → Gemini) | ○ ツール定義をプラガブルに |
| 汎用 | ドラフト・バージョン管理 (DB スキーマ) | ◎ そのまま流用可 |
| 汎用 | 出典 / 集計期間 / 箇条書きルール (プロンプト) | ◎ そのまま流用可 |
| 半汎用 | ツール抽象 (ToolDefinition インターフェース) | ○ 設計済み、追加実装が必要 |
| **固有** | METRIC_CATALOG (LP_PV / NEW_WORKERS など) | × TASTAS 専用、置換が必要 |
| **固有** | query_metric の集計ロジック (Prisma クエリ) | × TASTAS DB スキーマ前提 |
| **固有** | get_jobs_summary / get_users_summary | × TASTAS 専用 |
| **固有** | LpClickEvent, LandingPage 等のテーブル | × TASTAS 専用 |
| 設定可 | GA4 プロパティ ID / Search Console URL | △ 環境変数で差し替え可 |

**結論**: 全体の **70% 程度は汎用化可能**。残り 30% が組織・サービス固有のデータソース定義。

---

## 2. SaaS 化の実現可能性

### 2.1 技術的に可能か → **YES (条件付き)**

System Advisor のコア (チャット + Canvas + Gemini バイパス + レポート生成パイプライン) は **TASTAS の業務知識に依存していない**。
以下の条件を満たせば、組織・サービス横断の SaaS として成立する:

1. **データソースをプラガブルにする** (現在は import 静的バインド → DB / 設定駆動に)
2. **テナント分離** (admin_id 単位で完結するよう DB を設計)
3. **メトリクス定義を動的化** (METRIC_CATALOG をテーブル化、organization 単位で管理)
4. **データソース接続情報のマルチテナント対応** (各 org の GA4 プロパティ / Search Console / DB 接続)

### 2.2 ビジネスモデル想定

**プロダクト名** (仮): System Advisor / OrgAdvisor / DataDoctor / KnowledgeOps

**ターゲット** (例):
- 自社サービスを持つスタートアップ・中小企業 (KPI レポート自動化)
- 複数店舗を持つ飲食店チェーン (POS データ + Google Business Profile + GA4)
- EC 運営者 (Shopify / Amazon Seller Central + GA4)
- メディア運営 (Search Console + GA4 + CMS データ)
- BtoB SaaS ベンダー (Stripe + Mixpanel + 自社 DB)

**価値提供**:
1. **「データソースを繋ぐだけ」でレポート作成・運用相談ができる AI アドバイザー**
2. **過去のレポート・チャット・ナレッジを蓄積**して組織の知識ベース化
3. **グラフィック / 表 / 文章を統合した Markdown レポート**を自動生成 (差分編集も可)

---

## 3. 汎用化のためのアーキテクチャ拡張案

### 3.1 マルチテナント DB スキーマ

新規テーブル:
```prisma
model Organization {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  plan         String   // free / pro / enterprise
  settings     Json     // タイムゾーン / 期間定義など
  created_at   DateTime @default(now())
  // 関連
  users        OrgUser[]
  data_sources OrgDataSource[]
  metrics      OrgMetric[]
  // Advisor 機能
  advisor_sessions AdvisorChatSession[]
  advisor_drafts   AdvisorReportDraft[]
}

model OrgUser {
  id              String   @id @default(cuid())
  organization_id String
  email           String
  role            String   // owner / admin / editor / viewer
  // ...
}

/// 組織が接続したデータソース (GA4 / Search Console / 独自 DB / Stripe 等)
model OrgDataSource {
  id              String   @id @default(cuid())
  organization_id String
  type            String   // 'ga4' | 'search_console' | 'postgres' | 'stripe' | ...
  display_name    String   // ユーザーが見る名前 (例: "本番 DB", "GA4 - 本サイト")
  credentials     Json     // 暗号化された接続情報 (KMS 推奨)
  config          Json     // ツール固有設定 (GA4 property_id など)
  enabled         Boolean
  created_at      DateTime
}

/// 組織が定義したメトリクス (TASTAS の METRIC_CATALOG をテーブル化)
model OrgMetric {
  id              String   @id @default(cuid())
  organization_id String
  key             String   // 例: 'NEW_WORKERS', 'LP_PV'
  label           String   // 表示名 (例: 「新規ワーカー数」)
  description     String
  unit            String   // 件 / PV / 円 / %
  data_source_id  String   // どの OrgDataSource から取るか
  query_template  Json     // SQL テンプレート / GA4 dimensions / etc
  group_by        String[] // none / day / lp_id / custom_dim
  enabled         Boolean
  // ...
}

// 既存の AdvisorChatSession / AdvisorReportDraft 等に organization_id を追加
```

### 3.2 ツール抽象化 (プラガブル)

現在は import 静的バインド (`registry.ts` で all tools を集約) → **DB 駆動の動的レジストリ**に:

```typescript
interface ToolProvider {
  type: string  // 'ga4' | 'search_console' | 'postgres_metric' | ...
  buildExecutors(orgDataSource: OrgDataSource): Tool[]
  // - 認証情報はテナント固有 (orgDataSource.credentials)
  // - メトリクス定義もテナント固有 (orgMetric から動的生成)
}

// 実行時:
const tools = await toolRegistry.buildForOrganization(organization.id)
// → 各 OrgDataSource を ToolProvider にマッピングしてツール一覧を返す
```

### 3.3 メトリクス定義 UI

組織 admin が **コードを書かずにメトリクスを定義**できる UI:
- データソース選択 (例: 本番 DB)
- 集計クエリ設計 (テーブル / カラム / 期間 / group by)
- 単位 (件 / 円 / %)
- 表示名・説明
- group_by の選択肢 (none / day / 任意のカラム)

実装イメージ:
```
[新規メトリクス作成]
├ データソース: [▼ 本番 DB Postgres ]
├ テーブル: [▼ orders ]
├ 集計: [▼ count(*) ]
├ 期間カラム: [▼ created_at ]
├ 表示名: 注文件数
├ group_by 候補:
│  ├ none (期間合計)
│  ├ day (日別)
│  └ category_id (カテゴリ別)  ← カラム選択
└ [保存]
```

### 3.4 認証・テナント分離

- NextAuth で組織選択 (1 ユーザー = 複数組織所属可能)
- すべての API / Server Action で `organization_id` を必須コンテキストに
- DB クエリで `where: { organization_id: ctx.org.id }` を全箇所必須化
- RLS (Row Level Security) を Postgres で有効化 (Supabase なら標準)

---

## 4. TASTAS との関係 (1 テナントとして共存)

汎用化後の TASTAS:
- TASTAS 用 organization レコード 1 つ
- TASTAS の DB / GA4 / Search Console を OrgDataSource として登録
- 既存の METRIC_CATALOG を OrgMetric として移行
- 既存の System Admin ユーザーが TASTAS organization の admin

**移行コスト**: 中規模 (テーブル追加 + 既存テーブルに organization_id 追加 + RLS 設定 + 既存データのマイグレーション)。
ただし**1 度やれば、新規組織は数分で追加可能**。

---

## 5. プロダクト独立 vs TASTAS 内モノリスの選択

### A. TASTAS リポジトリ内に共存 (現状の延長)
**メリット**:
- TASTAS と同じスタック・デプロイ環境で動く
- TASTAS の改善が即座にアドバイザー機能に反映できる
- 開発初期は速い

**デメリット**:
- TASTAS 顧客 (看護師) と Advisor 顧客 (各組織 admin) の認証・課金が混ざる
- Advisor を独立販売するときに切り出すコストがかかる
- ブランド分離ができない

### B. 独立リポジトリ・独立サービスとして分離
**メリット**:
- ブランド・課金・契約・サポートを完全分離
- スケール・SLA を Advisor 用に設計可能
- TASTAS は 1 顧客として API 経由で連携

**デメリット**:
- 初期構築コストが大きい (リポジトリ分離 + 認証分離 + API 設計)
- TASTAS 側の運用・改善との二重管理

### C. ハイブリッド (推奨案)
**段階 1**: TASTAS 内に「Advisor モジュール」を持ったまま、内部で organization 抽象を入れる
**段階 2**: TASTAS = テナント 1、社外組織 = テナント 2, 3... と増える設計に
**段階 3**: 顧客が増えたタイミングで独立リポジトリに切り出し (organization 抽象が完成しているので分離コスト低)

---

## 6. 議論したいポイント (次セッションで決めたいこと)

### 🔴 戦略レベル
1. **本気で SaaS 化を目指すか?** それとも TASTAS 専用ツールとして洗練するか?
2. SaaS 化するならターゲット業種は? (KPI レポート系? 飲食店? EC?)
3. 価格モデル想定 (月額 / 従量 / フリーミアム)?

### 🟡 設計レベル
4. マルチテナント化のタイミング (今すぐ / TASTAS 完成後 / MVP として別プロジェクト立ち上げ)?
5. データソースのプラガブル化はどこまでやるか (TASTAS 用ハードコード残しつつ拡張口だけ用意?)
6. メトリクス定義 UI を作るか (Advisor の重要機能になる、ただしリッチな UI が必要)

### 🟢 戦術レベル
7. ナレッジベース機能 (KNOWLEDGE.md の延長で「組織のナレッジを Advisor が学習・参照」する機能) を別途作る?
8. レポートのテンプレート化 / 共有 / マーケットプレイス的な機能はあり?
9. Slack / Google Chat / Email への配信機能を強化する?

### 🔵 技術選定
10. 認証は NextAuth 継続 / Clerk / Auth0 / 自前?
11. KMS は AWS Secrets Manager / Doppler / Supabase Vault?
12. 課金は Stripe Billing 直接実装?

---

## 7. 議論用の論点メモ (本セッション中の議論に追記する用)

```
(次セッションでユーザーと議論しながら追記)

例:
- 2026-05-04: ターゲットは EC + メディア運営に絞ることに決定
- 2026-05-04: マルチテナント化は段階 1 (organization 抽象のみ) を 2 週間で実装することに合意
- ...
```

---

## 8. 関連リンク

- [HANDOFF.md](./HANDOFF.md) — セッションログ
- [KNOWLEDGE.md](./KNOWLEDGE.md) — 設計知見の累積
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — 現状のレポート機能仕様
- [architecture.md](./architecture.md) — 全体アーキテクチャ
- [data-model.md](./data-model.md) — DB スキーマ
