/**
 * CSV出力テスト用の勤怠データを作成
 * フラグ判定が正確に確認できるよう、明確なパターンでデータを作成
 *
 * パターン:
 * 1. 通常勤務（定刻通り）- フラグなし
 * 2. 遅刻30分 - 遅刻フラグ
 * 3. 早退30分 - 早退フラグ
 * 4. 残業1時間 - 残業フラグ
 * 5. 深夜勤務（定刻通り）- フラグなし
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * JST時刻をUTCのDateオブジェクトに変換
 * @param date 日付部分（Date）
 * @param timeStr 時刻文字列（HH:MM形式、JST）
 * @param addDays 日付をずらす場合（翌日なら1）
 */
function jstToUtc(date: Date, timeStr: string, addDays = 0): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setDate(result.getDate() + addDays);
  // JSTはUTC+9なので、JST時刻からUTCに変換するには9時間引く
  result.setUTCHours(hours - 9, minutes, 0, 0);
  return result;
}

async function main() {
  console.log('=== CSV出力テスト用データ作成開始 ===\n');

  // 1. テスト用ワーカーを取得または作成
  let testWorker = await prisma.user.findFirst({
    where: { email: 'csv-test-worker@example.com' },
  });

  if (!testWorker) {
    testWorker = await prisma.user.create({
      data: {
        email: 'csv-test-worker@example.com',
        name: 'CSVテストワーカー',
        password_hash: 'dummy-hash',
        phone_number: '090-0000-0000',
      },
    });
    console.log('テストワーカー作成:', testWorker.id, testWorker.name);
  } else {
    console.log('既存テストワーカー使用:', testWorker.id, testWorker.name);
  }

  // 2. 施設を取得（削除されていないもの）
  const facility = await prisma.facility.findFirst({
    where: { deleted_at: null },
  });

  if (!facility) {
    console.error('アクティブな施設が見つかりません');
    return;
  }
  console.log('施設:', facility.id, facility.facility_name);

  // 3. テストパターン定義
  // 各パターンで求人のシフト時間と、実際の勤務時間を明確に定義
  const testPatterns = [
    {
      name: '通常勤務（定刻通り）',
      description: '9:00-17:00勤務、フラグなし',
      job: { start: '09:00', end: '17:00', breakMin: 60, wage: 1500, transportFee: 500 },
      actual: { start: '09:00', end: '17:00', breakMin: 60 },
      expectedFlags: { late: false, early: false, overtime: false },
    },
    {
      name: '遅刻30分',
      description: '9:00出勤予定を9:30出勤、遅刻フラグ表示',
      job: { start: '09:00', end: '17:00', breakMin: 60, wage: 1500, transportFee: 500 },
      actual: { start: '09:30', end: '17:00', breakMin: 60 },
      expectedFlags: { late: true, early: false, overtime: false },
    },
    {
      name: '早退30分',
      description: '17:00退勤予定を16:30退勤、早退フラグ表示',
      job: { start: '09:00', end: '17:00', breakMin: 60, wage: 1500, transportFee: 500 },
      actual: { start: '09:00', end: '16:30', breakMin: 60 },
      expectedFlags: { late: false, early: true, overtime: false },
    },
    {
      name: '残業1時間',
      description: '17:00退勤予定を18:00退勤、残業フラグ表示',
      job: { start: '09:00', end: '17:00', breakMin: 60, wage: 1500, transportFee: 500 },
      actual: { start: '09:00', end: '18:00', breakMin: 60 },
      expectedFlags: { late: false, early: false, overtime: true },
    },
    {
      name: '深夜勤務（定刻通り）',
      description: '22:00-6:00勤務（翌日）、フラグなし',
      job: { start: '22:00', end: '06:00', breakMin: 60, wage: 1800, transportFee: 800 },
      actual: { start: '22:00', end: '06:00', breakMin: 60, nextDay: true },
      expectedFlags: { late: false, early: false, overtime: false },
    },
    {
      name: '遅刻＋残業',
      description: '9:00出勤予定を9:15出勤、17:00退勤予定を18:30退勤',
      job: { start: '09:00', end: '17:00', breakMin: 60, wage: 1600, transportFee: 600 },
      actual: { start: '09:15', end: '18:30', breakMin: 60 },
      expectedFlags: { late: true, early: false, overtime: true },
    },
  ];

  // 4. 各パターンでテストデータを作成
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // 日付のみ使用

  for (let i = 0; i < testPatterns.length; i++) {
    const pattern = testPatterns[i];
    const workDate = new Date(today);
    workDate.setDate(workDate.getDate() - (i + 1)); // 過去の日付

    console.log(`\n--- パターン ${i + 1}: ${pattern.name} ---`);
    console.log(`  説明: ${pattern.description}`);

    // 求人作成
    const job = await prisma.job.create({
      data: {
        facility_id: facility.id,
        title: `[フラグテスト] ${pattern.name}`,
        start_time: pattern.job.start,
        end_time: pattern.job.end,
        break_time: String(pattern.job.breakMin),
        wage: pattern.job.wage * 8,
        hourly_wage: pattern.job.wage,
        transportation_fee: pattern.job.transportFee,
        status: 'PUBLISHED',
        access: '最寄り駅より徒歩5分',
        recruitment_count: 1,
        overview: `フラグ表示テスト用: ${pattern.description}`,
        work_content: ['テスト業務'],
        required_qualifications: [],
        required_experience: [],
        dresscode: [],
        dresscode_images: [],
        belongings: [],
        attachments: [],
        manager_name: 'テスト担当者',
        images: [],
        tags: [],
      },
    });
    console.log(`  求人作成: ID=${job.id}, ${pattern.job.start}-${pattern.job.end}`);

    // JobWorkDate作成
    const deadline = new Date(workDate);
    deadline.setDate(deadline.getDate() - 1);
    const wd = await prisma.jobWorkDate.create({
      data: {
        job_id: job.id,
        work_date: workDate,
        deadline: deadline,
        recruitment_count: 1,
      },
    });

    // Application作成
    const app = await prisma.application.create({
      data: {
        user_id: testWorker.id,
        work_date_id: wd.id,
        status: 'COMPLETED_RATED',
      },
    });

    // 実績時刻を計算（JSTからUTCに変換）
    const actualStart = jstToUtc(workDate, pattern.actual.start);
    const actualEnd = jstToUtc(
      workDate,
      pattern.actual.end,
      pattern.actual.nextDay ? 1 : 0
    );

    // 勤務時間を計算（分）
    const workedMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60)) - pattern.actual.breakMin;
    const calculatedWage = Math.ceil((workedMinutes / 60) * pattern.job.wage);

    // Attendance作成
    const attendance = await prisma.attendance.create({
      data: {
        user_id: testWorker.id,
        facility_id: facility.id,
        application_id: app.id,
        job_id: job.id,
        check_in_time: actualStart,
        check_out_time: actualEnd,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'ON_TIME',
        status: 'CHECKED_OUT',
        actual_start_time: actualStart,
        actual_end_time: actualEnd,
        actual_break_time: pattern.actual.breakMin,
        calculated_wage: calculatedWage,
      },
    });

    console.log(`  勤怠作成: ID=${attendance.id}`);
    console.log(`    定刻: ${pattern.job.start} - ${pattern.job.end}`);
    console.log(`    実績: ${pattern.actual.start} - ${pattern.actual.end}${pattern.actual.nextDay ? '(翌日)' : ''}`);
    console.log(`    期待フラグ: 遅刻=${pattern.expectedFlags.late}, 早退=${pattern.expectedFlags.early}, 残業=${pattern.expectedFlags.overtime}`);
    console.log(`    報酬: ${calculatedWage}円 + 交通費${pattern.job.transportFee}円 = ${calculatedWage + pattern.job.transportFee}円`);
  }

  console.log('\n=== テストデータ作成完了 ===');
  console.log(`作成した勤怠レコード数: ${testPatterns.length}`);
  console.log('\n確認方法:');
  console.log('1. システム管理画面 > 勤怠管理 でフラグ表示を確認');
  console.log('2. 各パターンの期待フラグと実際の表示が一致することを確認');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
