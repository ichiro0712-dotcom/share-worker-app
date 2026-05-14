/**
 * 公開中・未応募求人の日給再計算スクリプト
 *
 * 目的:
 *   求人保存時の calculateWage が割増（深夜・残業）を反映していなかった旧バグの影響で、
 *   Job.wage に「時給×稼働時間+交通費」のみの値が保存されている既存求人がある。
 *   本スクリプトは、現在公開中（status = PUBLISHED）かつ未応募の求人について、
 *   utils/salary.ts の calculateDailyWage（割増対応版）で再計算し、Job.wage を更新する。
 *
 * 対象条件:
 *   - Job.status = 'PUBLISHED'
 *   - そのJob配下の全WorkDateに、有効な Application（cancelled_at IS NULL）が0件
 *   - 再計算結果が現行 wage と異なる場合のみ更新対象
 *
 * 使い方:
 *   ドライラン（読み取りのみ・差額一覧と集計を表示）:
 *     npx tsx prisma/recalc-job-wage-with-overtime.ts --dry-run
 *
 *   実行（実際にDBを更新）:
 *     npx tsx prisma/recalc-job-wage-with-overtime.ts --execute
 *
 * 注意:
 *   - 本番DBに対する書き込みは Claude Code が行ってはならない（CLAUDE.md 参照）
 *   - 本スクリプトの本番実行はユーザーが手動で行うこと
 *   - ステージングDBで先行実行して妥当性を確認すること
 *   - 実行前にDBバックアップを取得することを推奨
 */

import { PrismaClient } from '@prisma/client';
import { calculateDailyWage } from '../utils/salary';

const prisma = new PrismaClient();

interface JobUpdateCandidate {
  jobId: number;
  title: string;
  startTime: string;
  endTime: string;
  breakTime: number;
  hourlyWage: number;
  transportationFee: number;
  oldWage: number;
  newWage: number;
  diff: number;
}

function parseBreakMinutes(breakTime: string): number {
  const match = breakTime.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');

  if (!isDryRun && !isExecute) {
    console.error('使用方法: --dry-run または --execute を指定してください');
    process.exit(1);
  }

  const mode = isDryRun ? 'DRY RUN（読み取りのみ）' : 'EXECUTE（DB更新あり）';
  console.log('='.repeat(70));
  console.log(`求人日給 再計算スクリプト - ${mode}`);
  console.log('='.repeat(70));

  // 対象: PUBLISHED かつ 有効な応募0件 の求人
  const jobs = await prisma.job.findMany({
    where: {
      status: 'PUBLISHED',
      workDates: {
        every: {
          applications: {
            none: {
              cancelled_at: null,
            },
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      start_time: true,
      end_time: true,
      break_time: true,
      hourly_wage: true,
      transportation_fee: true,
      wage: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(`\n対象求人数（公開中・有効な応募0件）: ${jobs.length} 件\n`);

  const candidates: JobUpdateCandidate[] = [];
  let skippedInvalid = 0;
  let unchangedCount = 0;
  let totalOldWage = 0;
  let totalNewWage = 0;
  let totalDiff = 0;

  for (const job of jobs) {
    const breakMinutes = parseBreakMinutes(job.break_time);

    let newWage: number;
    try {
      newWage = calculateDailyWage(
        job.start_time,
        job.end_time,
        breakMinutes,
        job.hourly_wage,
        job.transportation_fee,
      );
    } catch (e) {
      skippedInvalid++;
      console.warn(
        `  ⚠ Job #${job.id} 再計算失敗（スキップ）: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    if (newWage === job.wage) {
      unchangedCount++;
      continue;
    }

    const diff = newWage - job.wage;
    totalOldWage += job.wage;
    totalNewWage += newWage;
    totalDiff += diff;

    candidates.push({
      jobId: job.id,
      title: job.title,
      startTime: job.start_time,
      endTime: job.end_time,
      breakTime: breakMinutes,
      hourlyWage: job.hourly_wage,
      transportationFee: job.transportation_fee,
      oldWage: job.wage,
      newWage,
      diff,
    });
  }

  console.log('-'.repeat(70));
  console.log('集計結果');
  console.log('-'.repeat(70));
  console.log(`処理対象:              ${jobs.length} 件`);
  console.log(`更新対象（差額あり）:  ${candidates.length} 件`);
  console.log(`変更なし:              ${unchangedCount} 件`);
  console.log(`スキップ（計算不可）:  ${skippedInvalid} 件`);
  console.log('');
  console.log(`旧 wage 合計:          ¥${totalOldWage.toLocaleString()}`);
  console.log(`新 wage 合計:          ¥${totalNewWage.toLocaleString()}`);
  console.log(`差額合計（新-旧）:     ¥${totalDiff.toLocaleString()}`);
  if (candidates.length > 0) {
    console.log(
      `平均差額（差額発生時）:¥${Math.round(totalDiff / candidates.length).toLocaleString()}`,
    );
  }

  // 差額発生レコードの詳細（上位30件）
  if (candidates.length > 0) {
    console.log('\n更新対象の詳細（差額の大きい順、最大30件）:');
    console.log('-'.repeat(70));
    const sorted = [...candidates].sort((a, b) => b.diff - a.diff);
    sorted.slice(0, 30).forEach((c) => {
      console.log(
        `  Job #${c.jobId} ${c.startTime}-${c.endTime} 休${c.breakTime}分 時給¥${c.hourlyWage.toLocaleString()}: ` +
          `旧¥${c.oldWage.toLocaleString()} → 新¥${c.newWage.toLocaleString()} (差額 ¥${c.diff.toLocaleString()})`,
      );
    });
    if (candidates.length > 30) {
      console.log(`  ... 他 ${candidates.length - 30} 件`);
    }
  }

  // 新値が旧値より小さくなったケースは要確認
  const decreased = candidates.filter((c) => c.diff < 0);
  if (decreased.length > 0) {
    console.log(
      `\n⚠ 新wage < 旧wage となったレコードが ${decreased.length} 件あります（要確認）:`,
    );
    decreased.slice(0, 10).forEach((c) => {
      console.log(
        `  Job #${c.jobId}: 旧¥${c.oldWage.toLocaleString()} → 新¥${c.newWage.toLocaleString()} (差額 ¥${c.diff.toLocaleString()})`,
      );
    });
  }

  if (isDryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN モードのため DB は更新していません');
    console.log('実際に更新するには --execute を付けて実行してください');
    console.log('='.repeat(70));
    await prisma.$disconnect();
    return;
  }

  if (candidates.length === 0) {
    console.log('\n更新対象がないため終了します');
    await prisma.$disconnect();
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('DB更新を開始します...');
  console.log('='.repeat(70));

  let updatedCount = 0;
  let errorCount = 0;
  const errors: Array<{ jobId: number; error: string }> = [];

  for (const c of candidates) {
    try {
      await prisma.job.update({
        where: { id: c.jobId },
        data: { wage: c.newWage },
      });
      updatedCount++;
      if (updatedCount % 50 === 0) {
        console.log(`  進捗: ${updatedCount} / ${candidates.length} 件 完了`);
      }
    } catch (e) {
      errorCount++;
      errors.push({
        jobId: c.jobId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log('更新完了');
  console.log('-'.repeat(70));
  console.log(`成功: ${updatedCount} 件`);
  console.log(`失敗: ${errorCount} 件`);

  if (errors.length > 0) {
    console.log('\n失敗したレコード:');
    errors.slice(0, 10).forEach((e) => {
      console.log(`  Job #${e.jobId}: ${e.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... 他 ${errors.length - 10} 件`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('スクリプト実行エラー:', e);
  await prisma.$disconnect();
  process.exit(1);
});
