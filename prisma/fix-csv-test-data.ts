/**
 * CSV出力テスト用データの修正
 * 既存のAttendanceレコードにjob_idを追加
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== CSV出力テストデータ修正開始 ===\n');

  // CSVテスト用のAttendanceを取得
  const testAttendances = await prisma.attendance.findMany({
    where: {
      user: {
        email: 'csv-test-worker@example.com',
      },
      job_id: null,  // job_idが未設定のもの
    },
    include: {
      application: {
        include: {
          workDate: {
            include: {
              job: true,
            },
          },
        },
      },
    },
  });

  console.log(`job_idが未設定のテストレコード: ${testAttendances.length}件`);

  for (const att of testAttendances) {
    const jobId = att.application?.workDate?.job?.id;
    if (jobId) {
      await prisma.attendance.update({
        where: { id: att.id },
        data: { job_id: jobId },
      });
      console.log(`Attendance ID ${att.id} にjob_id ${jobId} を設定`);
    } else {
      console.log(`Attendance ID ${att.id} は関連するjobが見つかりません`);
    }
  }

  console.log('\n=== 修正完了 ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
