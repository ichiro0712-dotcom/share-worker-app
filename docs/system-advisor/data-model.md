# System Advisor データモデル設計書

## 1. 追加するテーブル一覧

| テーブル名 | 役割 |
|-----------|------|
| `AdvisorChatSession` | 会話セッション (1スレッド = 1レコード) |
| `AdvisorChatMessage` | 会話のメッセージ単位 (user/assistant/tool) |
| `AdvisorAuditLog` | 監査ログ (誰がいつ何を聞いたか・どのツールが呼ばれたか) |
| `AdvisorKnowledgeCache` | GitHub から同期したプロジェクト知識のローカルキャッシュ |
| `AdvisorKnowledgeSyncLog` | 知識同期の実行ログ (運用監視用) |
| `AdvisorUsageDaily` | 日次のトークン使用量 (admin 別、コスト管理用) |

すべて `Advisor` プレフィックスで既存テーブルと衝突しないようにする。

## 2. Prismaスキーマ (prisma/schema.prisma に追記)

```prisma
// =================================================================
// System Advisor (システムアドバイザー) — LLMチャットボット機能
// 詳細は docs/system-advisor/data-model.md を参照
// =================================================================

/// チャットセッション (1スレッド = 1レコード)
model AdvisorChatSession {
  id                String                @id @default(cuid())
  /// SystemAdmin.id を参照 (外部キーは貼らない: 既存テーブルへの影響を避ける)
  admin_id          Int
  title             String                @db.VarChar(200)
  /// コンテキスト圧縮後の要約 (圧縮が走った場合のみ)
  context_summary   String?               @db.Text
  /// 最後のメッセージ送信時刻 (一覧ソート用)
  last_message_at   DateTime              @default(now())
  /// 累計トークン使用量 (このセッション全体)
  total_input_tokens  Int                 @default(0)
  total_output_tokens Int                 @default(0)
  /// クライアント表示用フラグ
  is_pinned         Boolean               @default(false)
  is_archived       Boolean               @default(false)
  created_at        DateTime              @default(now())
  updated_at        DateTime              @updatedAt

  messages          AdvisorChatMessage[]

  @@index([admin_id, last_message_at(sort: Desc)])
  @@index([admin_id, is_archived])
  @@map("advisor_chat_sessions")
}

/// メッセージ (1レコード = user/assistant/tool の1ターン分)
model AdvisorChatMessage {
  id              String              @id @default(cuid())
  session_id      String
  /// "user" | "assistant" | "tool"
  role            String              @db.VarChar(20)
  /// テキスト本文 (assistant の最終回答 or user の入力)
  content         String              @db.Text
  /// アシスタントが呼んだツール呼び出し列 (JSON 配列)
  /// [{ id, name, input }]
  tool_calls      Json?
  /// tool ロールの場合の結果 (1つのレコードに1ツール結果)
  /// { tool_use_id, ok, data, error }
  tool_result     Json?
  /// このメッセージで使ったトークン
  input_tokens    Int?
  output_tokens   Int?
  cache_read_tokens  Int?
  cache_write_tokens Int?
  /// 使用したモデル名
  model           String?             @db.VarChar(100)
  /// 圧縮済みフラグ (true なら context_summary に取り込み済み)
  is_compacted    Boolean             @default(false)
  created_at      DateTime            @default(now())

  session         AdvisorChatSession  @relation(fields: [session_id], references: [id], onDelete: Cascade)

  @@index([session_id, created_at])
  @@index([role, created_at])
  @@map("advisor_chat_messages")
}

/// 監査ログ (誰が何を聞いたか・どのツールを呼んだかを完全記録)
model AdvisorAuditLog {
  id              String      @id @default(cuid())
  admin_id        Int
  session_id      String?
  message_id      String?
  /// "chat_request" | "tool_call" | "rate_limit_hit" | "cost_cap_hit" | "error" | "knowledge_sync"
  event_type      String      @db.VarChar(50)
  /// 質問文・ツール名・エラー内容など、種別ごとに意味が変わる
  payload         Json
  /// IP / UserAgent
  client_ip       String?     @db.VarChar(64)
  client_ua       String?     @db.Text
  created_at      DateTime    @default(now())

  @@index([admin_id, created_at(sort: Desc)])
  @@index([event_type, created_at(sort: Desc)])
  @@index([session_id])
  @@map("advisor_audit_logs")
}

/// プロジェクト知識のキャッシュ (CLAUDE.md / docs / schema 等)
model AdvisorKnowledgeCache {
  id              String      @id @default(cuid())
  /// "claude_md" | "doc:requirements" | "doc:system_design" | "schema_prisma" | "metric_definitions" | ...
  source_key      String      @unique @db.VarChar(100)
  /// 表示用ラベル
  label           String      @db.VarChar(200)
  /// GitHub 上のパス
  source_path     String      @db.VarChar(500)
  /// content の SHA-256 (16進)
  content_hash    String      @db.VarChar(64)
  /// 本文 (大きいファイル想定で text)
  content         String      @db.Text
  /// バイト数 (簡易メトリクス)
  byte_size       Int
  /// 最後に GitHub から取得した時刻
  last_synced_at  DateTime    @default(now())
  /// GitHub 取得時の commit SHA (オプション、Contents API なら blob sha)
  source_sha      String?     @db.VarChar(64)
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  @@index([source_key])
  @@map("advisor_knowledge_cache")
}

/// 知識同期の実行ログ (cron 実行ごとに1レコード)
model AdvisorKnowledgeSyncLog {
  id              String      @id @default(cuid())
  /// "scheduled" | "manual" | "startup"
  trigger         String      @db.VarChar(20)
  /// 同期対象数
  files_total     Int
  /// 変更があったファイル数
  files_changed   Int
  /// "success" | "partial" | "failed"
  status          String      @db.VarChar(20)
  /// エラー時のメッセージ (JSON で複数記録可)
  errors          Json?
  /// 実行所要時間 (ms)
  duration_ms     Int
  started_at      DateTime    @default(now())
  finished_at     DateTime?

  @@index([started_at(sort: Desc)])
  @@index([status, started_at(sort: Desc)])
  @@map("advisor_knowledge_sync_logs")
}

/// 日次の使用量サマリ (admin × 日付 でユニーク)
model AdvisorUsageDaily {
  id                  String      @id @default(cuid())
  admin_id            Int
  /// JST の日付 (YYYY-MM-DD 00:00:00+09:00)
  date_jst            DateTime    @db.Date
  message_count       Int         @default(0)
  tool_call_count     Int         @default(0)
  input_tokens        Int         @default(0)
  output_tokens       Int         @default(0)
  cache_read_tokens   Int         @default(0)
  cache_write_tokens  Int         @default(0)
  /// 概算コスト (USD) — モデル別のレートで計算
  estimated_cost_usd  Decimal     @default(0) @db.Decimal(10, 4)
  created_at          DateTime    @default(now())
  updated_at          DateTime    @updatedAt

  @@unique([admin_id, date_jst])
  @@index([date_jst(sort: Desc)])
  @@map("advisor_usage_daily")
}
```

## 3. インデックス設計の根拠

### `AdvisorChatSession`
- `(admin_id, last_message_at desc)`: 「自分の会話一覧を新しい順で表示」が最頻アクセス
- `(admin_id, is_archived)`: アーカイブ済みを除外したい場合の絞り込み

### `AdvisorChatMessage`
- `(session_id, created_at)`: セッション開封時に時系列でロード
- `(role, created_at)`: 監査・分析用 (例: 直近のツール呼び出しを見る)

### `AdvisorAuditLog`
- `(admin_id, created_at desc)`: 「この管理者の最近の操作」
- `(event_type, created_at desc)`: 「rate_limit_hit を直近で確認」

### `AdvisorKnowledgeCache`
- `source_key` をユニーク+インデックス: 起動時の参照が高頻度

### `AdvisorUsageDaily`
- `(admin_id, date_jst)` ユニーク: upsert で日次集計
- `(date_jst desc)`: 全体使用量の日次推移ダッシュボード用

## 4. 既存テーブルへの参照について

`SystemAdmin` テーブルへの外部キー (`admin_id`) は**Prismaのリレーションを貼らない方針**:

- 理由1: TASTAS の既存テーブルへ影響を与えたくない (`SystemAdmin` のスキーマ変更を最小化)
- 理由2: 削除時の cascade はビジネス的に不適切 (退職した管理者の監査ログは残すべき)
- 代わりに、アプリ層で `admin_id` の存在チェックを行う

## 5. JST 対応

CLAUDE.md のルールに従い、日付処理は JST 基準:

- `AdvisorUsageDaily.date_jst`: 必ず JST の 00:00:00 で保存
- 集計時は `src/lib/actions/minimumWage.ts` のヘルパー (`getTodayJSTStart()`, `toJSTDateString()`) を使用
- Vercel サーバーは UTC で動作するため `new Date()` をそのまま使わない

## 6. Prisma 適用手順 (ユーザー作業)

ローカル開発環境のみで実行:

```bash
# 1. schema.prisma に追記済みであることを確認
# 2. ローカル Docker DB に push
docker-compose up -d
npx prisma db push  # ローカルDBのみ
npx prisma generate

# 3. 動作確認後、本番への push はユーザーが手動で
# (CLAUDE.md のルールに従い、Claude Code は本番DBを触らない)
```

**本番反映時:**
```
【DB変更が必要です】
- 変更内容: AdvisorChatSession / AdvisorChatMessage / AdvisorAuditLog /
  AdvisorKnowledgeCache / AdvisorKnowledgeSyncLog / AdvisorUsageDaily の追加
- 対象環境: ステージング → 本番
- 実行コマンド:
  npx prisma db push
- ⚠️ このコマンドはユーザーが直接実行してください
```

## 7. 想定データ量と保持ポリシー

| テーブル | 想定データ量 | 保持ポリシー (目安) |
|---------|------------|------------------|
| AdvisorChatSession | 数千行/年 | 永久保存 (ユーザーがアーカイブ可) |
| AdvisorChatMessage | 数十万行/年 | 永久保存 (圧縮済みも残す) |
| AdvisorAuditLog | 100万行/年 | 1年保存推奨 (Phase 外で cleanup スクリプト) |
| AdvisorKnowledgeCache | 10〜30行 | 常に最新のみ |
| AdvisorKnowledgeSyncLog | 数千行/年 | 90日保存推奨 |
| AdvisorUsageDaily | 数千行/年 | 永久保存 |

## 8. 将来拡張時のスキーマ追加例

### LINE 友だち追加イベント (Phase 1 外、将来追加)

```prisma
model LineFriendEvent {
  id              String      @id @default(cuid())
  line_user_id    String      @db.VarChar(100)
  /// 流入元LP (URLパラメータから抽出)
  registration_lp_id   String?
  registration_campaign_code String?
  event_type      String      @db.VarChar(40)  // "follow" | "unfollow" | "message"
  raw_payload     Json
  occurred_at     DateTime    @default(now())

  @@index([occurred_at(sort: Desc)])
  @@index([registration_lp_id])
  @@map("line_friend_events")
}
```

→ Advisor のツール `query_line_friends` を後から追加する際、このテーブルを SELECT するだけ。
