/**
 * レビュー用過去求人データをクリーンアップするスクリプト
 *
 * 実行方法:
 * DATABASE_URL="本番のURL" npx tsx scripts/cleanup-review-dummy-jobs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 レビュー用過去求人データのクリーンアップを開始します...\n');

  // 1. レビュー用過去求人を検索
  const dummyJobs = await prisma.job.findMany({
    where: {
      title: {
        contains: 'レビュー用過去求人'
      }
    },
    select: {
      id: true,
      title: true,
      facility_id: true,
    }
  });

  console.log(`📊 見つかったレビュー用過去求人: ${dummyJobs.length}件`);

  if (dummyJobs.length === 0) {
    console.log('✅ 削除対象のデータはありません');
    return;
  }

  // 削除対象の求人IDリスト
  const jobIds = dummyJobs.map(j => j.id);

  // 2. 関連データを順番に削除（外部キー制約のため）

  // 2-1. 関連するレビューを削除
  const deletedReviews = await prisma.review.deleteMany({
    where: {
      job_id: { in: jobIds }
    }
  });
  console.log(`  - 削除したレビュー: ${deletedReviews.count}件`);

  // 2-2. 関連するメッセージを削除
  const deletedMessages = await prisma.message.deleteMany({
    where: {
      job_id: { in: jobIds }
    }
  });
  console.log(`  - 削除したメッセージ: ${deletedMessages.count}件`);

  // 2-3. 関連する応募を取得してから削除
  const workDates = await prisma.jobWorkDate.findMany({
    where: {
      job_id: { in: jobIds }
    },
    select: { id: true }
  });
  const workDateIds = workDates.map(wd => wd.id);

  const deletedApplications = await prisma.application.deleteMany({
    where: {
      work_date_id: { in: workDateIds }
    }
  });
  console.log(`  - 削除した応募: ${deletedApplications.count}件`);

  // 2-4. 関連する勤務日を削除
  const deletedWorkDates = await prisma.jobWorkDate.deleteMany({
    where: {
      job_id: { in: jobIds }
    }
  });
  console.log(`  - 削除した勤務日: ${deletedWorkDates.count}件`);

  // 2-5. 求人本体を削除
  const deletedJobs = await prisma.job.deleteMany({
    where: {
      id: { in: jobIds }
    }
  });
  console.log(`  - 削除した求人: ${deletedJobs.count}件`);

  console.log('\n✅ クリーンアップが完了しました！');
}

main()
  .catch((e) => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
