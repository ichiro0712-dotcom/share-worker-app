# System Advisor データモデル設計書

**最終更新**: 2026-05-04 — Canvas / 共有 URL / しおり / 保持期間 cron まで反映
**正本**: `prisma/schema.prisma` (本ドキュメントは要約 + 設計意図)

> 1 行レベルのカラム定義に齟齬が出たら **schema.prisma を正**とすること。
> 本ドキュメントは「**なぜそのカラムがあるか**」「**どう運用するか**」を記録する。

---

## 1. テーブル一覧

| テーブル名 | 役割 | 主な追加時期 |
|-----------|------|---|
| `AdvisorChatSession` | 会話セッション (1スレッド = 1レコード)、しおり (`bookmarked`) フラグ含む | Phase 1 + 2026-05-04 |
| `AdvisorChatMessage` | 会話のメッセージ単位 (user/assistant/tool) | Phase 1 |
| `AdvisorAuditLog` | 監査ログ (誰がいつ何を聞いたか・どのツールが呼ばれたか) | Phase 1 |
| `AdvisorKnowledgeCache` | GitHub から同期したプロジェクト知識のローカルキャッシュ | Phase 1 |
| `AdvisorKnowledgeSyncLog` | 知識同期の実行ログ (運用監視用) | Phase 1 |
| `AdvisorSavedPrompt` | 保存プロンプト (チャット入力テンプレ) | Phase 1 |
| `AdvisorUsageDaily` | 日次のトークン使用量 (admin × 日付、コスト管理用) | Phase 1 |
| `AdvisorReportDraft` | Canvas で固める **レポート要件 + ドラフト本体 (skeleton)** | 2026-04 + 2026-05-02 拡張 |
| `AdvisorReportVersion` | レポート本文のバージョン管理 + **共有 URL** (token / 期限) | 2026-04 + 2026-05-04 拡張 |
| `AdvisorSettings` | システム設定シングルトン (モデル切替 / システムプロンプト上書き) | P1 |

すべて `Advisor` プレフィックス + `advisor_*` テーブル名で既存テーブルと衝突しないようにする。
**カラム追加履歴**:
- `AdvisorChatSession.bookmarked` (2026-05-04, しおり機能)
- `AdvisorReportDraft.metric_keys` (P1-6, query_metric の取得対象)
- `AdvisorReportDraft.original_request` (2026-05-02, 元の要望保存)
- `AdvisorReportDraft.skeleton_markdown` (2026-05-02, Canvas で見せる骨格)
- `AdvisorReportVersion.share_token` / `shared_at` / `shared_until` (2026-05-04, 公開シェア URL)

---

## 2. 各テーブルの設計意図

### 2.1 `AdvisorChatSession`

```prisma
model AdvisorChatSession {
  id                  String   @id @default(cuid())
  admin_id            Int      // SystemAdmin.id (FK 貼らず論理参照)
  title               String   @db.VarChar(200)
  context_summary     String?  @db.Text     // 圧縮要約 (Haiku 由来)
  last_message_at     DateTime @default(now())
  total_input_tokens  Int      @default(0)
  total_output_tokens Int      @default(0)
  is_pinned           Boolean  @default(false)
  is_archived         Boolean  @default(false)
  bookmarked          Boolean  @default(false) // 2026-05-04 追加
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

  messages AdvisorChatMessage[]

  @@index([admin_id, last_message_at(sort: Desc)])
  @@index([admin_id, is_archived])
  @@index([bookmarked, updated_at])
  @@map("advisor_chat_sessions")
}
```

**`bookmarked` の意味** (2026-05-04 確定):
- `true` = しおり (永続保存)。配下の Draft / Versions は cron の削除対象外
- `false` = デフォルト。30 日触られなければ Draft / Versions は cron で削除される
- セッション本体は `bookmarked` に関係なく永続 (知識ベースとして残す)

### 2.2 `AdvisorChatMessage`

```prisma
model AdvisorChatMessage {
  id                 String   @id @default(cuid())
  session_id         String
  role               String   @db.VarChar(20)  // "user" | "assistant" | "tool"
  content            String   @db.Text
  tool_calls         Json?    // [{ id, name, input }]
  tool_result        Json?    // { tool_use_id, ok, data, error }
  input_tokens       Int?
  output_tokens      Int?
  cache_read_tokens  Int?
  cache_write_tokens Int?
  model              String?  @db.VarChar(100)
  is_compacted       Boolean  @default(false)
  created_at         DateTime @default(now())

  session AdvisorChatSession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  @@index([session_id, created_at])
  @@index([role, created_at])
  @@map("advisor_chat_messages")
}
```

**`is_compacted`**: 圧縮済みフラグ (将来の context 圧縮で使用予定、現在は常に false)。

### 2.3 `AdvisorAuditLog`

```prisma
model AdvisorAuditLog {
  id         String   @id @default(cuid())
  admin_id   Int
  session_id String?
  message_id String?
  event_type String   @db.VarChar(50)
  payload    Json
  client_ip  String?  @db.VarChar(64)
  client_ua  String?  @db.Text
  created_at DateTime @default(now())

  @@index([admin_id, created_at(sort: Desc)])
  @@index([event_type, created_at(sort: Desc)])
  @@index([session_id])
  @@map("advisor_audit_logs")
}
```

**`event_type` の運用語彙**:
`chat_request` / `chat_response` / `tool_call` / `rate_limit_hit` / `cost_cap_hit` / `error` / `knowledge_sync`

**`payload` の中の `kind` フィールド** (cron 削除分類のために重要):
- 通常イベント: `kind` なし or 任意の値
- レポート関連: `kind: "report_*"` (例: `report_draft_create` / `report_generate` / `report_share_enable` 等)
  → cron の保持期間判定で使われる (一般 90 日 / `report_*` 180 日)

### 2.4 `AdvisorKnowledgeCache` / `AdvisorKnowledgeSyncLog`

(Phase 1 から変更なし。GitHub の Contents API で `CLAUDE.md` / `docs/` / `prisma/schema.prisma` 等を取得しキャッシュする。)

### 2.5 `AdvisorSavedPrompt`

```prisma
model AdvisorSavedPrompt {
  id         String   @id @default(cuid())
  admin_id   Int
  title      String   @db.VarChar(200)
  content    String   @db.Text
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([admin_id, updated_at(sort: Desc)])
  @@map("advisor_saved_prompts")
}
```

設定ページ (`/system-admin/advisor/settings`) で admin が再利用したい質問テンプレを登録。

### 2.6 `AdvisorUsageDaily`

```prisma
model AdvisorUsageDaily {
  id                 String   @id @default(cuid())
  admin_id           Int
  date_jst           DateTime @db.Date  // JST の日付
  message_count      Int      @default(0)
  tool_call_count    Int      @default(0)
  input_tokens       Int      @default(0)
  output_tokens      Int      @default(0)
  cache_read_tokens  Int      @default(0)
  cache_write_tokens Int      @default(0)
  estimated_cost_usd Decimal  @default(0) @db.Decimal(10, 4)
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  @@unique([admin_id, date_jst])
  @@index([date_jst(sort: Desc)])
  @@map("advisor_usage_daily")
}
```

`date_jst` は JST 0 時で保存 (CLAUDE.md の JST ルール遵守)。`getTodayJSTStart()` ヘルパー使用。

### 2.7 `AdvisorReportDraft` (1 セッション = 0 or 1 ドラフト)

Canvas で「**チャットしながら要件 + 表骨格を固める**」保存先。

```prisma
model AdvisorReportDraft {
  id           String  @id @default(cuid())
  session_id   String  @unique  // AdvisorChatSession.id
  admin_id     Int
  title        String? @db.VarChar(300)
  goal         String? @db.Text         // 目的・問い
  data_sources Json?                    // ["query_metric", "query_ga4", ...]
  metric_keys  Json?                    // ["LP_PV", ...] (query_metric 用)
  range_start  String? @db.VarChar(10)  // YYYY-MM-DD JST
  range_end    String? @db.VarChar(10)
  outline      String? @db.Text         // 章立て (Markdown 箇条書き)
  notes        String? @db.Text         // 追加メモ・除外条件
  /// 元のユーザー要望 (修正指示の文脈維持用、初回のみ書く)
  original_request  String? @db.Text
  /// ドラフト本体: 0 埋めの表骨格 + 章立てが入った Markdown (Canvas に表示)
  skeleton_markdown String? @db.Text
  status       String  @default("drafting") @db.VarChar(20)
    // "drafting" | "generating" | "completed" | "failed"
  result_markdown  String? @db.Text     // 最新生成本文 (キャッシュ)
  result_model     String? @db.VarChar(100)
  error_message    String? @db.Text
  generation_count Int     @default(0)
  generated_at     DateTime?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  @@index([admin_id, updated_at(sort: Desc)])
  @@index([status])
  @@map("advisor_report_drafts")
}
```

**重要な設計判断**:

| カラム | 役割 |
|---|---|
| `skeleton_markdown` | Canvas 左ペインに表示する **0 埋めの本体**。Claude / Gemini が `[TOOL:draft_revise]` で書き換える。最終レポート (`result_markdown`) の構造テンプレ |
| `original_request` | ユーザーの初回要望。差分修正で「元の意図」を見失わないよう保存 (初回 update_report_draft 時のみサーバー側で書く) |
| `metric_keys` | `data_sources` に `query_metric` がある時に取得対象を指定する。`MetricDefinitions.tsx` のキー集合と整合 |
| `result_markdown` | 「最新版のキャッシュ」。版管理は `AdvisorReportVersion` 側 |

### 2.8 `AdvisorReportVersion` (本文の版管理 + 共有 URL)

```prisma
model AdvisorReportVersion {
  id              String  @id @default(cuid())
  draft_id        String  // AdvisorReportDraft.id (FK 貼らず論理参照)
  version_number  Int     // draft_id 内でユニーク
  result_markdown String  @db.Text
  result_model    String  @db.VarChar(100)  // "gemini-2.5-flash" / "manual" 等
  draft_snapshot  Json    // このバージョン時点の draft 要件スナップショット
  source          String  @db.VarChar(20)
    // "generated" | "manual_edit" | "llm_edit"
  parent_version_id String?
  generated_ms    Int?
  input_tokens    Int?
  output_tokens   Int?
  /// 編集モード時のロック (5 分タイムアウト)
  editing_lock_admin_id Int?
  editing_lock_at       DateTime?
  /// 公開シェア URL (2026-05-04 追加)
  share_token     String?   @unique @db.VarChar(64)
  shared_at       DateTime?
  shared_until    DateTime?
  created_at      DateTime  @default(now())

  @@unique([draft_id, version_number])
  @@index([draft_id, version_number(sort: Desc)])
  @@index([created_at(sort: Desc)])
  @@map("advisor_report_versions")
}
```

**共有 URL の運用 (2026-05-04 確定)**:
- **発行**: `share_token = randomBytes(24).toString('base64url')` (= 32 文字)、`shared_at = now()`、`shared_until = now + 30 日`
- **公開ページ**: `/advisor/r/[token]` で誰でも閲覧可 (認証不要)
- **延長**: 既存 token を維持したまま `shared_until = now + 30 日` (UX 良し)
- **停止**: `share_token / shared_at / shared_until` 全て null 化
- **再有効化時の token**: **新規発行** (旧 token を無効化、漏れた URL のリスク窓を狭める)
- **失効済み token の cleanup**: 毎日 04:00 JST の cron が `shared_until < now()` を null 化 (DB 上の不要データ削減)
- **公開ページの noindex**: SEO 流入を防ぐ (将来 robots.txt + meta で対応)

**`source` 判定**:
| source | 契機 |
|---|---|
| `generated` | Gemini で初回 / 再生成 |
| `manual_edit` | admin が Canvas 上で textarea 編集して保存 |
| `llm_edit` | チャット経由で `[TOOL:result_edit]` (Gemini 部分修正) |

### 2.9 `AdvisorSettings` (シングルトン)

```prisma
model AdvisorSettings {
  id                     String   @id @default("default")  // 常に "default"
  max_tool_loops         Int      @default(20)
  system_prompt_override String?  @db.Text
  primary_model_id       String?  // null なら code 内デフォルト
  loop1_model_id         String?  // ツール後 loop で使うモデル (Haiku 使い分け)
  updated_by_admin_id    Int?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  @@map("advisor_settings")
}
```

設定ページ (`/system-admin/advisor/settings`) で System Admin が編集。**コード変更せず DB 1 行更新でモデル切替できる**ようにする目的。

---

## 3. インデックス設計の根拠

| インデックス | 用途 |
|---|---|
| `AdvisorChatSession (admin_id, last_message_at desc)` | 「自分の会話一覧を新しい順」最頻アクセス |
| `AdvisorChatSession (admin_id, is_archived)` | アーカイブ済みを除外 |
| `AdvisorChatSession (bookmarked, updated_at)` | cron が「しおりなし + 古い」を効率的に拾う |
| `AdvisorChatMessage (session_id, created_at)` | セッション開封時の時系列ロード |
| `AdvisorAuditLog (admin_id, created_at desc)` | 「この管理者の最近の操作」 |
| `AdvisorAuditLog (event_type, created_at desc)` | 「rate_limit_hit を直近で」 |
| `AdvisorReportDraft (admin_id, updated_at desc)` | 履歴一覧 |
| `AdvisorReportVersion (draft_id, version_number desc)` | 「draft の最新版」即時取得 |
| `AdvisorReportVersion.share_token` (unique) | 公開ページの token ルックアップ + 重複防止 |
| `AdvisorUsageDaily (admin_id, date_jst)` (unique) | upsert で日次集計 |

---

## 4. 既存テーブルへの参照について

`SystemAdmin` テーブルへの外部キー (`admin_id`) は**Prisma リレーションを貼らない方針** (Phase 1 から不変):
- 理由 1: TASTAS の既存テーブル / 既存マイグレーションへの影響を避ける
- 理由 2: cascade はビジネス的に不適切 (退職した管理者の監査ログは残すべき)
- 代わりに、アプリ層で `admin_id` の存在チェックを行う

`AdvisorReportDraft.session_id` も `AdvisorChatSession` に対して**論理参照**。
セッション側のリレーションには載せていない (削除順序の柔軟性のため)。

---

## 5. JST 対応

CLAUDE.md のルールに従い、日付処理は JST 基準:
- `AdvisorUsageDaily.date_jst`: JST の 00:00:00 で保存
- `AdvisorReportDraft.range_start` / `range_end`: `YYYY-MM-DD` 文字列、JST 解釈
- 集計時は `src/lib/actions/minimumWage.ts` の `getTodayJSTStart()` / `toJSTDateString()` を使用
- Vercel サーバーは UTC で動作するため `new Date()` をそのまま「今日」判定に使わない

---

## 6. データ保持期間ポリシー (2026-05-04 確定)

設計原則: **「ユーザーが能動的に保存判断したものだけ永続、それ以外は短期で消える」**

| データ種別 | 保持期間 | 永続条件 | 削除トリガー |
|---|---|---|---|
| `AdvisorChatSession` 本体 | 永続 | (削除しない、知識ベースとして残す) | 手動アーカイブのみ |
| `AdvisorChatMessage` | セッションに従属 | 同上 | セッション削除時 cascade |
| `AdvisorReportDraft` | 30 日 | しおり付きセッションは永続 | cron が `bookmarked=false` + `updated_at < now-30d` で削除 |
| `AdvisorReportVersion` | 30 日 | 同上 (親 Draft が消えれば連動) | 同上 |
| `AdvisorAuditLog` (一般) | 90 日 | — | cron が `created_at < now-90d` |
| `AdvisorAuditLog` (`payload.kind = report_*`) | 180 日 | — | cron が `created_at < now-180d` |
| 共有 URL の `share_token` / `shared_until` | `shared_until` まで | 「+30 日延長」で更新 | cron が失効済みを null 化 |

実装: `app/api/cron/advisor-cleanup/route.ts` (Vercel Cron 毎日 04:00 JST = `0 19 * * *` UTC)。

詳細は [KNOWLEDGE.md](./KNOWLEDGE.md) §6-bis 参照。

---

## 7. Prisma 適用手順

ローカル開発環境のみで実行:

```bash
# 1. schema.prisma を編集
# 2. ローカル Docker DB に push
docker-compose up -d
npx prisma db push   # ローカル DB のみ
npx prisma generate

# 3. ステージング / 本番への push はユーザーが手動で実行
#    (CLAUDE.md のルールに従い、Claude Code は本番 DB を触らない)
```

**ステージング / 本番反映の依頼テンプレ**:
```
【DB 変更が必要です】
- 変更内容: (今回追加されたテーブル / カラム名と用途)
- 対象環境: ステージング → 本番
- 実行コマンド:
  npx prisma db push
- ⚠️ このコマンドはユーザーが直接実行してください
```

具体的なステージング展開手順は [STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) を参照。

---

## 8. 想定データ量

| テーブル | 想定 (1 年あたり) | 備考 |
|---|---|---|
| `AdvisorChatSession` | 数千行 | 永続 |
| `AdvisorChatMessage` | 数十万行 | セッション従属、永続 |
| `AdvisorAuditLog` | 100 万行〜 | 90 / 180 日で cron 削除 |
| `AdvisorKnowledgeCache` | 10〜30 行 | 常に最新のみ |
| `AdvisorKnowledgeSyncLog` | 数千行 | 古いものは将来手動 cleanup |
| `AdvisorSavedPrompt` | 数十〜数百行 | 永続 |
| `AdvisorUsageDaily` | 数千行 | 永続 (コスト分析用) |
| `AdvisorReportDraft` | 数百行 | しおりなしは 30 日で削除 |
| `AdvisorReportVersion` | 数千行 | しおりなしは 30 日で削除 |
| `AdvisorSettings` | 1 行 | シングルトン |

---

## 9. 関連ドキュメント

- [architecture.md](./architecture.md) — システム構成
- [REPORT_FEATURE.md](./REPORT_FEATURE.md) — Canvas + レポート機能の詳細
- [KNOWLEDGE.md](./KNOWLEDGE.md) — 設計判断の累積ナレッジ (§6-bis: 保持期間ポリシー)
- [STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) — ステージング展開手順
- [tools-spec.md](./tools-spec.md) — 各ツールの仕様
