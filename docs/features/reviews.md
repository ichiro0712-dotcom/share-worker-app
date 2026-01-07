# レビュー機能 仕様書

> **更新日**: 2025-01-07
> **ステータス**: 実装済み

---

## 1. 概要

勤務完了後にワーカーと施設が相互にレビューを投稿できる機能。

### 主要機能

| 機能 | 説明 | 実装状況 |
|------|------|----------|
| ワーカーレビュー | 施設→ワーカーの評価 | ✅ 実装済み |
| 施設レビュー | ワーカー→施設の評価 | ✅ 実装済み |
| 評価項目 | 複数項目での詳細評価 | ✅ 実装済み |
| レビューテンプレート | 施設の定型文管理 | ✅ 実装済み |
| レビュー依頼通知 | 勤務後の投稿依頼 | ✅ 実装済み |

---

## 2. レビュータイプ

| タイプ | 投稿者 | 対象 |
|--------|--------|------|
| `FACILITY` | 施設 | ワーカー |
| `WORKER` | ワーカー | 施設 |

---

## 3. 評価項目

### 3.1 施設→ワーカー評価

| 項目 | フィールド | 説明 |
|------|------------|------|
| 総合評価 | `rating` | 1〜5の総合評価 |
| 出勤・時間厳守 | `rating_attendance` | 時間を守れたか |
| スキル・技術 | `rating_skill` | 業務スキル |
| 業務遂行力 | `rating_execution` | 指示通りに業務をこなせたか |
| コミュニケーション | `rating_communication` | 報連相ができたか |
| 勤務態度 | `rating_attitude` | 積極性・姿勢 |

### 3.2 ワーカー→施設評価

| 項目 | フィールド | 説明 |
|------|------------|------|
| 総合評価 | `rating` | 1〜5の総合評価 |
| 良かった点 | `good_points` | 自由記述 |
| 改善点 | `improvements` | 自由記述 |

---

## 4. レビューフロー

### 4.1 ワーカーのレビュー投稿

```
勤務完了（COMPLETED）
    ↓
レビュー依頼通知
    ↓
マイページ → レビュー管理 → 投稿
    ↓
施設に通知
```

### 4.2 施設のレビュー投稿

```
勤務完了（COMPLETED）
    ↓
レビュー依頼通知
    ↓
ワーカー詳細 → レビュー投稿
    ↓
ワーカーに通知
```

---

## 5. レビューステータス

| ステータス | 説明 |
|------------|------|
| `PENDING` | 未投稿 |
| `SUBMITTED` | 投稿済み |
| `SKIPPED` | スキップ |

### Applicationとの連携

```prisma
model Application {
  worker_review_status   ReviewStatus @default(PENDING)   // 施設→ワーカー
  facility_review_status ReviewStatus @default(PENDING)  // ワーカー→施設
}
```

---

## 6. データモデル

### 6.1 Review

```prisma
model Review {
  id                   Int          @id @default(autoincrement())
  facility_id          Int
  user_id              Int
  job_id               Int
  work_date_id         Int?
  application_id       Int?
  reviewer_type        ReviewerType // FACILITY | WORKER
  rating               Int          // 1-5
  rating_attendance    Int?         // 1-5（施設→ワーカーのみ）
  rating_skill         Int?         // 1-5
  rating_execution     Int?         // 1-5
  rating_communication Int?         // 1-5
  rating_attitude      Int?         // 1-5
  good_points          String?      // 良かった点
  improvements         String?      // 改善点
  created_at           DateTime
  updated_at           DateTime

  @@unique([job_id, user_id, reviewer_type])
}
```

### 6.2 ReviewTemplate

```prisma
model ReviewTemplate {
  id          Int      @id @default(autoincrement())
  facility_id Int
  name        String
  content     String
  created_at  DateTime
  updated_at  DateTime
}
```

---

## 7. 画面構成

### 7.1 ワーカー側

| 画面 | パス | 説明 |
|------|------|------|
| レビュー管理 | `/mypage/reviews` | 投稿・受信レビュー一覧 |
| レビュー投稿 | `/mypage/reviews/[applicationId]` | 施設へのレビュー投稿 |
| 受け取ったレビュー | `/mypage/reviews/received` | 施設からのレビュー閲覧 |

### 7.2 施設管理者側

| 画面 | パス | 説明 |
|------|------|------|
| レビュー一覧 | `/admin/reviews` | 投稿済みレビュー一覧 |
| ワーカーレビュー | `/admin/worker-reviews` | 受け取ったレビュー一覧 |
| レビュー投稿 | `/admin/workers/[id]/review` | ワーカーへのレビュー投稿 |

---

## 8. レビューテンプレート

施設管理者が定型文を登録して、レビュー投稿時に利用できる。

### 使用例

```
テンプレート名: 優秀スタッフ
内容: とても丁寧な対応で、入居者様からも好評でした。
      また是非お願いしたいと思います。
```

---

## 9. 通知

| 通知キー | タイミング | 対象 |
|----------|------------|------|
| `WORKER_REVIEW_REQUEST` | 勤務終了後 | ワーカー |
| `FACILITY_REVIEW_REQUEST` | 勤務終了後 | 施設 |
| `WORKER_REVIEW_REMINDER` | 未投稿時リマインド | ワーカー |
| `WORKER_REVIEW_RECEIVED` | レビュー受信時 | ワーカー |
| `FACILITY_REVIEW_RECEIVED` | レビュー受信時 | 施設 |

---

## 10. ビジネスルール

### 10.1 投稿条件

- 勤務が `COMPLETED` ステータスである
- 同じ勤務に対して重複投稿不可
- 投稿後の編集は不可（削除して再投稿）

### 10.2 表示ルール

- 自分が投稿したレビューは常に閲覧可能
- 自分宛のレビューは常に閲覧可能
- 他ユーザーのレビューは平均評価のみ表示

---

## 11. 関連機能

- [求人マッチング](./job-matching.md) - 勤務完了後にレビュー
- [通知機能](./notifications.md) - レビュー依頼・受信通知
