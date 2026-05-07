/**
 * 給与再計算スクリプト（新方式・2段階切り上げ方式）
 *
 * 目的:
 *   既に確定済みの Attendance.calculated_wage を新計算方式で再計算し、
 *   旧値を legacy_calculated_wage に退避してから calculated_wage を上書きする。
 *
 * 使い方:
 *   ドライラン（読み取りのみ・件数と差額の集計を表示）:
 *     npx tsx prisma/recalc-salary-with-new-method.ts --dry-run
 *
 *   実行（実際にDBを更新）:
 *     npx tsx prisma/recalc-salary-with-new-method.ts --execute
 *
 * 冪等性:
 *   legacy_calculated_wage がすでに設定されているレコードはスキップする。
 *   二重実行で値が壊れることはない。
 *
 * ロールバック:
 *   UPDATE attendances
 *     SET calculated_wage = legacy_calculated_wage,
 *         legacy_calculated_wage = NULL
 *   WHERE legacy_calculated_wage IS NOT NULL;
 *
 * 注意:
 *   - 本番DBに対する書き込みは Claude Code が行ってはならない（CLAUDE.md 参照）
 *   - 本スクリプトの本番実行はユーザーが手動で行うこと
 *   - ステージングDBで先行実行して妥当性を確認すること
 */

import { PrismaClient } from '@prisma/client';
import { calculateSalary } from '../src/lib/salary-calculator';

const prisma = new PrismaClient();

interface ProcessResult {
  attendanceId: number;
  oldCalculatedWage: number;
  newCalculatedWage: number;
  diff: number;
  isDataIntegrityOk: boolean; // 旧値の再計算が DB 値と一致するか
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
  console.log('='.repeat(60));
  console.log(`給与再計算スクリプト - ${mode}`);
  console.log('='.repeat(60));

  // 対象レコード取得
  const records = await prisma.attendance.findMany({
    where: {
      calculated_wage: { not: null },
      actual_start_time: { not: null },
      actual_end_time: { not: null },
      // 既に再計算済みのレコードはスキップ（冪等性確保）
      legacy_calculated_wage: null,
    },
    include: {
      application: {
        include: {
          workDate: {
            include: {
              job: {
                select: { hourly_wage: true, transportation_fee: true },
              },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  console.log(`\n対象レコード数: ${records.length} 件`);
  console.log('（calculated_wage IS NOT NULL かつ legacy_calculated_wage IS NULL）\n');

  const results: ProcessResult[] = [];
  let skippedNoJob = 0;
  let skippedNoActualTime = 0;
  let dataIntegrityNgCount = 0;
  let totalOldAmount = 0;
  let totalNewAmount = 0;
  let totalDiff = 0;
  let diffCount = 0;

  for (const att of records) {
    const job = att.application?.workDate?.job;
    if (!job) {
      skippedNoJob++;
      continue;
    }
    if (!att.actual_start_time || !att.actual_end_time) {
      skippedNoActualTime++;
      continue;
    }

    const transportationFee = job.transportation_fee ?? 0;

    // 新方式で再計算
    const result = calculateSalary({
      startTime: att.actual_start_time,
      endTime: att.actual_end_time,
      breakMinutes: att.actual_break_time ?? 0,
      hourlyRate: job.hourly_wage,
    });

    const newCalculatedWage = result.totalPay + transportationFee;
    const oldCalculatedWage = att.calculated_wage as number;
    const diff = newCalculatedWage - oldCalculatedWage;

    // データ整合性チェック: 旧値が「現在の時給で計算した結果」と一致するかは判定しない
    // （新方式と旧方式で計算式が違うため）
    // ただし、新方式で計算した結果が旧値より小さい場合は要確認（通常起こらない）
    const isDataIntegrityOk = diff >= 0;
    if (!isDataIntegrityOk) {
      dataIntegrityNgCount++;
    }

    totalOldAmount += oldCalculatedWage;
    totalNewAmount += newCalculatedWage;
    totalDiff += diff;
    if (diff !== 0) diffCount++;

    results.push({
      attendanceId: att.id,
      oldCalculatedWage,
      newCalculatedWage,
      diff,
      isDataIntegrityOk,
    });
  }

  // サマリ表示
  console.log('-'.repeat(60));
  console.log('集計結果');
  console.log('-'.repeat(60));
  console.log(`処理対象:                   ${results.length} 件`);
  console.log(`差額発生レコード:           ${diffCount} 件`);
  console.log(`差額なし:                   ${results.length - diffCount} 件`);
  console.log(`スキップ（求人情報なし）:   ${skippedNoJob} 件`);
  console.log(`スキップ（実績時刻なし）:   ${skippedNoActualTime} 件`);
  console.log(`要確認（新方式 < 旧方式）: ${dataIntegrityNgCount} 件`);
  console.log('');
  console.log(`旧方式の合計支給額:         ¥${totalOldAmount.toLocaleString()}`);
  console.log(`新方式の合計支給額:         ¥${totalNewAmount.toLocaleString()}`);
  console.log(`差額合計（新-旧）:          ¥${totalDiff.toLocaleString()}`);
  if (diffCount > 0) {
    console.log(`平均差額（差額発生時）:     ¥${Math.round(totalDiff / diffCount).toLocaleString()}`);
  }

  if (dataIntegrityNgCount > 0) {
    console.log('\n⚠ 新方式 < 旧方式 となったレコード（要確認）:');
    results
      .filter((r) => !r.isDataIntegrityOk)
      .slice(0, 10)
      .forEach((r) => {
        console.log(
          `  Attendance #${r.attendanceId}: 旧¥${r.oldCalculatedWage.toLocaleString()} → 新¥${r.newCalculatedWage.toLocaleString()} (差額 ¥${r.diff.toLocaleString()})`
        );
      });
    if (dataIntegrityNgCount > 10) {
      console.log(`  ... 他 ${dataIntegrityNgCount - 10} 件`);
    }
  }

  if (isDryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('DRY RUN モードのため DB は更新していません');
    console.log('実際に更新するには --execute を付けて実行してください');
    console.log('='.repeat(60));
    await prisma.$disconnect();
    return;
  }

  // 実行モード: DB更新
  console.log('\n' + '='.repeat(60));
  console.log('DB更新を開始します...');
  console.log('='.repeat(60));

  let updatedCount = 0;
  let errorCount = 0;
  const errors: Array<{ attendanceId: number; error: string }> = [];

  for (const r of results) {
    try {
      await prisma.attendance.update({
        where: { id: r.attendanceId },
        data: {
          legacy_calculated_wage: r.oldCalculatedWage,
          calculated_wage: r.newCalculatedWage,
        },
      });
      updatedCount++;
      if (updatedCount % 100 === 0) {
        console.log(`  進捗: ${updatedCount} / ${results.length} 件 完了`);
      }
    } catch (e) {
      errorCount++;
      errors.push({
        attendanceId: r.attendanceId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('更新完了');
  console.log('-'.repeat(60));
  console.log(`成功: ${updatedCount} 件`);
  console.log(`失敗: ${errorCount} 件`);

  if (errors.length > 0) {
    console.log('\n失敗したレコード:');
    errors.slice(0, 10).forEach((e) => {
      console.log(`  Attendance #${e.attendanceId}: ${e.error}`);
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
