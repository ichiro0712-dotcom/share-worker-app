/**
 * 修正スクリプト: QR定時退勤済みだがApplicationが WORKING のままのレコードを修正
 *
 * 問題: QR退勤処理で Attendance は CHECKED_OUT になるが、
 *       Application のステータスが WORKING のまま更新されなかった。
 *       そのため施設管理画面で勤務回数が0回と表示されていた。
 *
 * 対象: check_out_type が ON_TIME かつ、紐づく Application が WORKING のレコード
 *
 * 使い方:
 *   ドライラン（件数確認のみ）: npx tsx prisma/fix-working-status-after-checkout.ts --dry-run
 *   実行:                      npx tsx prisma/fix-working-status-after-checkout.ts --execute
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isExecute = process.argv.includes('--execute');

  if (!isDryRun && !isExecute) {
    console.log('使い方:');
    console.log('  ドライラン: npx tsx prisma/fix-working-status-after-checkout.ts --dry-run');
    console.log('  実行:       npx tsx prisma/fix-working-status-after-checkout.ts --execute');
    process.exit(1);
  }

  // QR定時退勤済み（ON_TIME）で、紐づくApplicationがWORKINGのままのAttendanceを検索
  const stuckAttendances = await prisma.attendance.findMany({
    where: {
      status: 'CHECKED_OUT',
      check_out_type: 'ON_TIME',
      application_id: { not: null },
      application: {
        status: 'WORKING',
      },
    },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          user_id: true,
        },
      },
      facility: {
        select: {
          facility_name: true,
        },
      },
    },
  });

  console.log(`\n対象レコード数: ${stuckAttendances.length} 件\n`);

  if (stuckAttendances.length === 0) {
    console.log('修正が必要なレコードはありません。');
    return;
  }

  // 対象の詳細表示
  for (const att of stuckAttendances) {
    console.log(
      `  Attendance #${att.id} | Application #${att.application!.id} | ` +
      `Worker #${att.application!.user_id} | 施設: ${att.facility.facility_name} | ` +
      `退勤: ${att.check_out_time?.toISOString()}`
    );
  }

  if (isDryRun) {
    console.log('\n[ドライラン] 上記のレコードが修正対象です。--execute で実行してください。');
    return;
  }

  // 実行
  const applicationIds = stuckAttendances
    .map((att) => att.application_id)
    .filter((id): id is number => id !== null);

  const result = await prisma.application.updateMany({
    where: {
      id: { in: applicationIds },
      status: 'WORKING', // 安全のため再度条件指定
    },
    data: {
      status: 'COMPLETED_PENDING',
    },
  });

  console.log(`\n[完了] ${result.count} 件の Application を WORKING → COMPLETED_PENDING に更新しました。`);
}

main()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
