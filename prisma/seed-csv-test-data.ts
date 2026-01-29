/**
 * CSV出力テスト用の勤怠データを作成
 * 様々なパターン（通常、残業、深夜、深夜残業、遅刻、早退）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  // 3. テスト用求人を作成（様々なシフトパターン）
  const jobPatterns = [
    { title: '日勤（9-17時）', start: '09:00', end: '17:00', breakMin: '60', wage: 1500 },
    { title: '日勤長時間（8-19時）', start: '08:00', end: '19:00', breakMin: '60', wage: 1500 },
    { title: '夜勤（21-6時）', start: '21:00', end: '06:00', breakMin: '60', wage: 1800 },
    { title: '準夜勤（17-24時）', start: '17:00', end: '00:00', breakMin: '30', wage: 1600 },
    { title: '早朝（4-10時）', start: '04:00', end: '10:00', breakMin: '30', wage: 1700 },
  ];

  const jobs: any[] = [];
  for (const pattern of jobPatterns) {
    const job = await prisma.job.create({
      data: {
        facility_id: facility.id,
        title: `[CSVテスト] ${pattern.title}`,
        start_time: pattern.start,
        end_time: pattern.end,
        break_time: pattern.breakMin,
        wage: pattern.wage * 8, // 日給（仮）
        hourly_wage: pattern.wage,
        transportation_fee: 500,
        status: 'PUBLISHED',
        access: '最寄り駅より徒歩5分',
        recruitment_count: 1,
        overview: 'CSV出力テスト用の求人です',
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
    jobs.push({ ...job, pattern });
    console.log('求人作成:', job.id, pattern.title);
  }

  // 4. 各求人に対して勤務日と応募を作成
  const today = new Date();
  const attendanceData: any[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const workDate = new Date(today);
    workDate.setDate(workDate.getDate() - (i + 1)); // 過去の日付

    // JobWorkDateを作成（締め切りは勤務日の前日）
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

    // Applicationを作成（COMPLETED_RATED = 完了済み）
    const app = await prisma.application.create({
      data: {
        user_id: testWorker.id,
        work_date_id: wd.id,
        status: 'COMPLETED_RATED',
      },
    });

    attendanceData.push({
      job,
      workDate: wd,
      application: app,
      pattern: job.pattern,
    });
  }

  // 5. 勤怠レコードを作成（様々なパターン）
  const attendancePatterns = [
    {
      // パターン1: 通常勤務（定刻通り）
      name: '通常勤務（定刻）',
      startOffset: 0,  // 定刻通り
      endOffset: 0,    // 定刻通り
      breakDiff: 0,    // 休憩時間差なし
    },
    {
      // パターン2: 残業あり（1時間残業）- 10時間勤務で2時間残業
      name: '残業2時間',
      startOffset: 0,
      endOffset: 0,   // 元々10時間勤務
      breakDiff: 0,
    },
    {
      // パターン3: 深夜勤務（夜勤シフト）
      name: '深夜勤務',
      startOffset: 0,
      endOffset: 0,
      breakDiff: 0,
    },
    {
      // パターン4: 遅刻あり
      name: '遅刻30分',
      startOffset: 30,  // 30分遅刻
      endOffset: 0,
      breakDiff: 0,
    },
    {
      // パターン5: 早退あり
      name: '早退30分',
      startOffset: 0,
      endOffset: -30,   // 30分早退
      breakDiff: 0,
    },
  ];

  for (let i = 0; i < Math.min(attendanceData.length, attendancePatterns.length); i++) {
    const data = attendanceData[i];
    const pattern = attendancePatterns[i];

    // 予定時刻を計算
    const [startH, startM] = data.pattern.start.split(':').map(Number);
    const [endH, endM] = data.pattern.end.split(':').map(Number);
    const breakMinutes = parseInt(data.pattern.breakMin);

    // チェックイン・チェックアウト時刻を計算
    const checkInTime = new Date(data.workDate.work_date);
    checkInTime.setHours(startH, startM + pattern.startOffset, 0, 0);

    const checkOutTime = new Date(data.workDate.work_date);
    // 終了時刻が翌日の場合
    if (endH < startH || (endH === 0 && startH > 0)) {
      checkOutTime.setDate(checkOutTime.getDate() + 1);
    }
    checkOutTime.setHours(endH, endM + pattern.endOffset, 0, 0);

    // 勤怠レコードを作成
    // job_idも設定することで、CSV出力時にjobリレーションが取得できるようにする
    const attendance = await prisma.attendance.create({
      data: {
        user_id: testWorker.id,
        facility_id: facility.id,
        application_id: data.application.id,
        job_id: data.job.id,  // 直接job_idも設定
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'ON_TIME',
        status: 'CHECKED_OUT',
        actual_start_time: checkInTime,
        actual_end_time: checkOutTime,
        actual_break_time: breakMinutes + pattern.breakDiff,
        calculated_wage: data.pattern.wage * 8, // 仮の計算
      },
    });

    console.log(`\n勤怠レコード作成 [${pattern.name}]:`);
    console.log(`  ID: ${attendance.id}`);
    console.log(`  求人: ${data.pattern.title}`);
    console.log(`  出勤: ${checkInTime.toISOString()}`);
    console.log(`  退勤: ${checkOutTime.toISOString()}`);
  }

  console.log('\n=== テストデータ作成完了 ===');
  console.log(`作成した勤怠レコード数: ${Math.min(attendanceData.length, attendancePatterns.length)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
