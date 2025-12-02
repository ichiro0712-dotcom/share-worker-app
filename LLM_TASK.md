# レビューシステム改修指示書

## 概要

レビュー機能を「勤務日単位」から「求人×ワーカー単位」に変更する。

### 用語定義

- **ワーカーレビュー**: 施設がワーカーを評価する（施設→ワーカー）
- **施設レビュー**: ワーカーが施設を評価する（ワーカー→施設）
- **その求人の勤務日**: ある求人において、該当ワーカーが初めてマッチした仕事日から最後にマッチした仕事日までの期間

### 要件

#### 共通ルール
1. その求人に複数の日付がある場合、ワーカーが初めてマッチした仕事日から最後にマッチした仕事日までを「その求人の勤務日」とする
2. その求人の勤務日の中で1回のみ入力できる
3. その求人の勤務日の初日（最初にマッチした仕事の日）から入力できるようになる
4. レビュー入力が完了したら入力できなくなる

#### ワーカーレビュー（施設→ワーカー）
- 施設管理画面のダッシュボードと、ワーカーレビューページに表示
- リンクをクリックすると入力できる
- その求人の勤務日の最後にマッチした仕事日を過ぎてもレビューが登録されていない場合、目立つように表示

#### 施設レビュー（ワーカー→施設）
- 仕事管理の勤務中の求人に「施設レビュー」ボタンが現れる
- その求人の勤務日の最後にマッチした仕事日を過ぎてもレビューが登録されていない場合、全画面の上部に「レビューを入力してください」と表示

---

## 作業内容

### Phase 1: DBスキーマ変更

#### 1-1. Reviewモデルの修正

ファイル: `prisma/schema.prisma`

```prisma
model Review {
  id              Int          @id @default(autoincrement())
  facility_id     Int          @map("facility_id")
  user_id         Int          @map("user_id")
  job_id          Int          @map("job_id")          // NEW: 求人への参照（work_date_idから変更）
  reviewer_type   ReviewerType @map("reviewer_type")
  rating          Int
  rating_attendance   Int?  @map("rating_attendance")
  rating_skill        Int?  @map("rating_skill")
  rating_execution    Int?  @map("rating_execution")
  rating_communication Int? @map("rating_communication")
  rating_attitude     Int?  @map("rating_attitude")
  good_points     String?      @db.Text @map("good_points")
  improvements    String?      @db.Text
  created_at      DateTime     @default(now()) @map("created_at")
  updated_at      DateTime     @updatedAt @map("updated_at")

  // リレーション
  facility    Facility    @relation(fields: [facility_id], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  job         Job         @relation(fields: [job_id], references: [id], onDelete: Cascade)

  // ユニーク制約: 同じ求人×ワーカー×レビュアータイプで1件のみ
  @@unique([job_id, user_id, reviewer_type])
  @@map("reviews")
}
```

#### 1-2. Jobモデルにリレーション追加

```prisma
model Job {
  // ... 既存フィールド ...

  // リレーション
  reviews      Review[]     // NEW: 追加

  // ... 既存リレーション ...
}
```

#### 1-3. JobWorkDateからreviewsリレーションを削除

```prisma
model JobWorkDate {
  // ... 既存フィールド ...

  // リレーション
  job          Job           @relation(fields: [job_id], references: [id], onDelete: Cascade)
  applications Application[]
  // reviews      Review[]   ← 削除

  // ... 既存 ...
}
```

#### 1-4. Applicationモデルの修正

レビューステータスを求人単位で管理するため、以下のように変更を検討。
ただし、複数のApplicationが同じ求人×ワーカーに対して存在しうるため、レビューステータスは別テーブルで管理するか、Reviewテーブルの存在チェックで判断する。

**推奨**: Applicationからreview_status系フィールドを削除し、Reviewテーブルの存在でステータスを判断する。

```prisma
model Application {
  id                     Int          @id @default(autoincrement())
  work_date_id           Int          @map("work_date_id")
  user_id                Int          @map("user_id")
  status                 WorkerStatus @default(APPLIED)
  // worker_review_status   ReviewStatus @default(PENDING) ← 削除検討
  // facility_review_status ReviewStatus @default(PENDING) ← 削除検討
  message                String?      @db.Text
  created_at             DateTime     @default(now()) @map("created_at")
  updated_at             DateTime     @updatedAt @map("updated_at")

  // リレーション
  workDate JobWorkDate @relation(fields: [work_date_id], references: [id], onDelete: Cascade)
  user     User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  // reviews  Review[]  ← 削除

  @@unique([work_date_id, user_id])
  @@map("applications")
}
```

### Phase 2: マイグレーション実行

```bash
# 1. バックアップを取る（本番環境の場合）
# 2. マイグレーションファイル作成
npx prisma migrate dev --name review_per_job

# 3. 必要に応じてデータ移行スクリプトを実行（既存レビューがある場合）
```

**データ移行スクリプト例** (既存のwork_date_id -> job_idへの変換):

```typescript
// scripts/migrate-reviews.ts
import { prisma } from '@/src/lib/prisma';

async function migrateReviews() {
  const reviews = await prisma.review.findMany({
    include: {
      workDate: {
        include: {
          job: true,
        },
      },
    },
  });

  for (const review of reviews) {
    // job_idを設定（work_date_idから取得）
    await prisma.review.update({
      where: { id: review.id },
      data: {
        job_id: review.workDate.job_id,
      },
    });
  }
}
```

---

### Phase 3: ヘルパー関数作成

ファイル: `src/lib/review-helpers.ts`（新規作成）

```typescript
import { prisma } from './prisma';

/**
 * ワーカーの「その求人の勤務日」情報を取得
 * @returns {firstWorkDate, lastWorkDate, canReview, hasReviewed}
 */
export async function getWorkerJobReviewInfo(
  jobId: number,
  userId: number,
  reviewerType: 'WORKER' | 'FACILITY'
) {
  // そのワーカーのこの求人へのマッチ済み応募を取得
  const applications = await prisma.application.findMany({
    where: {
      user_id: userId,
      workDate: {
        job_id: jobId,
      },
      status: {
        in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
      },
    },
    include: {
      workDate: true,
    },
    orderBy: {
      workDate: {
        work_date: 'asc',
      },
    },
  });

  if (applications.length === 0) {
    return {
      firstWorkDate: null,
      lastWorkDate: null,
      canReview: false,
      hasReviewed: false,
      isOverdue: false,
    };
  }

  const firstWorkDate = applications[0].workDate.work_date;
  const lastWorkDate = applications[applications.length - 1].workDate.work_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // レビュー済みかチェック
  const existingReview = await prisma.review.findUnique({
    where: {
      job_id_user_id_reviewer_type: {
        job_id: jobId,
        user_id: userId,
        reviewer_type: reviewerType,
      },
    },
  });

  const hasReviewed = !!existingReview;

  // 初日以降かつ未レビューならレビュー可能
  const canReview = !hasReviewed && today >= firstWorkDate;

  // 最終日を過ぎて未レビューなら督促対象
  const isOverdue = !hasReviewed && today > lastWorkDate;

  return {
    firstWorkDate,
    lastWorkDate,
    canReview,
    hasReviewed,
    isOverdue,
  };
}

/**
 * 施設の未レビューワーカー一覧を取得
 */
export async function getPendingWorkerReviews(facilityId: number) {
  // マッチ済みのApplicationを持つJob×Userの組み合わせを取得
  const jobs = await prisma.job.findMany({
    where: {
      facility_id: facilityId,
    },
    include: {
      workDates: {
        include: {
          applications: {
            where: {
              status: {
                in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
              },
            },
            include: {
              user: true,
            },
          },
        },
      },
      reviews: {
        where: {
          reviewer_type: 'FACILITY',
        },
      },
    },
  });

  const pendingReviews: Array<{
    jobId: number;
    jobTitle: string;
    userId: number;
    userName: string;
    userProfileImage: string | null;
    firstWorkDate: Date;
    lastWorkDate: Date;
    isOverdue: boolean;
  }> = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const job of jobs) {
    // Job内のユニークなユーザーを取得
    const userMap = new Map<number, {
      user: any;
      workDates: Date[];
    }>();

    for (const workDate of job.workDates) {
      for (const app of workDate.applications) {
        if (!userMap.has(app.user_id)) {
          userMap.set(app.user_id, {
            user: app.user,
            workDates: [],
          });
        }
        userMap.get(app.user_id)!.workDates.push(workDate.work_date);
      }
    }

    // 既にレビュー済みのユーザーを除外
    const reviewedUserIds = new Set(job.reviews.map(r => r.user_id));

    for (const [userId, data] of userMap) {
      if (reviewedUserIds.has(userId)) continue;

      data.workDates.sort((a, b) => a.getTime() - b.getTime());
      const firstWorkDate = data.workDates[0];
      const lastWorkDate = data.workDates[data.workDates.length - 1];

      // 初日以降のみ表示
      if (today < firstWorkDate) continue;

      pendingReviews.push({
        jobId: job.id,
        jobTitle: job.title,
        userId,
        userName: data.user.name,
        userProfileImage: data.user.profile_image,
        firstWorkDate,
        lastWorkDate,
        isOverdue: today > lastWorkDate,
      });
    }
  }

  // 督促対象を優先、その後は最終勤務日順
  return pendingReviews.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.lastWorkDate.getTime() - b.lastWorkDate.getTime();
  });
}

/**
 * ワーカーの未レビュー施設一覧を取得
 */
export async function getPendingFacilityReviews(userId: number) {
  const applications = await prisma.application.findMany({
    where: {
      user_id: userId,
      status: {
        in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
      },
    },
    include: {
      workDate: {
        include: {
          job: {
            include: {
              facility: true,
              reviews: {
                where: {
                  user_id: userId,
                  reviewer_type: 'WORKER',
                },
              },
            },
          },
        },
      },
    },
  });

  // Job単位でグループ化
  const jobMap = new Map<number, {
    job: any;
    facility: any;
    workDates: Date[];
    hasReviewed: boolean;
  }>();

  for (const app of applications) {
    const job = app.workDate.job;
    if (!jobMap.has(job.id)) {
      jobMap.set(job.id, {
        job,
        facility: job.facility,
        workDates: [],
        hasReviewed: job.reviews.length > 0,
      });
    }
    jobMap.get(job.id)!.workDates.push(app.workDate.work_date);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingReviews: Array<{
    jobId: number;
    jobTitle: string;
    facilityId: number;
    facilityName: string;
    firstWorkDate: Date;
    lastWorkDate: Date;
    canReview: boolean;
    isOverdue: boolean;
  }> = [];

  for (const [jobId, data] of jobMap) {
    if (data.hasReviewed) continue;

    data.workDates.sort((a, b) => a.getTime() - b.getTime());
    const firstWorkDate = data.workDates[0];
    const lastWorkDate = data.workDates[data.workDates.length - 1];

    const canReview = today >= firstWorkDate;
    const isOverdue = today > lastWorkDate;

    pendingReviews.push({
      jobId,
      jobTitle: data.job.title,
      facilityId: data.facility.id,
      facilityName: data.facility.facility_name,
      firstWorkDate,
      lastWorkDate,
      canReview,
      isOverdue,
    });
  }

  return pendingReviews;
}

/**
 * 督促が必要な施設レビューがあるかチェック（全画面バナー用）
 */
export async function hasOverdueFacilityReview(userId: number): Promise<boolean> {
  const pendingReviews = await getPendingFacilityReviews(userId);
  return pendingReviews.some(r => r.isOverdue);
}
```

---

### Phase 4: API関数の修正

ファイル: `src/lib/actions.ts`

#### 4-1. submitReview関数の修正

```typescript
/**
 * 施設レビューを投稿（ワーカー→施設）
 */
export async function submitFacilityReview(
  jobId: number,
  rating: number,
  goodPoints: string,
  improvements: string
) {
  try {
    const user = await getAuthenticatedUser();

    // そのワーカーのその求人へのマッチ確認
    const applications = await prisma.application.findMany({
      where: {
        user_id: user.id,
        workDate: {
          job_id: jobId,
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
      include: {
        workDate: {
          include: {
            job: {
              include: {
                facility: true,
              },
            },
          },
        },
      },
      orderBy: {
        workDate: {
          work_date: 'asc',
        },
      },
    });

    if (applications.length === 0) {
      return { success: false, error: 'この求人への勤務実績がありません' };
    }

    const job = applications[0].workDate.job;
    const firstWorkDate = applications[0].workDate.work_date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 初日以降かチェック
    if (today < firstWorkDate) {
      return { success: false, error: '勤務開始前はレビューできません' };
    }

    // 既存レビューチェック
    const existingReview = await prisma.review.findUnique({
      where: {
        job_id_user_id_reviewer_type: {
          job_id: jobId,
          user_id: user.id,
          reviewer_type: 'WORKER',
        },
      },
    });

    if (existingReview) {
      return { success: false, error: '既にレビュー済みです' };
    }

    // レビュー作成
    await prisma.review.create({
      data: {
        facility_id: job.facility_id,
        user_id: user.id,
        job_id: jobId,
        reviewer_type: 'WORKER',
        rating,
        good_points: goodPoints.trim(),
        improvements: improvements.trim(),
      },
    });

    // 施設の評価を再計算
    // ... 既存の処理 ...

    return { success: true, message: 'レビューを投稿しました' };
  } catch (error) {
    console.error('[submitFacilityReview] Error:', error);
    return { success: false, error: 'レビューの投稿に失敗しました' };
  }
}
```

#### 4-2. submitWorkerReview関数の修正

```typescript
/**
 * ワーカーレビューを投稿（施設→ワーカー）
 */
export async function submitWorkerReview(
  jobId: number,
  userId: number,
  facilityId: number,
  data: {
    rating: number;
    ratingAttendance?: number;
    ratingSkill?: number;
    ratingExecution?: number;
    ratingCommunication?: number;
    ratingAttitude?: number;
    goodPoints?: string;
    improvements?: string;
  }
) {
  try {
    // そのワーカーのその求人へのマッチ確認
    const applications = await prisma.application.findMany({
      where: {
        user_id: userId,
        workDate: {
          job_id: jobId,
          job: {
            facility_id: facilityId,
          },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
      include: {
        workDate: true,
      },
      orderBy: {
        workDate: {
          work_date: 'asc',
        },
      },
    });

    if (applications.length === 0) {
      return { success: false, error: 'このワーカーの勤務実績がありません' };
    }

    const firstWorkDate = applications[0].workDate.work_date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < firstWorkDate) {
      return { success: false, error: '勤務開始前はレビューできません' };
    }

    // 既存レビューチェック
    const existingReview = await prisma.review.findUnique({
      where: {
        job_id_user_id_reviewer_type: {
          job_id: jobId,
          user_id: userId,
          reviewer_type: 'FACILITY',
        },
      },
    });

    if (existingReview) {
      return { success: false, error: '既にレビュー済みです' };
    }

    // レビュー作成
    await prisma.review.create({
      data: {
        facility_id: facilityId,
        user_id: userId,
        job_id: jobId,
        reviewer_type: 'FACILITY',
        rating: data.rating,
        rating_attendance: data.ratingAttendance,
        rating_skill: data.ratingSkill,
        rating_execution: data.ratingExecution,
        rating_communication: data.ratingCommunication,
        rating_attitude: data.ratingAttitude,
        good_points: data.goodPoints || null,
        improvements: data.improvements || null,
      },
    });

    return { success: true, message: 'レビューを投稿しました' };
  } catch (error) {
    console.error('[submitWorkerReview] Error:', error);
    return { success: false, error: 'レビューの投稿に失敗しました' };
  }
}
```

---

### Phase 5: UI修正

#### 5-1. ワーカーレビューページ（施設管理）

ファイル: `app/admin/worker-reviews/page.tsx`

- `getPendingWorkerReviews` を使用してリストを取得
- `isOverdue` が `true` の場合、赤枠・警告アイコンで目立たせる
- レビュー入力は `jobId` と `userId` を渡す

#### 5-2. 施設管理ダッシュボード

ファイル: `app/admin/page.tsx`（ダッシュボード）

- 未レビューワーカーの件数と督促件数を表示
- 督促対象がある場合は目立つバッジで表示

#### 5-3. ワーカーの仕事管理ページ

ファイル: `app/mypage/jobs/page.tsx`（または該当ページ）

- 勤務中の求人に「施設レビュー」ボタンを追加
- `canReview` が `true` の場合のみボタンを表示
- `hasReviewed` が `true` の場合は「レビュー済み」と表示

#### 5-4. 全画面レビュー督促バナー

ファイル: `components/layout/ReviewReminderBanner.tsx`（新規作成）

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { hasOverdueFacilityReview } from '@/src/lib/review-helpers';

export function ReviewReminderBanner({ userId }: { userId: number }) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const checkOverdue = async () => {
      const isOverdue = await hasOverdueFacilityReview(userId);
      setShowBanner(isOverdue);
    };
    checkOverdue();
  }, [userId]);

  if (!showBanner) return null;

  return (
    <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        <span>未入力のレビューがあります。入力をお願いします。</span>
      </div>
      <Link
        href="/mypage/reviews"
        className="bg-white text-red-500 px-4 py-1 rounded font-medium hover:bg-red-50"
      >
        レビューを入力する
      </Link>
    </div>
  );
}
```

このコンポーネントをワーカー向けレイアウトの上部に追加。

---

### Phase 6: テスト

1. **DBマイグレーションの確認**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

2. **シナリオテスト**
   - 同一求人で複数日にマッチしたワーカーのレビューが1回のみ可能か
   - 初日より前にレビューボタンが表示されないか
   - レビュー済みの場合にボタンが無効化されるか
   - 督促対象が正しく表示されるか

---

## ファイル一覧

### 修正が必要なファイル

| ファイル | 内容 |
|---------|------|
| `prisma/schema.prisma` | Reviewモデルの変更、リレーション修正 |
| `src/lib/actions.ts` | submitReview, submitFacilityReviewForWorker の修正 |
| `src/lib/review-helpers.ts` | **新規作成** - ヘルパー関数 |
| `app/admin/worker-reviews/page.tsx` | ワーカーレビュー一覧の修正 |
| `app/admin/workers/[id]/review/page.tsx` | ワーカーレビュー入力の修正 |
| `app/admin/page.tsx` | ダッシュボードに督促表示追加 |
| `app/mypage/reviews/page.tsx` | ワーカーのレビュー一覧修正 |
| `app/mypage/reviews/[applicationId]/page.tsx` | **削除または修正** - jobIdベースに変更 |
| `app/mypage/jobs/page.tsx` | 施設レビューボタン追加 |
| `components/layout/ReviewReminderBanner.tsx` | **新規作成** - 督促バナー |
| `components/layout/WorkerLayout.tsx` | バナー組み込み |

---

## 注意事項

1. **既存データの移行**: 本番環境で既存レビューがある場合は、移行スクリプトを実行してから新スキーマに移行すること
2. **application_idの削除**: Reviewテーブルからapplication_idを削除する場合、既存のコードでapplication_idを参照している箇所を全て修正すること
3. **パフォーマンス**: getPendingWorkerReviewsなどは求人数が多い場合に重くなる可能性あり。必要に応じてキャッシュや最適化を検討

---

## 作業順序（推奨）

1. `prisma/schema.prisma` の修正
2. マイグレーション実行
3. `src/lib/review-helpers.ts` 作成
4. `src/lib/actions.ts` の修正
5. 管理画面のUI修正（ワーカーレビュー）
6. ワーカー画面のUI修正（施設レビュー）
7. 督促バナーの実装
8. テスト

---

最終更新: 2025-12-02
