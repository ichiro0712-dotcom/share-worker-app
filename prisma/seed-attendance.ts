/**
 * QRコード勤怠管理機能のテストデータ作成スクリプト
 *
 * 実行方法: npx tsx prisma/seed-attendance.ts
 *
 * 作成するデータ:
 * 1. 施設にQRコード関連データを追加
 * 2. 勤怠記録（出勤済み、退勤済み、変更申請中など）
 * 3. 勤怠変更申請（承認待ち、承認済み、却下済み）
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ========================================
// ヘルパー関数
// ========================================

function generateQRToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateEmergencyCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// ========================================
// メイン処理
// ========================================

async function main() {
  console.log('🏥 QRコード勤怠管理テストデータの作成を開始します...\n');

  // ========================================
  // 1. 施設にQRコード関連データを追加
  // ========================================
  console.log('📱 施設にQRコード関連データを追加中...');

  const facilities = await prisma.facility.findMany({
    take: 3,
    orderBy: { id: 'asc' },
  });

  if (facilities.length === 0) {
    console.error('❌ 施設データが見つかりません。先にseed.tsを実行してください。');
    return;
  }

  for (const facility of facilities) {
    await prisma.facility.update({
      where: { id: facility.id },
      data: {
        qr_secret_token: generateQRToken(),
        qr_generated_at: new Date(),
        emergency_attendance_code: generateEmergencyCode(),
      },
    });
    console.log(`  ✅ 施設ID ${facility.id}: ${facility.facility_name} - QRトークン設定完了`);
  }

  // ========================================
  // 2. テストユーザーとアプリケーションを取得
  // ========================================
  console.log('\n👤 テストユーザーを確認中...');

  const users = await prisma.user.findMany({
    take: 3,
    orderBy: { id: 'asc' },
  });

  if (users.length === 0) {
    console.error('❌ ユーザーデータが見つかりません。先にseed.tsを実行してください。');
    return;
  }

  // 本日のSCHEDULED状態のアプリケーションを取得
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);

  // ========================================
  // 3. 本日の勤務予定を作成（出勤ボタン表示用）
  // ========================================
  console.log('\n📅 本日の勤務予定を確認・作成中...');

  // 施設1の求人を取得
  const job = await prisma.job.findFirst({
    where: { facility_id: facilities[0].id },
    include: { workDates: true },
  });

  if (!job) {
    console.log('  ⚠️ 求人が見つかりません。勤務予定は作成できません。');
  } else {
    // 本日の勤務日があるか確認
    let todayWorkDate = await prisma.jobWorkDate.findFirst({
      where: {
        job_id: job.id,
        work_date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (!todayWorkDate) {
      // 本日の勤務日を作成
      todayWorkDate = await prisma.jobWorkDate.create({
        data: {
          job_id: job.id,
          work_date: today,
          deadline: addDays(today, -1),
          recruitment_count: 3,
          matched_count: 0,
        },
      });
      console.log(`  ✅ 本日の勤務日を作成: WorkDate ID ${todayWorkDate.id}`);
    }

    // ユーザー1に本日のSCHEDULED応募を作成
    const existingApplication = await prisma.application.findFirst({
      where: {
        user_id: users[0].id,
        work_date_id: todayWorkDate.id,
      },
    });

    if (!existingApplication) {
      const application = await prisma.application.create({
        data: {
          user_id: users[0].id,
          work_date_id: todayWorkDate.id,
          status: 'SCHEDULED',
        },
      });
      console.log(`  ✅ 本日の勤務予定を作成: Application ID ${application.id} (ユーザー: ${users[0].name})`);
    } else {
      console.log(`  ℹ️ 既存の勤務予定あり: Application ID ${existingApplication.id}`);
    }
  }

  // ========================================
  // 4. 勤怠記録を作成
  // ========================================
  console.log('\n⏰ 勤怠記録を作成中...');

  // 過去の勤怠記録用のアプリケーションを取得（様々なステータス）
  const pastApplications = await prisma.application.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED' },
        { status: 'COMPLETED_PENDING' },
        { status: 'COMPLETED_RATED' },
        { status: 'WORKING' },
      ],
    },
    include: {
      workDate: {
        include: { job: true },
      },
      user: true,
    },
    take: 10,
    orderBy: { id: 'desc' },
  });

  console.log(`  📋 利用可能なアプリケーション: ${pastApplications.length}件`);

  // 既存の勤怠データをクリア（テスト用）
  await prisma.attendanceModificationRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  console.log('  🗑️ 既存の勤怠データをクリアしました');

  const attendances: { id: number; type: string }[] = [];
  const facilityId = facilities[0].id;

  // アプリケーションが少ない場合でも、ユーザーと施設を使って勤怠データを作成
  // job_idは必ず設定（jobがない場合はスキップ）
  if (!job) {
    console.log('  ⚠️ 求人が見つからないため、勤怠テストデータの作成をスキップします。');
    return;
  }
  const defaultJobId = job.id;

  // --- パターン1: 出勤中（退勤前） ---
  {
    const user = users[0];
    const app = pastApplications.find(a => a.user_id === user.id);
    const checkInTime = setTime(new Date(), 9, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        application_id: app?.id ?? null,
        job_id: app?.workDate.job.id ?? defaultJobId,
        check_in_time: checkInTime,
        check_in_method: 'QR',
        check_in_lat: 35.6762,
        check_in_lng: 139.6503,
        status: 'CHECKED_IN',
      },
    });
    attendances.push({ id: attendance.id, type: '出勤中' });
    console.log(`  ✅ 勤怠記録（出勤中）: ID ${attendance.id} - ${user.name} (求人ID: ${app?.workDate.job.id ?? defaultJobId})`);
  }

  // --- パターン2: 退勤済み（定刻） ---
  {
    const user = users.length > 1 ? users[1] : users[0];
    const app = pastApplications.find(a => a.user_id === user.id);
    const yesterday = addDays(new Date(), -1);
    const checkInTime = setTime(yesterday, 9, 0);
    const checkOutTime = setTime(yesterday, 17, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        application_id: app?.id ?? null,
        job_id: app?.workDate.job.id ?? defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'ON_TIME',
        check_in_lat: 35.6762,
        check_in_lng: 139.6503,
        check_out_lat: 35.6762,
        check_out_lng: 139.6503,
        status: 'CHECKED_OUT',
        actual_start_time: checkInTime,
        actual_end_time: checkOutTime,
        actual_break_time: 60,
        calculated_wage: 7 * 1500, // 7時間 × 1500円
      },
    });
    attendances.push({ id: attendance.id, type: '退勤済み（定刻）' });
    console.log(`  ✅ 勤怠記録（退勤済み・定刻）: ID ${attendance.id} - ${user.name} (求人ID: ${app?.workDate.job.id ?? defaultJobId})`);
  }

  // --- パターン3: 退勤済み（変更申請・承認待ち） ---
  {
    const user = users.length > 2 ? users[2] : users[0];
    const app = pastApplications.find(a => a.user_id === user.id);
    const twoDaysAgo = addDays(new Date(), -2);
    const checkInTime = setTime(twoDaysAgo, 8, 30);
    const checkOutTime = setTime(twoDaysAgo, 18, 30);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        application_id: app?.id ?? null,
        job_id: app?.workDate.job.id ?? defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'EMERGENCY_CODE',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        check_in_lat: 35.6762,
        check_in_lng: 139.6503,
        check_out_lat: 35.6762,
        check_out_lng: 139.6503,
        status: 'CHECKED_OUT',
      },
    });
    attendances.push({ id: attendance.id, type: '退勤済み（変更申請・承認待ち）' });
    console.log(`  ✅ 勤怠記録（退勤済み・変更申請・承認待ち）: ID ${attendance.id} - ${user.name} (求人ID: ${app?.workDate.job.id ?? defaultJobId})`);

    // --- 勤怠変更申請（承認待ち）を作成 ---
    const modificationRequest = await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: setTime(twoDaysAgo, 8, 30),
        requested_end_time: setTime(twoDaysAgo, 18, 30),
        requested_break_time: 60,
        worker_comment: '予定より30分早く出勤し、30分遅く退勤しました。残業対応のためです。',
        status: 'PENDING',
        original_amount: 8 * 1500, // 8時間 × 1500円
        requested_amount: 9 * 1500, // 9時間 × 1500円
      },
    });
    console.log(`  ✅ 勤怠変更申請（承認待ち）: ID ${modificationRequest.id}`);
  }

  // --- パターン4: 退勤済み + 変更申請承認済み ---
  {
    const user = users[0]; // 同じユーザーの別の勤怠として使用
    const threeDaysAgo = addDays(new Date(), -3);
    const checkInTime = setTime(threeDaysAgo, 9, 0);
    const checkOutTime = setTime(threeDaysAgo, 19, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        application_id: null, // 別の勤怠なのでapplication_idはnull
        job_id: defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        check_in_lat: 35.6762,
        check_in_lng: 139.6503,
        check_out_lat: 35.6762,
        check_out_lng: 139.6503,
        status: 'CHECKED_OUT',
        actual_start_time: setTime(threeDaysAgo, 9, 0),
        actual_end_time: setTime(threeDaysAgo, 19, 0),
        actual_break_time: 60,
        calculated_wage: 9 * 1500, // 9時間 × 1500円
      },
    });
    attendances.push({ id: attendance.id, type: '退勤済み（変更申請承認済み）' });
    console.log(`  ✅ 勤怠記録（退勤済み・変更申請承認済み）: ID ${attendance.id} - ${user.name} (求人ID: ${defaultJobId})`);

    // 施設管理者を取得
    const facilityAdmin = await prisma.facilityAdmin.findFirst({
      where: { facility_id: facilityId },
    });

    // --- 勤怠変更申請（承認済み）を作成 ---
    const modificationRequest = await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: setTime(threeDaysAgo, 9, 0),
        requested_end_time: setTime(threeDaysAgo, 19, 0),
        requested_break_time: 60,
        worker_comment: '残業対応のため1時間延長しました。',
        status: 'APPROVED',
        admin_comment: '残業を確認しました。承認します。',
        reviewed_by: facilityAdmin?.id ?? null,
        reviewed_at: new Date(),
        original_amount: 8 * 1500,
        requested_amount: 9 * 1500,
      },
    });
    console.log(`  ✅ 勤怠変更申請（承認済み）: ID ${modificationRequest.id}`);
  }

  // --- パターン5: 退勤済み + 変更申請却下 ---
  {
    const user = users.length > 1 ? users[1] : users[0];
    const fourDaysAgo = addDays(new Date(), -4);
    const checkInTime = setTime(fourDaysAgo, 10, 0);
    const checkOutTime = setTime(fourDaysAgo, 17, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        application_id: null,
        job_id: defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        check_in_lat: 35.6762,
        check_in_lng: 139.6503,
        check_out_lat: 35.6762,
        check_out_lng: 139.6503,
        status: 'CHECKED_OUT',
      },
    });
    attendances.push({ id: attendance.id, type: '退勤済み（変更申請却下）' });
    console.log(`  ✅ 勤怠記録（退勤済み・変更申請却下）: ID ${attendance.id} - ${user.name} (求人ID: ${defaultJobId})`);

    // 施設管理者を取得
    const facilityAdmin = await prisma.facilityAdmin.findFirst({
      where: { facility_id: facilityId },
    });

    // --- 勤怠変更申請（却下）を作成 ---
    const modificationRequest = await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: setTime(fourDaysAgo, 9, 0), // 実際は10時出勤だが9時と申請
        requested_end_time: setTime(fourDaysAgo, 18, 0),  // 実際は17時退勤だが18時と申請
        requested_break_time: 30,
        worker_comment: '実際の勤務時間と異なるため変更申請します。',
        status: 'REJECTED',
        admin_comment: '打刻記録と申請内容が一致しません。正確な時間を再申請してください。',
        reviewed_by: facilityAdmin?.id ?? null,
        reviewed_at: new Date(),
        original_amount: 7 * 1500,
        requested_amount: Math.floor(8.5 * 1500),
        resubmit_count: 0,
      },
    });
    console.log(`  ✅ 勤怠変更申請（却下）: ID ${modificationRequest.id}`);
  }

  // ========================================
  // 追加テストデータ: 施設管理画面テスト用
  // ========================================
  console.log('\n📝 追加テストデータ（施設管理画面テスト用）を作成中...');

  // 施設管理者を取得
  const facilityAdmin = await prisma.facilityAdmin.findFirst({
    where: { facility_id: facilityId },
  });

  // --- 追加の未承認（PENDING）データ: 5件 ---
  const pendingComments = [
    { comment: '電車遅延のため出勤時間がずれました。', startDiff: -30, endDiff: 0 },
    { comment: '急な対応があり30分残業しました。', startDiff: 0, endDiff: 30 },
    { comment: '体調不良のため早退しましたが、実際の退勤時間を申請します。', startDiff: 0, endDiff: -60 },
    { comment: '利用者様の送迎対応で予定より早く出勤しました。', startDiff: -45, endDiff: 0 },
    { comment: '研修参加のため勤務時間が変更になりました。', startDiff: -15, endDiff: 45 },
  ];

  for (let i = 0; i < pendingComments.length; i++) {
    const user = users[i % users.length];
    const daysAgo = addDays(new Date(), -(5 + i));
    const baseStart = 9;
    const baseEnd = 17;
    const checkInTime = setTime(daysAgo, baseStart, 0);
    const checkOutTime = setTime(daysAgo, baseEnd, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        job_id: defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        status: 'CHECKED_OUT',
      },
    });

    const reqStartTime = setTime(daysAgo, baseStart, pendingComments[i].startDiff);
    const reqEndTime = setTime(daysAgo, baseEnd, pendingComments[i].endDiff);
    const workHours = (reqEndTime.getTime() - reqStartTime.getTime()) / (1000 * 60 * 60) - 1; // 休憩1時間引く

    await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: reqStartTime,
        requested_end_time: reqEndTime,
        requested_break_time: 60,
        worker_comment: pendingComments[i].comment,
        status: 'PENDING',
        original_amount: 7 * 1500,
        requested_amount: Math.round(workHours * 1500),
      },
    });
    console.log(`  ✅ 未承認（PENDING）${i + 1}: ${user.name} - ${pendingComments[i].comment.substring(0, 20)}... (求人ID: ${defaultJobId})`);
  }

  // --- 再申請（RESUBMITTED）データ: 3件 ---
  const resubmitComments = [
    {
      original: '出勤時間を9:30に変更申請します。',
      resubmit: '前回却下されたので、正確な打刻記録を確認し9:15に修正しました。',
      adminReject: '打刻記録と30分の差異があります。再確認してください。',
    },
    {
      original: '残業1時間分を申請します。',
      resubmit: '上長確認の上、残業45分に修正して再申請します。',
      adminReject: '残業承認が取れていません。上長に確認してください。',
    },
    {
      original: '早退したため実際の退勤時間を申請します。',
      resubmit: '体調不良の診断書を添えて再申請します。退勤15:00で申請。',
      adminReject: '早退理由の詳細を記載してください。',
    },
  ];

  for (let i = 0; i < resubmitComments.length; i++) {
    const user = users[i % users.length];
    const daysAgo = addDays(new Date(), -(10 + i));
    const checkInTime = setTime(daysAgo, 9, 0);
    const checkOutTime = setTime(daysAgo, 17, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        job_id: defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        status: 'CHECKED_OUT',
      },
    });

    await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: setTime(daysAgo, 9, 15),
        requested_end_time: setTime(daysAgo, 17, 0),
        requested_break_time: 60,
        worker_comment: resubmitComments[i].resubmit,
        status: 'RESUBMITTED',
        admin_comment: resubmitComments[i].adminReject,
        reviewed_by: facilityAdmin?.id ?? null,
        reviewed_at: addDays(new Date(), -(9 + i)),
        original_amount: 7 * 1500,
        requested_amount: Math.round(6.75 * 1500),
        resubmit_count: 1,
      },
    });
    console.log(`  ✅ 再申請（RESUBMITTED）${i + 1}: ${user.name} - ${resubmitComments[i].resubmit.substring(0, 25)}...`);
  }

  // --- 追加の承認済み（APPROVED）データ: 4件 ---
  const approvedComments = [
    { worker: '残業30分を申請します。', admin: '残業確認しました。承認します。' },
    { worker: '早出対応のため8:30出勤を申請します。', admin: '早出対応を確認。承認します。' },
    { worker: '利用者様の緊急対応で1時間延長しました。', admin: '緊急対応お疲れ様でした。承認します。' },
    { worker: '研修参加のため勤務時間変更を申請します。', admin: '研修参加を確認。承認します。' },
  ];

  for (let i = 0; i < approvedComments.length; i++) {
    const user = users[i % users.length];
    const daysAgo = addDays(new Date(), -(15 + i));
    const checkInTime = setTime(daysAgo, 9, 0);
    const checkOutTime = setTime(daysAgo, 17, 30 * (i + 1));

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        job_id: defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        status: 'CHECKED_OUT',
        actual_start_time: checkInTime,
        actual_end_time: checkOutTime,
        actual_break_time: 60,
        calculated_wage: Math.round((7 + 0.5 * (i + 1)) * 1500),
      },
    });

    await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: checkInTime,
        requested_end_time: checkOutTime,
        requested_break_time: 60,
        worker_comment: approvedComments[i].worker,
        status: 'APPROVED',
        admin_comment: approvedComments[i].admin,
        reviewed_by: facilityAdmin?.id ?? null,
        reviewed_at: addDays(new Date(), -(14 + i)),
        original_amount: 7 * 1500,
        requested_amount: Math.round((7 + 0.5 * (i + 1)) * 1500),
      },
    });
    console.log(`  ✅ 承認済み（APPROVED）${i + 1}: ${user.name} - ${approvedComments[i].worker.substring(0, 20)}... (求人ID: ${defaultJobId})`);
  }

  // --- 追加の却下（REJECTED）データ: 3件 ---
  const rejectedComments = [
    { worker: '出勤時間を1時間早めに申請します。', admin: '打刻記録と大幅に異なります。正確な時間を再申請してください。' },
    { worker: '残業2時間分を申請します。', admin: '残業の事前承認がありません。却下します。' },
    { worker: '休憩なしで勤務したため休憩時間0分で申請します。', admin: '労働基準法により休憩は必須です。再申請してください。' },
  ];

  for (let i = 0; i < rejectedComments.length; i++) {
    const user = users[i % users.length];
    const daysAgo = addDays(new Date(), -(20 + i));
    const checkInTime = setTime(daysAgo, 9, 0);
    const checkOutTime = setTime(daysAgo, 17, 0);

    const attendance = await prisma.attendance.create({
      data: {
        user_id: user.id,
        facility_id: facilityId,
        job_id: defaultJobId,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: 'QR',
        check_out_method: 'QR',
        check_out_type: 'MODIFICATION_REQUIRED',
        status: 'CHECKED_OUT',
      },
    });

    await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: attendance.id,
        requested_start_time: setTime(daysAgo, 8, 0),
        requested_end_time: setTime(daysAgo, 19, 0),
        requested_break_time: i === 2 ? 0 : 60,
        worker_comment: rejectedComments[i].worker,
        status: 'REJECTED',
        admin_comment: rejectedComments[i].admin,
        reviewed_by: facilityAdmin?.id ?? null,
        reviewed_at: addDays(new Date(), -(19 + i)),
        original_amount: 7 * 1500,
        requested_amount: i === 2 ? 10 * 1500 : 10 * 1500,
        resubmit_count: 0,
      },
    });
    console.log(`  ✅ 却下（REJECTED）${i + 1}: ${user.name} - ${rejectedComments[i].worker.substring(0, 20)}... (求人ID: ${defaultJobId})`);
  }

  // ========================================
  // 5. サマリー出力
  // ========================================
  console.log('\n========================================');
  console.log('✅ テストデータ作成完了');
  console.log('========================================\n');

  // 勤怠変更申請の件数を取得
  const modificationCounts = await prisma.attendanceModificationRequest.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const totalAttendances = await prisma.attendance.count();
  const totalModifications = await prisma.attendanceModificationRequest.count();

  console.log('📊 作成したデータ:');
  console.log(`  - 施設QRコード設定: ${facilities.length}件`);
  console.log(`  - 勤怠記録: ${totalAttendances}件`);
  console.log(`  - 勤怠変更申請: ${totalModifications}件`);
  console.log('');

  console.log('📝 勤怠変更申請の内訳:');
  for (const count of modificationCounts) {
    const statusLabel = {
      PENDING: '未承認（PENDING）',
      RESUBMITTED: '再申請（RESUBMITTED）',
      APPROVED: '承認済み（APPROVED）',
      REJECTED: '却下（REJECTED）',
    }[count.status] || count.status;
    console.log(`  - ${statusLabel}: ${count._count.status}件`);
  }
  console.log('');

  console.log('🔑 テスト用QRコード値:');
  const updatedFacilities = await prisma.facility.findMany({
    where: { id: { in: facilities.map(f => f.id) } },
    select: {
      id: true,
      facility_name: true,
      qr_secret_token: true,
      emergency_attendance_code: true,
    },
  });

  for (const f of updatedFacilities) {
    console.log(`  施設「${f.facility_name}」(ID: ${f.id}):`);
    console.log(`    QRコード値: attendance:${f.id}:${f.qr_secret_token}`);
    console.log(`    緊急番号: ${f.emergency_attendance_code}`);
  }

  console.log('\n📋 テスト手順:');
  console.log('  1. ワーカーでログイン → 仕事管理 → 右上の「出勤」ボタン');
  console.log('  2. QRコードスキャン または 緊急番号入力で出勤打刻');
  console.log('  3. 退勤時に「変更申請が必要」を選択 → 変更申請フォームへ');
  console.log('  4. 施設管理者でログイン → タスク → 勤怠変更申請一覧');
  console.log('  5. システム管理者でログイン → 勤怠管理 → 全勤怠一覧確認');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
