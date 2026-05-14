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
 *   SQL生成（DBを更新せず、UPDATE文をファイル出力）:
 *     npx tsx prisma/recalc-job-wage-with-overtime.ts --generate-sql
 *     → prisma/output/recalc-job-wage-YYYYMMDD-HHmm.sql に保存
 *     生成されたSQLをレビュー後、Supabase SQL Editor 等で実行する
 *
 *   実行（このスクリプトから直接DBを更新）:
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
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

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
  const isGenerateSql = args.includes('--generate-sql');

  const modeCount = [isDryRun, isExecute, isGenerateSql].filter(Boolean).length;
  if (modeCount !== 1) {
    console.error('使用方法: --dry-run / --generate-sql / --execute のいずれか1つを指定してください');
    process.exit(1);
  }

  const mode = isDryRun
    ? 'DRY RUN（読み取りのみ）'
    : isGenerateSql
      ? 'GENERATE SQL（UPDATE文をファイル出力）'
      : 'EXECUTE（DB更新あり）';
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
    console.log('実際に更新するには --execute、SQLファイルを生成するには --generate-sql を指定してください');
    console.log('='.repeat(70));
    await prisma.$disconnect();
    return;
  }

  if (isGenerateSql) {
    if (candidates.length === 0) {
      console.log('\n更新対象がないためSQLは生成しません');
      await prisma.$disconnect();
      return;
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const outputPath = join(process.cwd(), 'prisma', 'output', `recalc-job-wage-${timestamp}.sql`);

    const lines: string[] = [];
    lines.push('-- 求人日給 再計算スクリプト 生成SQL');
    lines.push(`-- 生成日時: ${now.toISOString()}`);
    lines.push(`-- 対象求人数: ${candidates.length} 件`);
    lines.push(`-- 旧wage合計: ${totalOldWage}`);
    lines.push(`-- 新wage合計: ${totalNewWage}`);
    lines.push(`-- 差額合計:   ${totalDiff}`);
    lines.push('');
    lines.push('-- 対象条件: status=PUBLISHED かつ 有効な応募0件');
    lines.push('-- 実行方法: トランザクション内で実行することを推奨');
    lines.push('-- 例:');
    lines.push('--   BEGIN;');
    lines.push('--   （以下のUPDATE群）');
    lines.push('--   -- 結果を確認');
    lines.push('--   COMMIT;  （または問題があれば ROLLBACK;）');
    lines.push('');
    lines.push('BEGIN;');
    lines.push('');

    for (const c of candidates) {
      lines.push(
        `-- Job #${c.jobId} ${c.startTime}-${c.endTime} 休${c.breakTime}分 時給¥${c.hourlyWage}: 旧¥${c.oldWage} → 新¥${c.newWage} (差額 ¥${c.diff})`,
      );
      lines.push(`UPDATE jobs SET wage = ${c.newWage} WHERE id = ${c.jobId} AND wage = ${c.oldWage};`);
      lines.push('');
    }

    lines.push('-- 件数チェック用クエリ（実行前後で件数を比較できる）');
    lines.push(
      `-- SELECT COUNT(*) FROM jobs WHERE id IN (${candidates.map((c) => c.jobId).join(', ')});`,
    );
    lines.push('');
    lines.push('COMMIT;');
    lines.push('');

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, lines.join('\n'), 'utf-8');

    console.log('\n' + '='.repeat(70));
    console.log('SQLファイルを生成しました');
    console.log('='.repeat(70));
    console.log(`  出力先: ${outputPath}`);
    console.log(`  対象求人数: ${candidates.length} 件`);
    console.log('');
    console.log('次の手順:');
    console.log('  1. 生成されたSQLファイルの内容をレビューしてください');
    console.log('  2. Supabase SQL Editor 等で本番/ステージングDBに対して実行してください');
    console.log('  3. UPDATE文は WHERE wage = 旧wage 条件付きなので、');
    console.log('     生成時から値が変わっている求人は更新されません（安全策）');
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
