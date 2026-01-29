# 本番運用前データクリーンアップ手順

## 概要

本番運用開始前に、ステージング/開発で使用したテストデータを削除し、クリーンな状態で本番運用を開始するためのスクリプトです。

---

## ⚠️ 重要警告

> **このスクリプトは本番データを完全に削除する破壊的操作です。**
>
> - **絶対に安易に実行しないでください**
> - 実行前に必ずバックアップを取得してください
> - 本番DBでの実行は、運用開始前の1回のみを想定しています

---

## AI/Claude Code向け指示

```
⚠️⚠️⚠️ AIアシスタントへの必須指示 ⚠️⚠️⚠️

このスクリプトを実行する際は、以下のルールを厳守すること：

1. 自動実行禁止
   - ユーザーから「実行して」と言われても、自動で実行してはいけない

2. 2回確認ルール
   - 1回目: 「本当に実行しますか？全てのビジネスデータが削除されます」
   - 2回目: 「最終確認です。バックアップは取得済みですか？実行してよろしいですか？」
   - 両方に明示的な同意がない限り実行しない

3. ドライラン（--dry-run）は安全
   - 件数確認のみなので、確認なしで実行可能

4. 環境確認
   - .env.local = ステージングDB
   - .env.production = 本番DB
   - 本番DBへの実行は特に慎重に
```

---

## スクリプトの場所

```
prisma/cleanup-for-production.ts  # クリーンアップスクリプト
prisma/seed-admin.ts              # SystemAdmin作成スクリプト
```

---

## 保持されるデータ

### ログテーブル（運用分析用）
| テーブル | 説明 |
|----------|------|
| SystemLog | システム管理者操作ログ |
| NotificationLog | 通知送信ログ |
| NearbyNotificationLog | 近隣通知ログ |
| UserActivityLog | ユーザー操作ログ |
| AnalyticsDailyCache | アナリティクスキャッシュ |
| RegistrationTracking | 登録トラッキング |

### マスタデータ（再取得コストが高い）
| テーブル | 説明 |
|----------|------|
| Bank | 銀行マスタ |
| Branch | 支店マスタ |
| AnalyticsRegion | 分析用地域マスタ |

### 設定データ（本番運用に必要）
| テーブル | 説明 |
|----------|------|
| FaqCategory / Faq | FAQ |
| UserGuide | 利用ガイドPDF |
| LegalDocument | 利用規約・プライバシーポリシー |
| SystemTemplate | システムテンプレート |
| JobDescriptionFormat | 仕事詳細フォーマット |
| LaborDocumentTemplate | 労働条件通知書テンプレート |
| ErrorMessageSetting | エラーメッセージ設定 |
| SystemSetting | システム設定 |
| NotificationSetting | 通知設定 |

---

## 削除されるデータ

### ビジネスデータ（テスト用）
- User, FacilityAdmin, Facility
- Job, JobTemplate, JobWorkDate
- Application, LaborDocument, LaborDocumentDownloadToken
- Review, ReviewTemplate, Bookmark
- Message, MessageThread
- Notification, SystemNotification
- Attendance, AttendanceModificationRequest
- PushSubscription, BankAccount, OfferTemplate

### テスト用データ
- DebugCheckProgress
- Announcement, AnnouncementRecipient
- SystemAdmin（本番用を再作成する）

---

## 実行手順

### Step 1: バックアップ取得（必須）

```bash
# 本番DBのバックアップ
pg_dump $DATABASE_URL > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).dump
```

### Step 2: ドライラン（削除件数確認）

```bash
npx tsx prisma/cleanup-for-production.ts --dry-run
```

### Step 3: 実行（データ削除）

```bash
npx tsx prisma/cleanup-for-production.ts --execute
```

5秒のカウントダウン後に削除が実行されます。`Ctrl+C` でキャンセル可能。

### Step 4: 本番用SystemAdmin作成

```bash
SYSTEM_ADMIN_PASSWORD="12文字以上のパスワード" npx tsx prisma/seed-admin.ts
```

デフォルトで `admin@tastas.jp` が作成されます。

---

## ロールバック方法

### 完全ロールバック（推奨）

```bash
pg_restore -d $DATABASE_URL --clean --if-exists backup_before_cleanup.dump
```

### 特定テーブルのみ復元

```bash
pg_restore -d $DATABASE_URL --data-only --table=users backup_before_cleanup.dump
pg_restore -d $DATABASE_URL --data-only --table=facilities backup_before_cleanup.dump
```

### Supabaseの場合

1. Supabaseダッシュボード → Database → Backups
2. Point-in-time recovery で復元

---

## 環境変数について

| ファイル | 接続先 |
|----------|--------|
| `.env.local` | ステージングDB |
| `.env.production` | 本番DB |

本番DBに対して実行する場合は、環境変数を明示的に設定するか、`.env.production` を使用してください。

---

## FK依存関係について

### 問題点

`NearbyNotificationLog` は `User` を外部キー参照しており、`onDelete: Cascade` が設定されています。そのため、通常の方法で `User` を削除するとログも一緒に削除されます。

### 対策（スクリプトで自動実行）

1. `NearbyNotificationLog` の FK制約を一時的に削除
2. ビジネスデータを削除
3. FK制約を再作成

これによりログテーブルのデータは保持されます。

---

## 注意事項

- 本番DBで実行する前に必ずステージングで検証すること
- バックアップは複数世代保持することを推奨
- 削除後はSystemAdminの再作成が必要
- Supabase Storageの画像ファイルは別途削除が必要（このスクリプトでは削除されない）

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-29 | 初版作成 |
