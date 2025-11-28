# 求人構造リファクタリング指示書

## 概要

このドキュメントは、求人（Job）と勤務日（JobWorkDate）の関係を正しく1対多として扱うようにコードをリファクタリングするための詳細指示書です。

## 現状の問題

DBスキーマでは `Job 1:N JobWorkDate` の正しい設計になっているが、コード側が以下のように1:1として実装されている：

- 求人作成時：5日選択 → 5つの独立したJobが作成される（間違い）
- 求人編集時：1つのJobの1つのWorkDateしか編集できない
- 求人一覧：日付ごとに別の求人として表示される

## 目標

- 求人作成時：5日選択 → 1つのJob + 5つのJobWorkDateが作成される
- 求人編集時：1つのJobの条件を編集すると全日程に反映、日程の追加/削除も可能
- 求人一覧：条件（Job）ごとにグループ化して表示

---

## 環境情報

```
プロジェクトパス: /Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ
現在のブランチ: feature/job-structure-refactor
Node.js: v22以上
パッケージマネージャー: npm
フレームワーク: Next.js 14 (App Router)
ORM: Prisma
DB: PostgreSQL (Docker)
```

## Git操作（作業完了後）

```bash
cd /Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ
git add -A
git commit -m "リファクタリング: 求人と勤務日の1対多関係を正しく実装"
git push origin feature/job-structure-refactor
```

---

## Phase 1: バックエンド（actions.ts）の修正

### ファイル: `src/lib/actions.ts`

### 1.1 createJobs関数の修正

**現在の実装（問題）:**
```typescript
// 選択された日付ごとに個別のJobを作成している
for (const workDate of input.workDates) {
  const job = await prisma.job.create({ ... });
  await prisma.jobWorkDate.create({ job_id: job.id, ... });
}
```

**修正後:**
```typescript
export async function createJobs(input: CreateJobsInput) {
  // 1つのJobを作成
  const job = await prisma.job.create({
    data: {
      facility_id: input.facilityId,
      template_id: input.templateId,
      status: 'PUBLISHED',
      title: input.title,
      start_time: input.startTime,
      end_time: input.endTime,
      break_time: `${input.breakTime}分`,
      wage: calculateWage(...),
      hourly_wage: input.hourlyWage,
      transportation_fee: input.transportationFee,
      recruitment_count: input.recruitmentCount,
      work_content: input.workContent,
      // ... その他のフィールド
    },
  });

  // 複数のJobWorkDateを作成
  const workDates = input.workDates.map(dateStr => {
    const workDate = new Date(dateStr);
    const deadline = new Date(workDate);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(23, 59, 59, 999);

    return {
      job_id: job.id,
      work_date: workDate,
      deadline: deadline,
      recruitment_count: input.recruitmentCount,
      applied_count: 0,
    };
  });

  await prisma.jobWorkDate.createMany({
    data: workDates,
  });

  return { success: true, jobId: job.id };
}
```

### 1.2 updateJob関数の修正

**修正内容:**
- Jobの条件（時給、仕事内容など）を更新
- JobWorkDateの追加/削除/更新に対応

```typescript
export async function updateJob(
  jobId: number,
  facilityId: number,
  data: {
    title: string;
    startTime: string;
    endTime: string;
    breakTime: number;
    hourlyWage: number;
    transportationFee: number;
    recruitmentCount: number;
    workContent: string[];
    jobDescription: string;
    qualifications: string[];
    skills?: string[];
    dresscode?: string[];
    belongings?: string[];
    icons?: string[];
    images?: string[];
    dresscodeImages?: string[];
    attachments?: string[];
    // 勤務日の操作
    addWorkDates?: string[];      // 追加する日付
    removeWorkDateIds?: number[]; // 削除するWorkDateのID
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const existingJob = await prisma.job.findFirst({
      where: { id: jobId, facility_id: facilityId },
      include: { workDates: true },
    });

    if (!existingJob) {
      return { success: false, error: '求人が見つかりません' };
    }

    // 日給を計算
    const breakTimeMinutes = typeof data.breakTime === 'number'
      ? data.breakTime
      : parseInt(String(data.breakTime)) || 0;

    const wage = calculateWage(
      data.startTime,
      data.endTime,
      breakTimeMinutes,
      data.hourlyWage,
      data.transportationFee
    );

    // Jobを更新（条件部分）
    await prisma.job.update({
      where: { id: jobId },
      data: {
        title: data.title,
        start_time: data.startTime,
        end_time: data.endTime,
        break_time: `${breakTimeMinutes}分`,
        hourly_wage: data.hourlyWage,
        transportation_fee: data.transportationFee,
        wage: wage,
        recruitment_count: data.recruitmentCount,
        work_content: data.workContent,
        overview: data.jobDescription,
        required_qualifications: data.qualifications,
        required_experience: data.skills || [],
        dresscode: data.dresscode || [],
        belongings: data.belongings || [],
        tags: data.icons || [],
        images: data.images || [],
        dresscode_images: data.dresscodeImages || [],
        attachments: data.attachments || [],
        updated_at: new Date(),
      },
    });

    // 既存のWorkDateの募集人数を更新
    await prisma.jobWorkDate.updateMany({
      where: { job_id: jobId },
      data: { recruitment_count: data.recruitmentCount },
    });

    // 勤務日を追加
    if (data.addWorkDates && data.addWorkDates.length > 0) {
      const newWorkDates = data.addWorkDates.map(dateStr => {
        const workDate = new Date(dateStr);
        const deadline = new Date(workDate);
        deadline.setDate(deadline.getDate() - 1);
        deadline.setHours(23, 59, 59, 999);

        return {
          job_id: jobId,
          work_date: workDate,
          deadline: deadline,
          recruitment_count: data.recruitmentCount,
          applied_count: 0,
        };
      });

      await prisma.jobWorkDate.createMany({
        data: newWorkDates,
        skipDuplicates: true, // 重複を無視
      });
    }

    // 勤務日を削除（応募がないもののみ）
    if (data.removeWorkDateIds && data.removeWorkDateIds.length > 0) {
      await prisma.jobWorkDate.deleteMany({
        where: {
          id: { in: data.removeWorkDateIds },
          job_id: jobId,
          applied_count: 0, // 応募がないもののみ削除可能
        },
      });
    }

    revalidatePath('/admin/jobs');
    return { success: true };
  } catch (error) {
    console.error('[updateJob] Error:', error);
    return { success: false, error: '求人の更新に失敗しました' };
  }
}
```

### 1.3 getAdminJobsList関数の修正

**現在の実装:**
日付ごとに別のレコードとして返している

**修正後:**
Jobごとにグループ化し、workDatesを配列として含める

```typescript
export async function getAdminJobsList(facilityId: number) {
  const jobs = await prisma.job.findMany({
    where: { facility_id: facilityId },
    include: {
      workDates: {
        orderBy: { work_date: 'asc' },
      },
      facility: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return jobs.map(job => {
    // 全勤務日の応募数合計と募集数合計を計算
    const totalApplied = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
    const totalRecruitment = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

    // 最も近い勤務日
    const today = new Date();
    const upcomingDates = job.workDates.filter(wd => new Date(wd.work_date) >= today);
    const nearestDate = upcomingDates[0] || job.workDates[0];

    return {
      id: job.id,
      title: job.title,
      status: job.status,
      startTime: job.start_time,
      endTime: job.end_time,
      hourlyWage: job.hourly_wage,
      workContent: job.work_content,
      requiredQualifications: job.required_qualifications,
      // 勤務日情報
      workDates: job.workDates.map(wd => ({
        id: wd.id,
        date: wd.work_date.toISOString().split('T')[0],
        formattedDate: formatDate(wd.work_date),
        recruitmentCount: wd.recruitment_count,
        appliedCount: wd.applied_count,
        deadline: wd.deadline.toISOString(),
      })),
      // サマリー情報
      totalWorkDates: job.workDates.length,
      totalApplied: totalApplied,
      totalRecruitment: totalRecruitment,
      nearestWorkDate: nearestDate ? formatDate(nearestDate.work_date) : null,
      // 表示用（最初の日付〜最後の日付）
      dateRange: job.workDates.length > 1
        ? `${formatDate(job.workDates[0].work_date)} 〜 ${formatDate(job.workDates[job.workDates.length - 1].work_date)}`
        : nearestDate ? formatDate(nearestDate.work_date) : '',
    };
  });
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
```

---

## Phase 2: 管理画面UIの修正

### 2.1 求人一覧ページ（app/admin/jobs/page.tsx）

**修正内容:**
- 日付ごとではなく、Job（条件）ごとにカード表示
- 各カード内に勤務日一覧を表示
- 日程が複数ある場合は「12/1, 12/2, 12/3...」のように表示

**UI変更イメージ:**
```
┌─────────────────────────────────────────────────────────┐
│ [募集中] デイサービス・介護スタッフ募集（日勤）        │
│                                                         │
│ 応募状況: 5/15名 (33%)  時給: ¥1,500                   │
│                                                         │
│ 勤務日: 12/1(月), 12/2(火), 12/3(水), 12/4(木), 12/5(金)│
│ 時間: 07:00〜16:00                                      │
│                                                         │
│ 仕事内容: [対話・見守り] [入浴介助] [記録業務]         │
│ 資格: [介護福祉士] [実務者研修]                        │
│                                                         │
│                              [編集] [通知書]            │
└─────────────────────────────────────────────────────────┘
```

**主な修正箇所:**
1. `getAdminJobsList`の戻り値の型を更新
2. カード表示を日付ごとからJob単位に変更
3. 勤務日を横並びで表示（多い場合は「+N日」で省略）

### 2.2 求人編集ページ（app/admin/jobs/[id]/edit/page.tsx）

**修正内容:**
- 1つのJobに対する編集ページ
- 条件（時給、仕事内容など）の編集 → 全日程に反映
- カレンダーで勤務日の追加/削除が可能
- 応募者がいる日程は削除不可（UIで明示）

**UI変更イメージ:**
```
┌─ 勤務日 ─────────────────────────────────────────────┐
│                                                       │
│  [カレンダー]              選択中の勤務日:           │
│  < 2025年12月 >            ┌──────────────────────┐  │
│  日 月 火 水 木 金 土      │ 12/1(月) [×]         │  │
│     1  2  3  4  5  6       │ 12/2(火) [×]         │  │
│  7  8  9 10 11 12 13       │ 12/3(水) [応募1名]   │  │ ← 削除不可
│  14 15 16 17 18 19 20      │ 12/4(木) [×]         │  │
│  21 22 23 24 25 26 27      │ 12/5(金) [×]         │  │
│  28 29 30 31               └──────────────────────┘  │
│                                                       │
│  ※ 応募者がいる日程は削除できません                  │
└───────────────────────────────────────────────────────┘
```

**主な修正箇所:**
1. `getJobById`の戻り値にworkDates配列を含める
2. 勤務日選択UIを複数選択に変更（新規作成と同様）
3. 保存時に`addWorkDates`と`removeWorkDateIds`を送信
4. 応募がある日程には削除ボタンを非表示/無効化

### 2.3 求人新規作成ページ（app/admin/jobs/new/page.tsx）

**修正内容:**
基本的に現在のUIは正しいので、`createJobs`関数の変更に合わせて結果の扱いを修正

- 成功時：1つのjobIdが返る（現在は配列）
- 作成完了メッセージ：「求人を作成しました（5日程）」

---

## Phase 3: ワーカー側UIの修正

### 3.1 求人一覧ページ（app/jobs/page.tsx）

**修正内容:**
現在の日付フィルターは維持しつつ、表示を調整

- 日付で絞り込んだ場合、その日に該当するJobを表示
- Job内の他の日程も「他の日程: 12/2, 12/3...」として表示可能

### 3.2 求人詳細ページ（app/jobs/[id]/page.tsx）

**修正内容:**
- URLは `/jobs/[jobId]?date=2025-12-01` の形式を維持
- 求人条件は共通表示
- 勤務日選択UIを追加（複数日同時応募可能にする場合）
- または日付タブで切り替え

---

## Phase 4: データマイグレーション

### 現在のデータを新構造に移行

既存データは「同一条件のJobが複数ある」状態なので、以下のスクリプトで統合：

```typescript
// prisma/scripts/migrate-jobs.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateJobs() {
  // 同一条件のJobをグループ化するキーを作成
  const jobs = await prisma.job.findMany({
    include: { workDates: true },
  });

  // facility_id + title + start_time + end_time + hourly_wage でグループ化
  const groups = new Map<string, typeof jobs>();

  for (const job of jobs) {
    const key = `${job.facility_id}-${job.title}-${job.start_time}-${job.end_time}-${job.hourly_wage}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(job);
  }

  // 各グループを1つのJobに統合
  for (const [key, groupJobs] of groups) {
    if (groupJobs.length <= 1) continue; // 統合不要

    const primaryJob = groupJobs[0]; // 最初のJobを残す
    const otherJobs = groupJobs.slice(1);

    // 他のJobのworkDatesをprimaryJobに移動
    for (const job of otherJobs) {
      await prisma.jobWorkDate.updateMany({
        where: { job_id: job.id },
        data: { job_id: primaryJob.id },
      });
    }

    // 他のJobを削除
    await prisma.job.deleteMany({
      where: { id: { in: otherJobs.map(j => j.id) } },
    });

    console.log(`Merged ${groupJobs.length} jobs into job #${primaryJob.id}`);
  }
}

migrateJobs()
  .then(() => console.log('Migration completed'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**実行方法:**
```bash
npx tsx prisma/scripts/migrate-jobs.ts
```

**注意:** 本番環境で実行する前に必ずバックアップを取ること

---

## 作業順序

1. **Phase 1.1**: createJobs関数を修正（新規作成が正しく動くように）
2. **Phase 1.2**: updateJob関数を修正（編集が正しく動くように）
3. **Phase 1.3**: getAdminJobsList関数を修正（一覧表示が正しく動くように）
4. **Phase 2.1**: 求人一覧ページのUI修正
5. **Phase 2.2**: 求人編集ページのUI修正
6. **Phase 2.3**: 求人新規作成ページの微修正
7. **Phase 3**: ワーカー側UIの修正
8. **Phase 4**: 既存データのマイグレーション（最後に実行）

---

## テスト項目

### 管理画面

- [ ] 新規求人作成：5日選択 → 1つのJobレコード + 5つのWorkDateが作成される
- [ ] 求人一覧：Job単位で表示され、各Jobに勤務日一覧が表示される
- [ ] 求人編集：条件変更が全日程に反映される
- [ ] 求人編集：日程の追加ができる
- [ ] 求人編集：応募のない日程の削除ができる
- [ ] 求人編集：応募がある日程は削除ボタンが無効

### ワーカー画面

- [ ] 求人一覧：日付フィルターが正しく動作する
- [ ] 求人詳細：全日程が表示され、応募したい日を選択できる
- [ ] 応募：選択した日程に応募できる

---

## 完了後の確認

```bash
# 開発サーバー起動
npm run dev -- -p 3000

# 以下のURLで動作確認
# 管理画面: http://localhost:3000/admin/jobs
# ワーカー画面: http://localhost:3000/jobs
```

問題なければコミット＆プッシュ：
```bash
git add -A
git commit -m "リファクタリング: 求人と勤務日の1対多関係を正しく実装"
git push origin feature/job-structure-refactor
```
