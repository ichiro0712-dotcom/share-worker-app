# 通知管理システム設計書

> **作成日**: 2025-12-12
> **ステータス**: 設計完了

---

## 1. 概要

サービス内の各種通知（チャット通知・メール・Webプッシュ）を一元管理するシステム。
システム管理者がON/OFF切り替え、テンプレート編集を行える。

### 通知チャンネル

| チャンネル | 説明 |
|------------|------|
| チャット通知 | 運営からのシステムメッセージとしてチャットに送信 |
| メール | 担当者メールアドレス（複数可）に送信 |
| Webプッシュ | ブラウザ/PWAプッシュ通知 |

---

## 2. 通知一覧

### 2.1 ワーカー向け通知

| キー | イベント | チャット | メール | プッシュ |
|------|----------|:--------:|:------:|:--------:|
| `WORKER_NEW_MESSAGE` | 新着メッセージ | ー | ✅ | ✅ |
| `WORKER_MATCHED` | マッチング成立（即時） | ✅ | ✅ | ✅ |
| `WORKER_INTERVIEW_ACCEPTED` | 審査あり求人：採用決定 | ✅ | ✅ | ✅ |
| `WORKER_INTERVIEW_REJECTED` | 審査あり求人：不採用 | ✅ | ✅ | ー |
| `WORKER_CANCELLED_BY_FACILITY` | 施設からのキャンセル | ✅ | ✅ | ✅ |
| `WORKER_REMINDER_DAY_BEFORE` | 勤務前日リマインド | ✅ | ✅ | ✅ |
| `WORKER_REMINDER_SAME_DAY` | 勤務当日リマインド | ー | ー | ✅ |
| `WORKER_REVIEW_REQUEST` | 勤務終了後：レビュー依頼 | ✅ | ✅ | ー |
| `WORKER_REVIEW_REMINDER` | レビュー催促（未投稿時） | ✅ | ✅ | ー |
| `WORKER_REVIEW_RECEIVED` | 施設からレビューが届いた | ✅ | ✅ | ー |
| `WORKER_ANNOUNCEMENT` | お知らせ（運営から） | ー | ー | ✅ |
| `WORKER_FAVORITE_DEADLINE` | 応募締切間近のお気に入り求人 | ー | ー | ✅ |
| `WORKER_FAVORITE_NEW_JOB` | お気に入り施設の新着求人 | ー | ー | ✅ |

### 2.2 施設向け通知

| キー | イベント | チャット | メール | プッシュ |
|------|----------|:--------:|:------:|:--------:|
| `FACILITY_NEW_MESSAGE` | 新着メッセージ | ー | ✅ | ✅ |
| `FACILITY_NEW_APPLICATION` | 新規応募 | ✅ | ✅ | ✅ |
| `FACILITY_CANCELLED_BY_WORKER` | ワーカーからのキャンセル | ✅ | ✅ | ✅ |
| `FACILITY_REMINDER_DAY_BEFORE` | 勤務前日リマインド | ✅ | ✅ | ✅ |
| `FACILITY_REVIEW_REQUEST` | 勤務終了後：レビュー依頼 | ✅ | ✅ | ー |
| `FACILITY_REVIEW_RECEIVED` | ワーカーからレビューが届いた | ✅ | ✅ | ー |
| `FACILITY_DEADLINE_WARNING` | 求人締切間近（応募少ない） | ー | ✅ | ー |
| `FACILITY_SLOTS_FILLED` | 募集枠が埋まった | ー | ー | ✅ |
| `FACILITY_ANNOUNCEMENT` | お知らせ（運営から） | ー | ー | ✅ |

### 2.3 システム管理者向けアラート

| キー | イベント | ダッシュボード | メール |
|------|----------|:--------------:|:------:|
| `ADMIN_NEW_FACILITY` | 新規施設登録（要審査） | ✅ | ✅ |
| `ADMIN_NEW_WORKER` | 新規ワーカー登録 | ✅ | ー |
| `ADMIN_HIGH_CANCEL_RATE` | キャンセル率異常 | ✅ | ✅ |
| `ADMIN_LOW_RATING_STREAK` | 低評価レビュー連続 | ✅ | ✅ |
| `ADMIN_SUSPICIOUS_ACCESS` | 不正アクセス検知 | ✅ | ✅ |

---

## 3. DB設計

### 3.1 NotificationSetting（通知設定）

```prisma
model NotificationSetting {
  id               Int      @id @default(autoincrement())
  notification_key String   @unique @map("notification_key")
  name             String
  description      String?
  target_type      String   @map("target_type") // "WORKER" | "FACILITY" | "SYSTEM_ADMIN"

  // チャンネル別ON/OFF
  chat_enabled     Boolean  @default(true) @map("chat_enabled")
  email_enabled    Boolean  @default(true) @map("email_enabled")
  push_enabled     Boolean  @default(true) @map("push_enabled")

  // チャット通知テンプレート（変数: {{worker_name}}, {{facility_name}}, {{job_title}}, {{work_date}} 等）
  chat_message     String?  @db.Text @map("chat_message")

  // メールテンプレート
  email_subject    String?  @map("email_subject")
  email_body       String?  @db.Text @map("email_body")

  // プッシュ通知テンプレート
  push_title       String?  @map("push_title")
  push_body        String?  @map("push_body")

  created_at       DateTime @default(now()) @map("created_at")
  updated_at       DateTime @updatedAt @map("updated_at")

  @@map("notification_settings")
}
```

### 3.2 NotificationLog（送信ログ）

```prisma
model NotificationLog {
  id                Int      @id @default(autoincrement())
  notification_key  String   @map("notification_key")
  channel           String   // "CHAT" | "EMAIL" | "PUSH"
  target_type       String   @map("target_type") // "WORKER" | "FACILITY" | "SYSTEM_ADMIN"

  // 宛先
  recipient_id      Int      @map("recipient_id") // User.id, FacilityAdmin.id, or SystemAdmin.id
  recipient_name    String?  @map("recipient_name")
  recipient_email   String?  @map("recipient_email")

  // メール用
  from_address      String?  @map("from_address")
  to_addresses      String[] @default([]) @map("to_addresses") // 複数宛先対応
  subject           String?
  body              String?  @db.Text

  // チャット用
  chat_application_id Int?   @map("chat_application_id") // どのApplicationに紐づくか
  chat_message      String?  @db.Text @map("chat_message")

  // プッシュ用
  push_title        String?  @map("push_title")
  push_body         String?  @map("push_body")
  push_url          String?  @map("push_url")

  status            String   @default("SENT") // "SENT" | "FAILED"
  error_message     String?  @map("error_message")
  created_at        DateTime @default(now()) @map("created_at")

  @@index([target_type, created_at])
  @@index([notification_key])
  @@map("notification_logs")
}
```

---

## 4. 画面設計

### 4.1 通知管理トップ（/system-admin/content/notifications）

```
┌─────────────────────────────────────────────────────────┐
│ 通知管理                                                 │
├─────────────────────────────────────────────────────────┤
│ タブ: [ワーカー向け] [施設向け] [システム管理者向け]        │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ マッチング成立                                       │ │
│ │ 応募が承認され、マッチングが成立した時に送信          │ │
│ │                                                     │ │
│ │ [✓] チャット  [✓] メール  [✓] プッシュ              │ │
│ │                                         [編集]     │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 施設からのキャンセル                                 │ │
│ │ 施設が予約をキャンセルした時に送信                   │ │
│ │                                                     │ │
│ │ [✓] チャット  [✓] メール  [✓] プッシュ              │ │
│ │                                         [編集]     │ │
│ └─────────────────────────────────────────────────────┘ │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 テンプレート編集モーダル

```
┌─────────────────────────────────────────────────────────┐
│ テンプレート編集: マッチング成立                          │
├─────────────────────────────────────────────────────────┤
│ 【利用可能な変数】                                       │
│ {{worker_name}} {{facility_name}} {{job_title}}         │
│ {{work_date}} {{start_time}} {{end_time}} {{wage}}      │
│ （クリックでコピー）                                     │
├─────────────────────────────────────────────────────────┤
│ ■ チャット通知                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ {{worker_name}}さん、マッチングが成立しました！        │ │
│ │                                                     │ │
│ │ 勤務先: {{facility_name}}                           │ │
│ │ 日時: {{work_date}} {{start_time}}〜{{end_time}}    │ │
│ │ 報酬: {{wage}}円                                    │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ■ メール                                                │
│ 件名: [【+TASTAS】マッチング成立のお知らせ              ]│
│ ┌─────────────────────────────────────────────────────┐ │
│ │ {{worker_name}}様                                   │ │
│ │                                                     │ │
│ │ お仕事のマッチングが成立しました。                   │ │
│ │ ...                                                 │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ■ プッシュ通知                                          │
│ タイトル: [マッチング成立                              ] │
│ 本文:     [{{facility_name}}の勤務が確定しました       ] │
├─────────────────────────────────────────────────────────┤
│                              [キャンセル] [保存]        │
└─────────────────────────────────────────────────────────┘
```

### 4.3 通知確認画面（/system-admin/dev-portal/notification-logs）

開発者・非プログラマがメールボックスのように送信された通知を確認できる画面。

```
┌─────────────────────────────────────────────────────────┐
│ 📬 通知確認（開発用）                                    │
├─────────────────────────────────────────────────────────┤
│ タブ: [ワーカー宛] [施設宛] [システム管理者宛]            │
├─────────────────────────────────────────────────────────┤
│ フィルター: [全て ▼] [メール ▼] [プッシュ ▼] [チャット ▼]│
│             日付: [2025/01/01] 〜 [2025/01/31]          │
├─────────────────────────────────────────────────────────┤
│ ┌──────┬────────┬──────────┬──────────────┬───────────┐ │
│ │ 種別 │ 宛先    │ 件名/内容 │ 送信日時      │ 状態     │ │
│ ├──────┼────────┼──────────┼──────────────┼───────────┤ │
│ │ ✉️   │ 田中太郎│ マッチング│ 12/12 10:30  │ ✅ 送信  │ │
│ │      │ tanaka@│ 成立のお  │              │          │ │
│ │      │ ...    │ 知らせ    │              │          │ │
│ ├──────┼────────┼──────────┼──────────────┼───────────┤ │
│ │ 🔔   │ 田中太郎│ 勤務リマ  │ 12/12 09:00  │ ✅ 送信  │ │
│ │      │        │ インド    │              │          │ │
│ ├──────┼────────┼──────────┼──────────────┼───────────┤ │
│ │ 💬   │ 田中太郎│ マッチング│ 12/12 10:30  │ ✅ 送信  │ │
│ │      │ App#123│ 成立しま  │              │          │ │
│ │      │        │ した！    │              │          │ │
│ └──────┴────────┴──────────┴──────────────┴───────────┘ │
│                                                         │
│ ← 1 2 3 ... →                                          │
└─────────────────────────────────────────────────────────┘
```

### 詳細表示（クリック時）

```
┌─────────────────────────────────────────────────────────┐
│ メール詳細                                              │
├─────────────────────────────────────────────────────────┤
│ 送信日時: 2025/12/12 10:30:45                           │
│ 種別: メール (WORKER_MATCHED)                           │
│ 状態: ✅ 送信成功                                       │
├─────────────────────────────────────────────────────────┤
│ From: noreply@tastas.jp                                │
│ To: tanaka@example.com, assistant@example.com           │
│ Subject: 【+TASTAS】マッチング成立のお知らせ             │
├─────────────────────────────────────────────────────────┤
│ 田中太郎様                                              │
│                                                         │
│ お仕事のマッチングが成立しました。                       │
│                                                         │
│ 勤務先: 〇〇介護施設                                    │
│ 日時: 2025年1月15日 9:00〜18:00                         │
│ 報酬: 15,000円                                          │
│                                                         │
│ 詳細はマイページよりご確認ください。                     │
│ https://tastas.jp/my-jobs/123                          │
│                                                         │
│ ──────────────────────────────────────────              │
│ +TASTAS 運営                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 5. チャット通知の仕組み

### 運営からのシステムメッセージとして送信

既存の`Message`モデルを使用し、`from_user_id`と`from_facility_id`の両方が`null`の場合を「運営からのメッセージ」として扱う。

```typescript
// メッセージ送信時の判定
const isSystemMessage = !message.from_user_id && !message.from_facility_id;

// 表示時
if (isSystemMessage) {
  // 運営アイコン + 「運営」として表示
}
```

### チャット画面での表示

```
┌─────────────────────────────────────────────────────────┐
│ 〇〇介護施設 とのチャット                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │ 🏢 運営                              │               │
│  │                                     │               │
│  │ マッチングが成立しました！           │               │
│  │                                     │               │
│  │ 勤務先: 〇〇介護施設                │               │
│  │ 日時: 1/15 9:00〜18:00             │               │
│  │ 報酬: 15,000円                     │               │
│  │                                     │               │
│  │ 当日はよろしくお願いいたします。     │               │
│  │                           10:30    │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│                    ┌────────────────────────────────┐  │
│                    │ よろしくお願いします！          │  │
│                    │                       10:35   │  │
│                    └────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 通知トリガー実装

### 6.1 実装箇所一覧

| イベント | トリガー箇所 | ファイル |
|----------|--------------|----------|
| マッチング成立 | 応募承認時 | `src/lib/actions.ts` |
| キャンセル | キャンセル処理時 | `src/lib/actions.ts` |
| 新規応募 | 応募作成時 | `src/lib/actions.ts` |
| リマインド | cronジョブ | `src/lib/cron/reminders.ts`（新規） |
| レビュー依頼 | 勤務完了後 | `src/lib/cron/review-requests.ts`（新規） |

### 6.2 通知送信ユーティリティ

```typescript
// src/lib/notification-service.ts

interface SendNotificationParams {
  notificationKey: string;
  targetType: 'WORKER' | 'FACILITY' | 'SYSTEM_ADMIN';
  recipientId: number;
  applicationId?: number; // チャット通知用
  variables: Record<string, string>;
}

async function sendNotification(params: SendNotificationParams) {
  // 1. NotificationSettingから設定を取得
  // 2. 有効なチャンネルに対して送信
  // 3. NotificationLogに記録
}
```

---

## 7. 変数リファレンス

| 変数名 | 説明 | 使用例 |
|--------|------|--------|
| `{{worker_name}}` | ワーカー名 | 田中太郎 |
| `{{worker_last_name}}` | ワーカー姓 | 田中 |
| `{{facility_name}}` | 施設名 | 〇〇介護施設 |
| `{{job_title}}` | 求人タイトル | 日勤スタッフ |
| `{{work_date}}` | 勤務日 | 2025年1月15日 |
| `{{start_time}}` | 開始時間 | 9:00 |
| `{{end_time}}` | 終了時間 | 18:00 |
| `{{wage}}` | 日給 | 15,000円 |
| `{{hourly_wage}}` | 時給 | 1,800円 |
| `{{deadline}}` | 締切日時 | 1月10日 17:00 |
| `{{cancel_reason}}` | キャンセル理由 | 体調不良のため |
| `{{review_url}}` | レビュー投稿URL | /mypage/reviews/123 |
| `{{job_url}}` | 求人詳細URL | /jobs/456 |

---

## 8. 実装優先順位

### Phase 1: 基盤
1. DBスキーマ追加（NotificationSetting, NotificationLog）
2. 通知管理画面（/system-admin/content/notifications）
3. 通知確認画面（/system-admin/dev-portal/notification-logs）
4. dev-portalにクイックリンク追加

### Phase 2: 主要通知
1. マッチング成立通知（チャット・メール・プッシュ）
2. キャンセル通知（チャット・メール・プッシュ）
3. 新規応募通知（チャット・メール・プッシュ）

### Phase 3: リマインド・レビュー
1. 勤務前日リマインド
2. 勤務当日リマインド
3. レビュー依頼・催促

### Phase 4: その他
1. お知らせ通知
2. システム管理者アラート
3. お気に入り関連通知
