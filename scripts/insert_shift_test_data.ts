/**
 * シフト管理画面のテスト用ダミーデータ挿入スクリプト
 *
 * 実行: npx tsx scripts/insert_shift_test_data.ts
 * 削除: npx tsx scripts/delete_shift_test_data.ts
 *
 * 特徴:
 * - 5人のワーカーが同じ日・同じ時間帯に被るシフトを作成
 * - messageフィールドに "SHIFT_TEST_DATA_2024" を設定して識別可能に
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('シフトテストデータを挿入中...');

  // 施設ID=1を使用（存在確認）
  const facility = await prisma.facility.findFirst({
    where: { id: 1 },
  });

  if (!facility) {
    console.error('施設ID=1が見つかりません');
    process.exit(1);
  }

  // テスト用ワーカーを5人取得（または作成）
  const workers = await prisma.user.findMany({
    take: 5,
    where: { deleted_at: null },
  });

  if (workers.length < 5) {
    console.error('ワーカーが5人以上必要です。seed.tsを実行してください。');
    process.exit(1);
  }

  // テスト用求人を作成
  const today = new Date();
  const testDate = new Date(today);
  testDate.setDate(today.getDate() + 1); // 明日の日付
  testDate.setHours(0, 0, 0, 0);

  // deadlineを計算（勤務日の1日前）
  const deadline1 = new Date(testDate);
  deadline1.setDate(deadline1.getDate() - 1);

  const job = await prisma.job.create({
    data: {
      facility_id: 1,
      title: '[テスト] シフト重複確認用求人',
      start_time: '09:00',
      end_time: '17:00',
      break_time: '60',
      wage: 12000, // 日給
      hourly_wage: 1500,
      transportation_fee: 500,
      recruitment_count: 10,
      tags: [],
      access: '最寄り駅から徒歩5分',
      overview: 'シフト管理画面のテスト用データです。削除してください。',
      work_content: ['入浴介助', '食事介助'],
      required_qualifications: ['初任者研修'],
      required_experience: [],
      dresscode: [],
      dresscode_images: [],
      belongings: [],
      attachments: [],
      manager_name: 'テスト管理者',
      images: [],
      status: 'PUBLISHED',
      allow_car: true,
    },
  });

  console.log(`求人ID ${job.id} を作成しました`);

  // 勤務日を作成
  const workDate = await prisma.jobWorkDate.create({
    data: {
      job_id: job.id,
      work_date: testDate,
      deadline: deadline1,
      recruitment_count: 10,
      matched_count: 5,
    },
  });

  console.log(`勤務日ID ${workDate.id} を作成しました（日付: ${testDate.toLocaleDateString('ja-JP')}）`);

  // 5人のワーカーにシフト（応募）を作成 - 同じ時間帯で重複
  for (let i = 0; i < 5; i++) {
    const worker = workers[i];

    // 既存の応募がないか確認
    const existingApp = await prisma.application.findUnique({
      where: {
        work_date_id_user_id: {
          work_date_id: workDate.id,
          user_id: worker.id,
        },
      },
    });

    if (existingApp) {
      console.log(`ワーカー ${worker.name} は既に応募済み。スキップ。`);
      continue;
    }

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: worker.id,
        status: 'SCHEDULED', // マッチング済み
        message: 'SHIFT_TEST_DATA_2024', // 識別用マーカー
      },
    });

    console.log(`ワーカー "${worker.name}" のシフトを作成（Application ID: ${application.id}）`);
  }

  // 追加: 時間がずれた重複パターンも作成（別の日）
  const testDate2 = new Date(today);
  testDate2.setDate(today.getDate() + 2); // 明後日
  testDate2.setHours(0, 0, 0, 0);

  const deadline2 = new Date(testDate2);
  deadline2.setDate(deadline2.getDate() - 1);

  const workDate2 = await prisma.jobWorkDate.create({
    data: {
      job_id: job.id,
      work_date: testDate2,
      deadline: deadline2,
      recruitment_count: 10,
      matched_count: 5,
    },
  });

  console.log(`勤務日ID ${workDate2.id} を作成しました（日付: ${testDate2.toLocaleDateString('ja-JP')}）`);

  // 時間をずらしたパターン
  for (let i = 0; i < 5; i++) {
    const worker = workers[i];

    const existingApp = await prisma.application.findUnique({
      where: {
        work_date_id_user_id: {
          work_date_id: workDate2.id,
          user_id: worker.id,
        },
      },
    });

    if (existingApp) {
      console.log(`ワーカー ${worker.name} は既に応募済み（日付2）。スキップ。`);
      continue;
    }

    await prisma.application.create({
      data: {
        work_date_id: workDate2.id,
        user_id: worker.id,
        status: 'SCHEDULED',
        message: 'SHIFT_TEST_DATA_2024',
      },
    });
  }

  console.log('\n=== テストデータ挿入完了 ===');
  console.log(`求人ID: ${job.id}`);
  console.log(`勤務日1: ${testDate.toLocaleDateString('ja-JP')} (ID: ${workDate.id})`);
  console.log(`勤務日2: ${testDate2.toLocaleDateString('ja-JP')} (ID: ${workDate2.id})`);
  console.log('\n削除するには: npx tsx scripts/delete_shift_test_data.ts');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
