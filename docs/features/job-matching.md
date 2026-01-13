# 求人マッチング機能 仕様書

> **更新日**: 2025-01-07
> **ステータス**: 実装済み

---

## 1. 概要

ワーカーと求人のマッチングを管理するコア機能。

### 主要機能

| 機能 | 説明 | 実装状況 |
|------|------|----------|
| 求人検索 | 条件に基づく求人検索 | ✅ 実装済み |
| 求人応募 | ワーカーからの応募 | ✅ 実装済み |
| 即時マッチング | 応募即マッチング成立 | ✅ 実装済み |
| 審査マッチング | 施設が手動で承認 | ✅ 実装済み |
| キャンセル | 双方からのキャンセル | ✅ 実装済み |
| 勤務管理 | 勤務状況の管理 | ✅ 実装済み |

---

## 2. 求人種別（JobType）

| 種別 | 説明 | 対象者 |
|------|------|--------|
| `NORMAL` | 通常求人 | 全ワーカー |
| `ORIENTATION` | 見学・研修 | 全ワーカー |
| `LIMITED_WORKED` | 勤務実績あり限定 | 施設で勤務経験のあるワーカー |
| `LIMITED_FAVORITE` | お気に入り登録者限定 | 施設をお気に入り登録中のワーカー |
| `OFFER` | オファー求人 | 特定ワーカー指名 |

### 限定求人の自動切り替え

- `switch_to_normal_days_before`: 勤務開始日のN日前に通常求人に切り替え
- 設定例: 3日前に切り替え → 応募がなければ全ワーカーに公開

---

## 3. 応募ステータス（WorkerStatus）

```
APPLIED → MATCHED → WORKING → COMPLETED
   ↓         ↓
REJECTED  CANCELLED
```

| ステータス | 説明 | 遷移元 |
|------------|------|--------|
| `APPLIED` | 応募中（審査待ち） | - |
| `MATCHED` | マッチング成立 | APPLIED |
| `WORKING` | 勤務中 | MATCHED |
| `COMPLETED` | 勤務完了 | WORKING |
| `REJECTED` | 不採用 | APPLIED |
| `CANCELLED` | キャンセル | APPLIED, MATCHED |

---

## 4. マッチングフロー

### 4.1 即時マッチング（requires_interview = false）

```
ワーカー応募
    ↓
自動的にMATCHED
    ↓
通知送信（ワーカー・施設双方）
```

### 4.2 審査マッチング（requires_interview = true）

```
ワーカー応募（APPLIED）
    ↓
施設が応募を確認
    ↓
承認: MATCHED / 不採用: REJECTED
    ↓
通知送信
```

---

## 5. 募集管理

### 5.1 募集枠

- `recruitment_count`: 募集人数
- `applied_count`: 応募数
- `matched_count`: マッチング成立数

### 5.2 募集期間

| 設定項目 | 説明 |
|----------|------|
| `deadline` | 応募締切日時 |
| `deadline_days_before` | 勤務日のN日前を締切 |
| `recruitment_start_day` | 募集開始日（0=公開時、-N=勤務N日前） |
| `recruitment_start_time` | 募集開始時刻 |
| `visible_from` | 表示開始日時 |
| `visible_until` | 表示終了日時 |

---

## 6. 求人検索

### 6.1 検索条件

| 条件 | 説明 |
|------|------|
| キーワード | タイトル・施設名で検索 |
| 勤務日 | 日付範囲指定 |
| 時間帯 | 開始・終了時間 |
| 報酬 | 最低日給・時給 |
| エリア | 都道府県・市区町村 |
| 資格 | 必要資格 |
| 特徴タグ | 未経験OK、車通勤OKなど |

### 6.2 表示ルール

- ステータスが `PUBLISHED` の求人のみ表示
- `visible_from` 以降かつ `visible_until` 以前
- 募集枠に空きがある（matched_count < recruitment_count）
- 限定求人は対象ワーカーのみ表示

---

## 7. キャンセル

### 7.1 ワーカーキャンセル

- `APPLIED` または `MATCHED` 状態でキャンセル可能
- `cancelled_by: WORKER` として記録
- 施設に通知送信

### 7.2 施設キャンセル

- `MATCHED` 状態でキャンセル可能
- `cancelled_by: FACILITY` として記録
- ワーカーに通知送信
- `cancel_notified_at` で既読管理

---

## 8. データモデル

### 8.1 Job（求人）

```prisma
model Job {
  id                    Int       @id @default(autoincrement())
  facility_id           Int
  status                JobStatus @default(DRAFT)
  job_type              JobType   @default(NORMAL)
  title                 String
  start_time            String    // "09:00"
  end_time              String    // "18:00"
  break_time            String    // "60"分
  wage                  Int       // 日給
  hourly_wage           Int       // 時給
  recruitment_count     Int       // 募集人数
  requires_interview    Boolean   @default(false)
  // ... 他のフィールド
}
```

### 8.2 JobWorkDate（求人日程）

```prisma
model JobWorkDate {
  id                Int      @id @default(autoincrement())
  job_id            Int
  work_date         DateTime // 勤務日
  deadline          DateTime // 応募締切
  recruitment_count Int      // 募集人数
  applied_count     Int      @default(0)
  matched_count     Int      @default(0)
  visible_from      DateTime? // 表示開始
  visible_until     DateTime? // 表示終了
}
```

### 8.3 Application（応募）

```prisma
model Application {
  id                Int          @id @default(autoincrement())
  work_date_id      Int
  user_id           Int
  status            WorkerStatus @default(APPLIED)
  message           String?
  cancelled_by      CancelledBy?
  cancelled_at      DateTime?
  // ... 他のフィールド
}
```

---

## 9. 画面構成

### 9.1 ワーカー側

| 画面 | パス | 説明 |
|------|------|------|
| 求人一覧 | `/` | トップページ・検索 |
| 求人詳細 | `/jobs/[id]` | 求人詳細・応募 |
| マイジョブ | `/my-jobs` | 応募・勤務管理 |
| 勤務詳細 | `/my-jobs/[id]` | 勤務詳細・キャンセル |

### 9.2 施設管理者側

| 画面 | パス | 説明 |
|------|------|------|
| 求人一覧 | `/admin/jobs` | 求人管理 |
| 求人作成 | `/admin/jobs/new` | 新規求人作成 |
| 求人詳細 | `/admin/jobs/[id]` | 求人詳細・編集 |
| 応募者管理 | `/admin/applications` | 応募者一覧・審査 |

---

## 10. 関連機能

- [メッセージ機能](./messaging.md) - 応募に紐づくチャット
- [通知機能](./notifications.md) - マッチング通知
- [レビュー機能](./reviews.md) - 勤務後のレビュー
- [オファー・限定求人](./offer-limited-job.md) - 特殊求人タイプ
