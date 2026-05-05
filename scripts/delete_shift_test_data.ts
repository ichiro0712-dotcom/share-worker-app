/**
 * シフト管理画面のテスト用ダミーデータ削除スクリプト
 *
 * 実行: npx tsx scripts/delete_shift_test_data.ts
 *
 * 削除対象:
 * - messageフィールドが "SHIFT_TEST_DATA_2024" のApplication
 * - titleに "[テスト]" を含むJob（およびその関連JobWorkDate）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('シフトテストデータを削除中...\n');

  // 1. テスト用Applicationを削除
  const deletedApps = await prisma.application.deleteMany({
    where: {
      message: 'SHIFT_TEST_DATA_2024',
    },
  });
  console.log(`✅ Application ${deletedApps.count} 件を削除しました`);

  // 2. テスト用Jobを検索
  const testJobs = await prisma.job.findMany({
    where: {
      title: {
        contains: '[テスト]',
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (testJobs.length === 0) {
    console.log('⚠️ テスト用求人は見つかりませんでした');
  } else {
    console.log(`\n見つかったテスト用求人:`);
    testJobs.forEach((job) => {
      console.log(`  - ID: ${job.id}, Title: ${job.title}`);
    });

    // 3. 関連するJobWorkDateを削除
    for (const job of testJobs) {
      const deletedWorkDates = await prisma.jobWorkDate.deleteMany({
        where: { job_id: job.id },
      });
      console.log(`  └ JobWorkDate ${deletedWorkDates.count} 件を削除`);
    }

    // 4. テスト用Jobを削除
    const deletedJobs = await prisma.job.deleteMany({
      where: {
        title: {
          contains: '[テスト]',
        },
      },
    });
    console.log(`\n✅ Job ${deletedJobs.count} 件を削除しました`);
  }

  console.log('\n=== テストデータ削除完了 ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
