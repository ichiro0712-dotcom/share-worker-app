# 通知機能 仕様書

> **更新日**: 2025-01-07
> **ステータス**: 実装済み

---

## 1. 概要

+TASTASの通知システムは、3つのチャンネルで構成される：

| チャンネル | 説明 | 実装状況 |
|------------|------|----------|
| チャット通知 | 運営からのシステムメッセージとしてチャットに送信 | ✅ 実装済み |
| メール | 担当者メールアドレスに送信 | ✅ 実装済み |
| Webプッシュ | PWAプッシュ通知 | ✅ 実装済み |

---

## 2. PWA・プッシュ通知

### 2.1 アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        クライアント（PWA）                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ React App   │  │ Service     │  │ iOS Add-to-Home        │  │
│  │ (Next.js)   │  │ Worker      │  │ Guide Component        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        サーバー（Next.js API Routes）            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ /api/push/      │  │ /api/push/      │                       │
│  │ subscribe       │  │ send            │                       │
│  └─────────────────┘  └─────────────────┘                       │
│           │                    │                                │
│           ▼                    ▼                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              web-push (VAPID認証)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    データベース（PostgreSQL/Prisma）             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ push_subscriptions テーブル                              │   │
│  │ - 1ユーザー複数デバイス対応                               │   │
│  │ - endpoint, keys (p256dh, auth)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 技術スタック

| 項目 | 技術 |
|------|------|
| PWA化 | @ducanh2912/next-pwa |
| プッシュ通知 | Web Push API + web-push |
| データベース | PostgreSQL + Prisma |
| 認証方式 | VAPID |

### 2.3 iOS対応

**制約事項:**
- iOS SafariではPWAとしてホーム画面に追加しないとプッシュ通知が使用できない
- iOS 16.4以降でWebプッシュ通知がサポート

**UXフロー:**
1. iOS端末 + ブラウザモードを検出
2. 「ホーム画面に追加してください」ガイドを表示
3. PWA（standaloneモード）で起動した場合のみ通知許可ボタンを表示

---

## 3. 通知一覧

### 3.1 ワーカー向け通知

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

### 3.2 施設向け通知

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

### 3.3 システム管理者向けアラート

| キー | イベント | ダッシュボード | メール |
|------|----------|:--------------:|:------:|
| `ADMIN_NEW_FACILITY` | 新規施設登録（要審査） | ✅ | ✅ |
| `ADMIN_NEW_WORKER` | 新規ワーカー登録 | ✅ | ー |
| `ADMIN_HIGH_CANCEL_RATE` | キャンセル率異常 | ✅ | ✅ |
| `ADMIN_LOW_RATING_STREAK` | 低評価レビュー連続 | ✅ | ✅ |
| `ADMIN_SUSPICIOUS_ACCESS` | 不正アクセス検知 | ✅ | ✅ |

---

## 4. DB設計

### 4.1 PushSubscription（プッシュ購読）

```prisma
model PushSubscription {
  id         Int       @id @default(autoincrement())
  user_id    Int?      @map("user_id")
  admin_id   Int?      @map("admin_id")
  user_type  String    @map("user_type")       // "worker" | "facility_admin"
  endpoint   String    @unique
  p256dh     String
  auth       String
  user_agent String?   @map("user_agent")
  created_at DateTime  @default(now()) @map("created_at")
  updated_at DateTime  @updatedAt @map("updated_at")

  user       User?          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  admin      FacilityAdmin? @relation(fields: [admin_id], references: [id], onDelete: Cascade)

  @@map("push_subscriptions")
}
```

### 4.2 NotificationSetting（通知設定）

```prisma
model NotificationSetting {
  id               Int      @id @default(autoincrement())
  notification_key String   @unique @map("notification_key")
  name             String
  description      String?
  target_type      String   @map("target_type") // "WORKER" | "FACILITY" | "SYSTEM_ADMIN"

  chat_enabled     Boolean  @default(true) @map("chat_enabled")
  email_enabled    Boolean  @default(true) @map("email_enabled")
  push_enabled     Boolean  @default(true) @map("push_enabled")

  chat_message     String?  @db.Text @map("chat_message")
  email_subject    String?  @map("email_subject")
  email_body       String?  @db.Text @map("email_body")
  push_title       String?  @map("push_title")
  push_body        String?  @map("push_body")

  created_at       DateTime @default(now()) @map("created_at")
  updated_at       DateTime @updatedAt @map("updated_at")

  @@map("notification_settings")
}
```

### 4.3 NotificationLog（送信ログ）

```prisma
model NotificationLog {
  id                Int      @id @default(autoincrement())
  notification_key  String   @map("notification_key")
  channel           String   // "CHAT" | "EMAIL" | "PUSH"
  target_type       String   @map("target_type")
  recipient_id      Int      @map("recipient_id")
  recipient_name    String?  @map("recipient_name")
  recipient_email   String?  @map("recipient_email")
  from_address      String?  @map("from_address")
  to_addresses      String[] @default([]) @map("to_addresses")
  subject           String?
  body              String?  @db.Text
  chat_application_id Int?   @map("chat_application_id")
  chat_message      String?  @db.Text @map("chat_message")
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

## 5. 管理画面

### 5.1 通知管理（/system-admin/content/notifications）

- タブ: ワーカー向け / 施設向け / システム管理者向け
- 各通知のチャンネル別ON/OFF切り替え
- テンプレート編集（変数対応）

### 5.2 通知確認（/system-admin/dev-portal/notification-logs）

- 送信された通知をメールボックス形式で確認
- フィルター: チャンネル別、日付範囲
- 詳細表示: 送信内容、宛先、ステータス

---

## 6. テンプレート変数

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

## 7. API設計

### POST /api/push/subscribe
プッシュ通知の購読を登録

```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": { "p256dh": "...", "auth": "..." }
  },
  "userType": "worker" | "facility_admin"
}
```

### POST /api/push/unsubscribe
プッシュ通知の購読を解除

### POST /api/push/send（内部API）
通知を送信

```json
{
  "userId": 1,
  "userType": "worker",
  "title": "新しい求人があります",
  "body": "あなたにぴったりの求人が見つかりました",
  "url": "/jobs/123"
}
```

---

## 8. 環境変数

```env
# VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxxxx
VAPID_PRIVATE_KEY=xxxxx
VAPID_SUBJECT=mailto:support@tastas.jp
```

---

## 9. 関連ファイル

```
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── app/api/push/
│   ├── subscribe/route.ts
│   ├── unsubscribe/route.ts
│   └── send/route.ts
├── components/pwa/
│   ├── InstallPrompt.tsx
│   ├── IOSInstallGuide.tsx
│   └── NotificationButton.tsx
└── lib/
    └── push-notification.ts
```
