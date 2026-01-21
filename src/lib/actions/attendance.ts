'use server';

/**
 * QRコード勤怠管理機能 - ワーカー向けServer Actions
 */

import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, getCurrentTime, getTodayStart } from './helpers';
import { calculateSalary } from '@/src/lib/salary-calculator';
import { sendNotification } from '@/src/lib/notification-service';
import {
  ATTENDANCE_ERROR_CODES,
  createAttendanceError,
  MAX_RESUBMIT_COUNT,
} from '@/src/constants/attendance-errors';
import type {
  AttendanceMethod,
  CheckOutType,
  AttendanceRecordRequest,
  AttendanceRecordResponse,
  CreateModificationRequest,
  CreateModificationResponse,
  CheckInStatusResponse,
  AttendanceHistoryItem,
  ModificationRequestDetail,
  UpdateModificationRequest,
} from '@/src/types/attendance';

// ================== 出退勤打刻 ==================

/**
 * 出退勤を記録する
 */
export async function recordAttendance(
  request: AttendanceRecordRequest
): Promise<AttendanceRecordResponse> {
  try {
    const user = await getAuthenticatedUser();

    if (request.type === 'check_in') {
      return await processCheckIn(user.id, request);
    } else {
      return await processCheckOut(user.id, request);
    }
  } catch (error) {
    console.error('[recordAttendance] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '出退勤の記録に失敗しました',
    };
  }
}

/**
 * 出勤処理
 */
async function processCheckIn(
  userId: number,
  request: AttendanceRecordRequest
): Promise<AttendanceRecordResponse> {
  // 1. 施設の検証（QRコードまたは緊急番号）
  const facility = await validateAttendanceMethod(request);
  if (!facility) {
    return createAttendanceError(
      request.method === 'QR'
        ? ATTENDANCE_ERROR_CODES.ATT001
        : ATTENDANCE_ERROR_CODES.ATT002
    ) as unknown as AttendanceRecordResponse;
  }

  // 2. 当日の応募を自動紐付け
  const application = await findTodayApplication(userId, facility.id);

  // 3. 遅刻判定
  let isLate = false;
  let scheduledStartTime: Date | null = null;

  if (application) {
    const job = application.workDate.job;
    const workDate = application.workDate.work_date;
    const [startHour, startMinute] = job.start_time.split(':').map(Number);

    scheduledStartTime = new Date(workDate);
    scheduledStartTime.setHours(startHour, startMinute, 0, 0);

    const now = getCurrentTime();
    isLate = now > scheduledStartTime;
  }

  // 4. 出勤記録作成
  const attendance = await prisma.attendance.create({
    data: {
      user_id: userId,
      facility_id: facility.id,
      application_id: application?.id ?? null,
      job_id: application?.workDate.job_id ?? null,
      check_in_time: getCurrentTime(),
      check_in_method: request.method,
      check_in_lat: request.latitude ?? null,
      check_in_lng: request.longitude ?? null,
      status: 'CHECKED_IN',
    },
  });

  return {
    success: true,
    attendanceId: attendance.id,
    isLate,
    message: isLate
      ? '出勤を記録しました。遅刻のため退勤時に勤怠変更申請が必要です。'
      : '出勤を記録しました。',
    scheduledTime: application
      ? {
          startTime: application.workDate.job.start_time,
          endTime: application.workDate.job.end_time,
          breakTime: parseInt(application.workDate.job.break_time, 10),
        }
      : undefined,
  };
}

/**
 * 退勤処理
 */
async function processCheckOut(
  userId: number,
  request: AttendanceRecordRequest
): Promise<AttendanceRecordResponse> {
  // 1. 出勤記録の取得
  const attendance = await prisma.attendance.findFirst({
    where: {
      user_id: userId,
      status: 'CHECKED_IN',
      check_out_time: null,
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
    orderBy: {
      check_in_time: 'desc',
    },
  });

  if (!attendance) {
    return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT003) as unknown as AttendanceRecordResponse;
  }

  // 2. 遅刻判定（出勤時の記録を確認）
  let isLate = false;
  if (attendance.application) {
    const job = attendance.application.workDate.job;
    const workDate = attendance.application.workDate.work_date;
    const [startHour, startMinute] = job.start_time.split(':').map(Number);

    const scheduledStartTime = new Date(workDate);
    scheduledStartTime.setHours(startHour, startMinute, 0, 0);

    isLate = new Date(attendance.check_in_time) > scheduledStartTime;
  }

  // 3. 緊急番号使用判定
  const usedEmergencyCode =
    attendance.check_in_method === 'EMERGENCY_CODE' ||
    request.method === 'EMERGENCY_CODE';

  // 4. 勤怠変更申請が必要か判定
  const requiresModification =
    isLate ||
    usedEmergencyCode ||
    request.checkOutType === 'MODIFICATION_REQUIRED';

  // 5. 定刻退勤の場合のデータ準備
  let actualStartTime: Date | undefined;
  let actualEndTime: Date | undefined;
  let actualBreakTime: number | undefined;
  let calculatedWage: number | undefined;

  if (!requiresModification && attendance.application) {
    const job = attendance.application.workDate.job;
    const workDate = attendance.application.workDate.work_date;
    const [startHour, startMinute] = job.start_time.split(':').map(Number);
    const [endHour, endMinute] = job.end_time.split(':').map(Number);
    const breakTimeMinutes = parseInt(job.break_time, 10);

    actualStartTime = new Date(workDate);
    actualStartTime.setHours(startHour, startMinute, 0, 0);

    actualEndTime = new Date(workDate);
    actualEndTime.setHours(endHour, endMinute, 0, 0);
    // 終了時刻が開始時刻より前の場合は翌日
    if (actualEndTime <= actualStartTime) {
      actualEndTime.setDate(actualEndTime.getDate() + 1);
    }

    actualBreakTime = breakTimeMinutes;

    // 給与計算
    const salaryResult = calculateSalary({
      startTime: actualStartTime,
      endTime: actualEndTime,
      breakMinutes: breakTimeMinutes,
      hourlyRate: job.hourly_wage,
    });
    calculatedWage = salaryResult.totalPay + job.transportation_fee;
  }

  // 6. 退勤記録更新
  await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      check_out_time: getCurrentTime(),
      check_out_method: request.method,
      check_out_type: request.checkOutType ?? (requiresModification ? 'MODIFICATION_REQUIRED' : 'ON_TIME'),
      check_out_lat: request.latitude ?? null,
      check_out_lng: request.longitude ?? null,
      status: 'CHECKED_OUT',
      // 定刻退勤の場合のみ実績を設定
      ...(actualStartTime && !requiresModification
        ? {
            actual_start_time: actualStartTime,
            actual_end_time: actualEndTime,
            actual_break_time: actualBreakTime,
            calculated_wage: calculatedWage,
          }
        : {}),
    },
  });

  return {
    success: true,
    attendanceId: attendance.id,
    requiresModification,
    isLate,
    message: requiresModification
      ? '退勤を記録しました。勤怠変更申請を行ってください。'
      : '退勤を記録しました。',
    scheduledTime: attendance.application
      ? {
          startTime: attendance.application.workDate.job.start_time,
          endTime: attendance.application.workDate.job.end_time,
          breakTime: parseInt(attendance.application.workDate.job.break_time, 10),
        }
      : undefined,
  };
}

// ================== 勤怠変更申請 ==================

/**
 * 勤怠変更申請を作成
 */
export async function createModificationRequest(
  request: CreateModificationRequest
): Promise<CreateModificationResponse> {
  try {
    const user = await getAuthenticatedUser();

    // 1. 勤怠記録の取得と権限確認
    const attendance = await prisma.attendance.findUnique({
      where: { id: request.attendanceId },
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
        facility: true,
        modificationRequest: true,
      },
    });

    if (!attendance) {
      return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT003) as unknown as CreateModificationResponse;
    }

    if (attendance.user_id !== user.id) {
      return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT008) as unknown as CreateModificationResponse;
    }

    // 既存の申請があるか確認
    if (attendance.modificationRequest) {
      return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT006) as unknown as CreateModificationResponse;
    }

    // 2. 金額計算
    const job = attendance.application?.workDate.job;
    const hourlyRate = job?.hourly_wage ?? 1000;
    const transportationFee = job?.transportation_fee ?? 0;

    // 定刻の金額
    let originalAmount = 0;
    if (job && attendance.application) {
      const workDate = attendance.application.workDate.work_date;
      const [startHour, startMinute] = job.start_time.split(':').map(Number);
      const [endHour, endMinute] = job.end_time.split(':').map(Number);
      const breakTimeMinutes = parseInt(job.break_time, 10);

      const scheduledStart = new Date(workDate);
      scheduledStart.setHours(startHour, startMinute, 0, 0);

      const scheduledEnd = new Date(workDate);
      scheduledEnd.setHours(endHour, endMinute, 0, 0);
      if (scheduledEnd <= scheduledStart) {
        scheduledEnd.setDate(scheduledEnd.getDate() + 1);
      }

      const originalResult = calculateSalary({
        startTime: scheduledStart,
        endTime: scheduledEnd,
        breakMinutes: breakTimeMinutes,
        hourlyRate,
      });
      originalAmount = originalResult.totalPay + transportationFee;
    }

    // 申請内容の金額
    const requestedStart = new Date(request.requestedStartTime);
    const requestedEnd = new Date(request.requestedEndTime);
    const requestedResult = calculateSalary({
      startTime: requestedStart,
      endTime: requestedEnd,
      breakMinutes: request.requestedBreakTime,
      hourlyRate,
    });
    const requestedAmount = requestedResult.totalPay + transportationFee;

    // 3. 勤怠変更申請を作成
    const modification = await prisma.attendanceModificationRequest.create({
      data: {
        attendance_id: request.attendanceId,
        requested_start_time: requestedStart,
        requested_end_time: requestedEnd,
        requested_break_time: request.requestedBreakTime,
        worker_comment: request.workerComment,
        status: 'PENDING',
        original_amount: originalAmount,
        requested_amount: requestedAmount,
      },
    });

    // 4. 施設への通知
    if (attendance.facility) {
      await sendNotification({
        notificationKey: 'ATTENDANCE_MODIFICATION_REQUESTED',
        targetType: 'FACILITY',
        recipientId: attendance.facility.id,
        recipientName: attendance.facility.facility_name,
        facilityEmails: attendance.facility.staff_emails,
        variables: {
          workerName: user.name,
          workDate: attendance.application?.workDate.work_date
            ? new Date(attendance.application.workDate.work_date).toLocaleDateString('ja-JP')
            : '',
          requestedStartTime: requestedStart.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          requestedEndTime: requestedEnd.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          requestedBreakTime: String(request.requestedBreakTime),
          workerComment: request.workerComment,
          approvalUrl: `${process.env.NEXTAUTH_URL}/admin/tasks/attendance/${modification.id}`,
        },
      });
    }

    return {
      success: true,
      modificationId: modification.id,
      originalAmount,
      requestedAmount,
      difference: requestedAmount - originalAmount,
      message: '勤怠変更申請を提出しました。',
    };
  } catch (error) {
    console.error('[createModificationRequest] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '勤怠変更申請の作成に失敗しました',
    };
  }
}

/**
 * 勤怠変更申請を再申請
 */
export async function resubmitModificationRequest(
  modificationId: number,
  request: UpdateModificationRequest
): Promise<CreateModificationResponse> {
  try {
    const user = await getAuthenticatedUser();

    // 1. 申請の取得と権限確認
    const modification = await prisma.attendanceModificationRequest.findUnique({
      where: { id: modificationId },
      include: {
        attendance: {
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
            facility: true,
          },
        },
      },
    });

    if (!modification) {
      return { success: false, message: '勤怠変更申請が見つかりません' };
    }

    if (modification.attendance.user_id !== user.id) {
      return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT008) as unknown as CreateModificationResponse;
    }

    // 却下済み以外は再申請不可
    if (modification.status !== 'REJECTED') {
      return { success: false, message: '却下された申請のみ再申請できます' };
    }

    // 再申請回数の制限確認
    if (modification.resubmit_count >= MAX_RESUBMIT_COUNT) {
      return { success: false, message: '再申請回数の上限に達しています' };
    }

    // 2. 金額計算
    const job = modification.attendance.application?.workDate.job;
    const hourlyRate = job?.hourly_wage ?? 1000;
    const transportationFee = job?.transportation_fee ?? 0;

    const requestedStart = new Date(request.requestedStartTime);
    const requestedEnd = new Date(request.requestedEndTime);
    const requestedResult = calculateSalary({
      startTime: requestedStart,
      endTime: requestedEnd,
      breakMinutes: request.requestedBreakTime,
      hourlyRate,
    });
    const requestedAmount = requestedResult.totalPay + transportationFee;

    // 3. 再申請として更新
    await prisma.attendanceModificationRequest.update({
      where: { id: modificationId },
      data: {
        requested_start_time: requestedStart,
        requested_end_time: requestedEnd,
        requested_break_time: request.requestedBreakTime,
        worker_comment: request.workerComment,
        status: 'RESUBMITTED',
        requested_amount: requestedAmount,
        resubmit_count: { increment: 1 },
        admin_comment: null,
        reviewed_by: null,
        reviewed_at: null,
      },
    });

    // 4. 施設への通知
    if (modification.attendance.facility) {
      await sendNotification({
        notificationKey: 'ATTENDANCE_MODIFICATION_REQUESTED',
        targetType: 'FACILITY',
        recipientId: modification.attendance.facility.id,
        recipientName: modification.attendance.facility.facility_name,
        facilityEmails: modification.attendance.facility.staff_emails,
        variables: {
          workerName: user.name,
          workDate: modification.attendance.application?.workDate.work_date
            ? new Date(modification.attendance.application.workDate.work_date).toLocaleDateString('ja-JP')
            : '',
          requestedStartTime: requestedStart.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          requestedEndTime: requestedEnd.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          requestedBreakTime: String(request.requestedBreakTime),
          workerComment: request.workerComment,
          approvalUrl: `${process.env.NEXTAUTH_URL}/admin/tasks/attendance/${modificationId}`,
        },
      });
    }

    return {
      success: true,
      modificationId,
      originalAmount: modification.original_amount,
      requestedAmount,
      difference: requestedAmount - modification.original_amount,
      message: '勤怠変更申請を再提出しました。',
    };
  } catch (error) {
    console.error('[resubmitModificationRequest] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '再申請に失敗しました',
    };
  }
}

// ================== 取得系 ==================

/**
 * 出勤状態を確認
 */
export async function getCheckInStatus(): Promise<CheckInStatusResponse> {
  try {
    const user = await getAuthenticatedUser();

    // 1. 現在の出勤状態を確認
    const attendance = await prisma.attendance.findFirst({
      where: {
        user_id: user.id,
        status: 'CHECKED_IN',
        check_out_time: null,
      },
      include: {
        facility: {
          select: {
            facility_name: true,
          },
        },
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
      orderBy: {
        check_in_time: 'desc',
      },
    });

    // 2. 本日の勤務予定があるか確認（出勤ボタン表示用）
    const todayStart = getTodayStart();
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayApplication = await prisma.application.findFirst({
      where: {
        user_id: user.id,
        status: 'SCHEDULED',
        workDate: {
          work_date: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
      },
    });

    const hasTodayJob = !!todayApplication;

    if (!attendance) {
      return { isCheckedIn: false, hasTodayJob };
    }

    // 遅刻判定
    let isLate = false;
    if (attendance.application) {
      const job = attendance.application.workDate.job;
      const workDate = attendance.application.workDate.work_date;
      const [startHour, startMinute] = job.start_time.split(':').map(Number);

      const scheduledStartTime = new Date(workDate);
      scheduledStartTime.setHours(startHour, startMinute, 0, 0);

      isLate = new Date(attendance.check_in_time) > scheduledStartTime;
    }

    return {
      isCheckedIn: true,
      attendanceId: attendance.id,
      checkInTime: attendance.check_in_time.toISOString(),
      isLate,
      usedEmergencyCode: attendance.check_in_method === 'EMERGENCY_CODE',
      facilityName: attendance.facility.facility_name,
      applicationId: attendance.application_id ?? undefined,
      hasTodayJob: true, // 出勤中なら本日の仕事あり
    };
  } catch (error) {
    console.error('[getCheckInStatus] Error:', error);
    return { isCheckedIn: false, hasTodayJob: false };
  }
}

/**
 * 勤怠履歴を取得
 */
export async function getMyAttendances(options?: {
  limit?: number;
  offset?: number;
}): Promise<AttendanceHistoryItem[]> {
  try {
    const user = await getAuthenticatedUser();
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const attendances = await prisma.attendance.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        facility: {
          select: {
            facility_name: true,
          },
        },
        application: {
          include: {
            workDate: {
              include: {
                job: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
        modificationRequest: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        check_in_time: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return attendances.map((att) => ({
      id: att.id,
      checkInTime: att.check_in_time,
      checkOutTime: att.check_out_time,
      status: att.status as 'CHECKED_IN' | 'CHECKED_OUT',
      facilityName: att.facility.facility_name,
      jobTitle: att.application?.workDate.job.title ?? '不明',
      workDate: att.application?.workDate.work_date ?? att.check_in_time,
      hasModificationRequest: !!att.modificationRequest,
      modificationStatus: att.modificationRequest?.status as any ?? null,
      calculatedWage: att.calculated_wage,
    }));
  } catch (error) {
    console.error('[getMyAttendances] Error:', error);
    return [];
  }
}

/**
 * 勤怠変更申請一覧を取得
 */
export async function getMyModificationRequests(): Promise<ModificationRequestDetail[]> {
  try {
    const user = await getAuthenticatedUser();

    const requests = await prisma.attendanceModificationRequest.findMany({
      where: {
        attendance: {
          user_id: user.id,
        },
      },
      include: {
        attendance: {
          include: {
            facility: {
              select: {
                facility_name: true,
              },
            },
            application: {
              include: {
                workDate: {
                  include: {
                    job: {
                      select: {
                        title: true,
                        start_time: true,
                        end_time: true,
                        break_time: true,
                        hourly_wage: true,
                        transportation_fee: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return requests.map((req) => ({
      id: req.id,
      attendanceId: req.attendance_id,
      requestedStartTime: req.requested_start_time,
      requestedEndTime: req.requested_end_time,
      requestedBreakTime: req.requested_break_time,
      workerComment: req.worker_comment,
      status: req.status as any,
      adminComment: req.admin_comment,
      reviewedBy: req.reviewed_by,
      reviewedAt: req.reviewed_at,
      originalAmount: req.original_amount,
      requestedAmount: req.requested_amount,
      resubmitCount: req.resubmit_count,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
    }));
  } catch (error) {
    console.error('[getMyModificationRequests] Error:', error);
    return [];
  }
}

/**
 * 特定の勤怠記録を取得
 */
export async function getAttendanceById(
  attendanceId: number
): Promise<any | null> {
  try {
    const user = await getAuthenticatedUser();

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        facility: true,
        application: {
          include: {
            workDate: {
              include: {
                job: true,
              },
            },
          },
        },
        modificationRequest: true,
      },
    });

    if (!attendance || attendance.user_id !== user.id) {
      return null;
    }

    return attendance;
  } catch (error) {
    console.error('[getAttendanceById] Error:', error);
    return null;
  }
}

// ================== ヘルパー関数 ==================

/**
 * QRコードまたは緊急番号を検証
 */
async function validateAttendanceMethod(
  request: AttendanceRecordRequest
): Promise<{ id: number; facility_name: string } | null> {
  if (request.method === 'QR') {
    if (!request.facilityId || !request.qrToken) {
      return null;
    }

    const facility = await prisma.facility.findUnique({
      where: { id: request.facilityId },
      select: {
        id: true,
        facility_name: true,
        qr_secret_token: true,
      },
    });

    if (!facility) {
      return null;
    }

    // secretTokenが設定されている場合は検証
    if (facility.qr_secret_token && facility.qr_secret_token !== request.qrToken) {
      return null;
    }

    return { id: facility.id, facility_name: facility.facility_name };
  } else {
    // 緊急番号
    if (!request.emergencyCode) {
      return null;
    }

    const facility = await prisma.facility.findFirst({
      where: {
        emergency_attendance_code: request.emergencyCode,
      },
      select: {
        id: true,
        facility_name: true,
      },
    });

    return facility;
  }
}

/**
 * 当日の応募（マッチング済み）を検索
 */
async function findTodayApplication(
  userId: number,
  facilityId: number
): Promise<{
  id: number;
  workDate: {
    work_date: Date;
    job_id: number;
    job: {
      id: number;
      start_time: string;
      end_time: string;
      break_time: string;
      hourly_wage: number;
      transportation_fee: number;
    };
  };
} | null> {
  const todayStart = getTodayStart();
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const application = await prisma.application.findFirst({
    where: {
      user_id: userId,
      status: 'SCHEDULED',
      workDate: {
        job: {
          facility_id: facilityId,
        },
        work_date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    },
    include: {
      workDate: {
        include: {
          job: {
            select: {
              id: true,
              start_time: true,
              end_time: true,
              break_time: true,
              hourly_wage: true,
              transportation_fee: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    return null;
  }

  return {
    id: application.id,
    workDate: {
      work_date: application.workDate.work_date,
      job_id: application.workDate.job_id,
      job: {
        id: application.workDate.job.id,
        start_time: application.workDate.job.start_time,
        end_time: application.workDate.job.end_time,
        break_time: application.workDate.job.break_time,
        hourly_wage: application.workDate.job.hourly_wage,
        transportation_fee: application.workDate.job.transportation_fee,
      },
    },
  };
}
