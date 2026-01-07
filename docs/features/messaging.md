# メッセージ機能 仕様書

> **更新日**: 2025-01-07
> **ステータス**: 実装済み

---

## 1. 概要

ワーカーと施設間のコミュニケーション機能。応募に紐づくチャット形式のメッセージング。

### 主要機能

| 機能 | 説明 | 実装状況 |
|------|------|----------|
| 応募チャット | 応募ごとにチャットルーム作成 | ✅ 実装済み |
| 運営メッセージ | システムからの自動通知メッセージ | ✅ 実装済み |
| 画像添付 | 画像ファイルの送受信 | ✅ 実装済み |
| 既読管理 | メッセージの既読状態管理 | ✅ 実装済み |
| リアルタイム更新 | ポーリングによる自動更新 | ✅ 実装済み |

---

## 2. 画面構成

### 2.1 ワーカー側

**メッセージ一覧（/messages）**
- 施設ごとにグループ化された会話一覧
- 未読バッジ表示
- 最新メッセージのプレビュー
- タブ切り替え: メッセージ / お知らせ

**チャット画面（/messages?facilityId=xxx）**
- 選択した施設とのチャット
- メッセージ送信フォーム
- 画像添付機能
- 運営メッセージの表示（システム通知）

### 2.2 施設管理者側

**メッセージ一覧（/admin/messages）**
- ワーカーごとにグループ化された会話一覧
- 未読バッジ表示
- 求人タイトル・応募日時表示

**チャット画面**
- 選択したワーカーとのチャット
- メッセージ送信フォーム
- 画像添付機能

---

## 3. データモデル

### 3.1 Message

```prisma
model Message {
  id               Int         @id @default(autoincrement())
  from_user_id     Int?        // 送信元ワーカー
  to_user_id       Int?        // 送信先ワーカー
  from_facility_id Int?        // 送信元施設
  to_facility_id   Int?        // 送信先施設
  application_id   Int?        // 関連する応募
  job_id           Int?        // 関連する求人
  thread_id        Int?        // メッセージスレッドID
  content          String      // メッセージ本文
  image_url        String?     // 画像URL
  read_at          DateTime?   // 既読日時
  created_at       DateTime    @default(now())

  @@map("messages")
}
```

### 3.2 MessageThread

```prisma
model MessageThread {
  id              Int       @id @default(autoincrement())
  worker_id       Int
  facility_id     Int
  last_message_at DateTime?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  worker          User      @relation(...)
  facility        Facility  @relation(...)
  messages        Message[]

  @@unique([worker_id, facility_id])
  @@map("message_threads")
}
```

---

## 4. メッセージの種類

### 4.1 ユーザー間メッセージ

通常のチャットメッセージ。

```typescript
// ワーカー → 施設
{
  from_user_id: userId,
  to_facility_id: facilityId,
  application_id: applicationId,
  content: "..."
}

// 施設 → ワーカー
{
  from_facility_id: facilityId,
  to_user_id: userId,
  application_id: applicationId,
  content: "..."
}
```

### 4.2 運営メッセージ（システム通知）

`from_user_id` と `from_facility_id` の両方が `null` の場合、運営からのシステムメッセージとして扱う。

```typescript
// 運営メッセージ
{
  from_user_id: null,
  from_facility_id: null,
  to_user_id: userId,
  application_id: applicationId,
  content: "マッチングが成立しました！"
}
```

**表示スタイル:**
- 運営アイコン表示
- 「運営」ラベル表示
- グレー背景で視覚的に区別

---

## 5. API設計

### 5.1 メッセージ取得

**getGroupedConversations()**
- ワーカー: 施設ごとにグループ化された会話一覧
- 施設管理者: ワーカーごとにグループ化された会話一覧

**getConversationMessages(applicationId, facilityId)**
- 特定の会話のメッセージ一覧

### 5.2 メッセージ送信

**sendMessage(params)**
```typescript
interface SendMessageParams {
  applicationId?: number;
  content: string;
  imageUrl?: string;
  recipientUserId?: number;    // ワーカー宛
  recipientFacilityId?: number; // 施設宛
}
```

### 5.3 既読更新

**markMessagesAsRead(applicationId, facilityId)**
- 指定された会話のメッセージを既読に更新

---

## 6. 画像添付

### 6.1 アップロードフロー

1. ユーザーが画像を選択
2. クライアントでリサイズ・圧縮（必要に応じて）
3. S3にアップロード
4. 画像URLをメッセージに添付して送信

### 6.2 制限事項

| 項目 | 制限値 |
|------|--------|
| ファイルサイズ | 最大20MB |
| ファイル形式 | JPEG, PNG, GIF, WebP |

---

## 7. 既読管理

### 7.1 既読タイミング

- チャット画面を開いた時
- メッセージ一覧で会話を選択した時

### 7.2 既読状態の表示

| 状態 | 表示 |
|------|------|
| 未読 | バッジ表示、太字 |
| 既読 | 通常表示 |

---

## 8. リアルタイム更新

### 8.1 ポーリング

- 間隔: 10秒
- チャット画面表示中のみ有効
- 新着メッセージがあれば自動追加

### 8.2 将来的な改善案

- WebSocket導入
- Server-Sent Events（SSE）

---

## 9. 関連ファイル

```
app/
├── messages/
│   ├── page.tsx              # ワーカー向けメッセージページ
│   ├── MessagesContent.tsx   # メッセージコンテンツ
│   ├── MessagesClient.tsx    # クライアントロジック
│   └── MessagesTabs.tsx      # タブコンポーネント
└── admin/messages/
    └── page.tsx              # 施設管理者向けメッセージページ

lib/
└── actions.ts                # メッセージ関連Server Actions
```

---

## 10. 関連機能

- [通知機能](./notifications.md) - 新着メッセージ通知
- [応募管理](./job-matching.md) - 応募に紐づくチャット
