/**
 * 既存のJobWorkDateにvisible_untilを設定するマイグレーションスクリプト
 *
 * 計算式: visible_until = work_date + start_time - 2時間
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx scripts/migrate-visible-until.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== visible_until マイグレーション開始 ===');

  // JobWorkDateとそのJobを取得（start_timeはJobにある）
  const workDates = await prisma.jobWorkDate.findMany({
    where: {
      visible_until: null, // まだ設定されていないもののみ
    },
    include: {
      job: {
        select: {
          start_time: true,
        },
      },
    },
  });

  console.log(`対象レコード数: ${workDates.length}`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const wd of workDates) {
    try {
      // start_time は "HH:MM" 形式
      const [hours, minutes] = wd.job.start_time.split(':').map(Number);

      // work_date（日付部分）にstart_time（時刻部分）を加える
      const workDateTime = new Date(wd.work_date);
      workDateTime.setHours(hours, minutes, 0, 0);

      // 2時間前を計算
      const visibleUntil = new Date(workDateTime.getTime() - 2 * 60 * 60 * 1000);

      await prisma.jobWorkDate.update({
        where: { id: wd.id },
        data: { visible_until: visibleUntil },
      });

      updatedCount++;

      if (updatedCount % 100 === 0) {
        console.log(`進捗: ${updatedCount}/${workDates.length}`);
      }
    } catch (error) {
      console.error(`エラー (id=${wd.id}):`, error);
      errorCount++;
    }
  }

  console.log('=== マイグレーション完了 ===');
  console.log(`更新成功: ${updatedCount}`);
  console.log(`エラー: ${errorCount}`);
}

main()
  .catch((e) => {
    console.error('マイグレーションエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
