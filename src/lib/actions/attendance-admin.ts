'use server';

/**
 * QRコード勤怠管理機能 - 施設管理者向けServer Actions
 */

import { prisma } from '@/lib/prisma';
import { getCurrentTime } from './helpers';
import { calculateSalary } from '@/src/lib/salary-calculator';
import { sendNotification } from '@/src/lib/notification-service';
import { randomBytes } from 'crypto';
import {
  ATTENDANCE_ERROR_CODES,
  createAttendanceError,
} from '@/src/constants/attendance-errors';
import type {
  PendingModificationItem,
  ModificationRequestDetail,
  ApproveRejectRequest,
  ApproveRejectResponse,
  RegenerateQRResponse,
} from '@/src/types/attendance';

// ================== 認証ヘルパー ==================

/**
 * 施設管理者を取得（facilityIdを引数として受け取る）
 * 注: 実際の認証はフロントエンド側のAdminAuthContextで行われる
 */
async function getFacilityById(facilityId: number) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  });

  if (!facility) {
    throw new Error('施設が見つかりません');
  }

  return facility;
}

// ================== 勤怠承認 ==================

/**
 * 承認待ち勤怠変更申請一覧を取得
 */
export async function getPendingModificationRequests(
  facilityId: number,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: PendingModificationItem[]; total: number }> {
  try {
    await getFacilityById(facilityId);

    const whereClause: any = {
      attendance: {
        facility_id: facilityId,
      },
    };

    // ステータスフィルター
    if (options?.status === 'all') {
      // 'all'の場合はステータス条件を設定しない（全て表示）
    } else if (options?.status) {
      // 特定ステータスが指定された場合
      whereClause.status = options.status;
    } else {
      // デフォルト（statusが未指定）は承認待ち（PENDING, RESUBMITTED）
      whereClause.status = { in: ['PENDING', 'RESUBMITTED'] };
    }

    const [items, total] = await Promise.all([
      prisma.attendanceModificationRequest.findMany({
        where: whereClause,
        include: {
          attendance: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
              facility: {
                select: {
                  id: true,
                  facility_name: true,
                },
              },
              // 直接jobリレーションを取得
              job: {
                select: {
                  id: true,
                  title: true,
                  start_time: true,
                  end_time: true,
                },
              },
              application: {
                include: {
                  workDate: {
                    select: {
                      work_date: true,
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
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.attendanceModificationRequest.count({
        where: whereClause,
      }),
    ]);

    return {
      items: items.map((req) => ({
        id: req.id,
        attendanceId: req.attendance_id,
        workerName: req.attendance.user.name,
        workerId: req.attendance.user.id,
        applicationId: req.attendance.application_id,
        // 直接job_idとjobリレーションから取得
        jobId: req.attendance.job_id ?? 0,
        jobTitle: req.attendance.job?.title ?? '不明',
        workDate: req.attendance.application?.workDate.work_date ?? req.created_at,
        scheduledStartTime: req.attendance.job?.start_time ?? '',
        scheduledEndTime: req.attendance.job?.end_time ?? '',
        status: req.status as any,
        requestedStartTime: req.requested_start_time,
        requestedEndTime: req.requested_end_time,
        requestedBreakTime: req.requested_break_time,
        originalAmount: req.original_amount,
        requestedAmount: req.requested_amount,
        workerComment: req.worker_comment,
        createdAt: req.created_at,
        resubmitCount: req.resubmit_count,
        facilityName: req.attendance.facility.facility_name,
      })),
      total,
    };
  } catch (error) {
    console.error('[getPendingModificationRequests] Error:', error);
    return { items: [], total: 0 };
  }
}

/**
 * 勤怠変更申請詳細を取得
 */
export async function getModificationRequestDetail(
  facilityId: number,
  modificationId: number
): Promise<ModificationRequestDetail | null> {
  try {
    await getFacilityById(facilityId);

    const request = await prisma.attendanceModificationRequest.findUnique({
      where: { id: modificationId },
      include: {
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profile_image: true,
              },
            },
            facility: {
              select: {
                id: true,
                facility_name: true,
              },
            },
            application: {
              include: {
                workDate: {
                  include: {
                    job: {
                      select: {
                        id: true,
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
    });

    if (!request) {
      return null;
    }

    // 権限確認
    if (request.attendance.facility_id !== facilityId) {
      return null;
    }

    return {
      id: request.id,
      attendanceId: request.attendance_id,
      requestedStartTime: request.requested_start_time,
      requestedEndTime: request.requested_end_time,
      requestedBreakTime: request.requested_break_time,
      workerComment: request.worker_comment,
      status: request.status as any,
      adminComment: request.admin_comment,
      reviewedBy: request.reviewed_by,
      reviewedAt: request.reviewed_at,
      originalAmount: request.original_amount,
      requestedAmount: request.requested_amount,
      resubmitCount: request.resubmit_count,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
      attendance: {
        id: request.attendance.id,
        userId: request.attendance.user_id,
        facilityId: request.attendance.facility_id,
        applicationId: request.attendance.application_id,
        jobId: request.attendance.job_id,
        checkInTime: request.attendance.check_in_time,
        checkOutTime: request.attendance.check_out_time,
        checkInLat: request.attendance.check_in_lat,
        checkInLng: request.attendance.check_in_lng,
        checkOutLat: request.attendance.check_out_lat,
        checkOutLng: request.attendance.check_out_lng,
        checkInMethod: request.attendance.check_in_method as any,
        checkOutMethod: request.attendance.check_out_method as any,
        checkOutType: request.attendance.check_out_type as any,
        status: request.attendance.status as any,
        actualStartTime: request.attendance.actual_start_time,
        actualEndTime: request.attendance.actual_end_time,
        actualBreakTime: request.attendance.actual_break_time,
        calculatedWage: request.attendance.calculated_wage,
        createdAt: request.attendance.created_at,
        updatedAt: request.attendance.updated_at,
        user: {
          id: request.attendance.user.id,
          name: request.attendance.user.name,
          email: request.attendance.user.email,
          profileImage: request.attendance.user.profile_image,
        },
        facility: {
          id: request.attendance.facility.id,
          facilityName: request.attendance.facility.facility_name,
        },
        application: request.attendance.application
          ? {
              id: request.attendance.application.id,
              workDate: {
                workDate: request.attendance.application.workDate.work_date,
                job: {
                  id: request.attendance.application.workDate.job.id,
                  title: request.attendance.application.workDate.job.title,
                  startTime: request.attendance.application.workDate.job.start_time,
                  endTime: request.attendance.application.workDate.job.end_time,
                  breakTime: request.attendance.application.workDate.job.break_time,
                  hourlyWage: request.attendance.application.workDate.job.hourly_wage,
                  transportationFee: request.attendance.application.workDate.job.transportation_fee,
                },
              },
            }
          : undefined,
      },
    };
  } catch (error) {
    console.error('[getModificationRequestDetail] Error:', error);
    return null;
  }
}

/**
 * 勤怠変更申請を承認
 */
export async function approveModificationRequest(
  facilityId: number,
  modificationId: number,
  request: ApproveRejectRequest
): Promise<ApproveRejectResponse> {
  try {
    const facility = await getFacilityById(facilityId);

    // 1. 申請の取得と権限確認
    const modification = await prisma.attendanceModificationRequest.findUnique({
      where: { id: modificationId },
      include: {
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
          },
        },
      },
    });

    if (!modification) {
      return { success: false, message: '申請が見つかりません' };
    }

    if (modification.attendance.facility_id !== facilityId) {
      return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT007) as unknown as ApproveRejectResponse;
    }

    // 承認可能なステータスか確認
    if (!['PENDING', 'RESUBMITTED'].includes(modification.status)) {
      return { success: false, message: 'この申請は既に処理済みです' };
    }

    // 2. トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // 申請を承認
      await tx.attendanceModificationRequest.update({
        where: { id: modificationId },
        data: {
          status: 'APPROVED',
          admin_comment: request.adminComment,
          reviewed_by: facilityId,
          reviewed_at: getCurrentTime(),
          updated_by: -facilityId, // 負の値 = 施設管理者による更新
        },
      });

      // Attendanceの実績時間を更新
      await tx.attendance.update({
        where: { id: modification.attendance_id },
        data: {
          actual_start_time: modification.requested_start_time,
          actual_end_time: modification.requested_end_time,
          actual_break_time: modification.requested_break_time,
          calculated_wage: modification.requested_amount,
          updated_by: -facilityId, // 負の値 = 施設管理者による更新
        },
      });
    });

    // 3. ワーカーへの通知
    const applicationId = modification.attendance.application?.id;
    await sendNotification({
      notificationKey: 'ATTENDANCE_MODIFICATION_APPROVED',
      targetType: 'WORKER',
      recipientId: modification.attendance.user.id,
      recipientName: modification.attendance.user.name,
      recipientEmail: modification.attendance.user.email,
      applicationId: applicationId,
      variables: {
        work_date: modification.attendance.application?.workDate.work_date
          ? new Date(modification.attendance.application.workDate.work_date).toLocaleDateString('ja-JP')
          : '',
        facility_name: modification.attendance.facility.facility_name,
        approved_start_time: modification.requested_start_time.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        approved_end_time: modification.requested_end_time.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        approved_break_time: String(modification.requested_break_time),
        confirmed_wage: String(modification.requested_amount),
        admin_comment: request.adminComment,
        worker_name: modification.attendance.user.name,
      },
      chatMessageData: applicationId ? {
        jobId: modification.attendance.application!.workDate.job_id,
        fromFacilityId: modification.attendance.facility_id,
        toUserId: modification.attendance.user.id,
      } : undefined,
    });

    return {
      success: true,
      message: '勤怠変更申請を承認しました',
    };
  } catch (error) {
    console.error('[approveModificationRequest] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '承認に失敗しました',
    };
  }
}

/**
 * 勤怠変更申請を却下
 */
export async function rejectModificationRequest(
  facilityId: number,
  modificationId: number,
  request: ApproveRejectRequest
): Promise<ApproveRejectResponse> {
  try {
    await getFacilityById(facilityId);

    // 1. 申請の取得と権限確認
    const modification = await prisma.attendanceModificationRequest.findUnique({
      where: { id: modificationId },
      include: {
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            facility: true,
            application: {
              include: {
                workDate: true,
              },
            },
          },
        },
      },
    });

    if (!modification) {
      return { success: false, message: '申請が見つかりません' };
    }

    if (modification.attendance.facility_id !== facilityId) {
      return createAttendanceError(ATTENDANCE_ERROR_CODES.ATT007) as unknown as ApproveRejectResponse;
    }

    // 却下可能なステータスか確認
    if (!['PENDING', 'RESUBMITTED'].includes(modification.status)) {
      return { success: false, message: 'この申請は既に処理済みです' };
    }

    // 2. 申請を却下
    await prisma.attendanceModificationRequest.update({
      where: { id: modificationId },
      data: {
        status: 'REJECTED',
        admin_comment: request.adminComment,
        reviewed_by: facilityId,
        reviewed_at: getCurrentTime(),
        updated_by: -facilityId, // 負の値 = 施設管理者による更新
      },
    });

    // 3. ワーカーへの通知
    const applicationId = modification.attendance.application?.id;
    await sendNotification({
      notificationKey: 'ATTENDANCE_MODIFICATION_REJECTED',
      targetType: 'WORKER',
      recipientId: modification.attendance.user.id,
      recipientName: modification.attendance.user.name,
      recipientEmail: modification.attendance.user.email,
      applicationId: applicationId,
      variables: {
        work_date: modification.attendance.application?.workDate.work_date
          ? new Date(modification.attendance.application.workDate.work_date).toLocaleDateString('ja-JP')
          : '',
        facility_name: modification.attendance.facility.facility_name,
        admin_comment: request.adminComment,
        resubmit_url: `${process.env.NEXTAUTH_URL}/attendance/modify?resubmit=${modificationId}`,
        worker_name: modification.attendance.user.name,
      },
      chatMessageData: applicationId ? {
        jobId: modification.attendance.application!.workDate.job_id,
        fromFacilityId: modification.attendance.facility_id,
        toUserId: modification.attendance.user.id,
      } : undefined,
    });

    return {
      success: true,
      message: '勤怠変更申請を却下しました',
    };
  } catch (error) {
    console.error('[rejectModificationRequest] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '却下に失敗しました',
    };
  }
}

// ================== QRコード管理 ==================

/**
 * QRコードのシークレットトークンを再発行
 */
export async function regenerateQRCode(facilityId: number): Promise<RegenerateQRResponse> {
  try {
    await getFacilityById(facilityId);

    // 新しいトークンを生成
    const newToken = randomBytes(32).toString('hex');
    const now = getCurrentTime();

    // 更新
    await prisma.facility.update({
      where: { id: facilityId },
      data: {
        qr_secret_token: newToken,
        qr_generated_at: now,
      },
    });

    return {
      success: true,
      qrToken: newToken,
      generatedAt: now.toISOString(),
      message: 'QRコードを再発行しました',
    };
  } catch (error) {
    console.error('[regenerateQRCode] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'QRコードの再発行に失敗しました',
    };
  }
}

/**
 * 緊急時出退勤番号を更新
 */
export async function updateEmergencyCode(
  facilityId: number,
  code: string
): Promise<{ success: boolean; message: string }> {
  try {
    await getFacilityById(facilityId);

    // 4桁の数字かバリデーション
    if (!/^\d{4}$/.test(code)) {
      return { success: false, message: '4桁の数字を入力してください' };
    }

    // 他施設で使用されていないか確認
    const existing = await prisma.facility.findFirst({
      where: {
        emergency_attendance_code: code,
        id: { not: facilityId },
      },
    });

    if (existing) {
      return { success: false, message: 'この番号は既に使用されています' };
    }

    await prisma.facility.update({
      where: { id: facilityId },
      data: {
        emergency_attendance_code: code,
      },
    });

    return {
      success: true,
      message: '緊急時出退勤番号を更新しました',
    };
  } catch (error) {
    console.error('[updateEmergencyCode] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '更新に失敗しました',
    };
  }
}

/**
 * 施設の勤怠設定を取得
 */
export async function getFacilityAttendanceSettings(facilityId: number): Promise<{
  emergencyCode: string | null;
  qrSecretToken: string | null;
  qrGeneratedAt: Date | null;
} | null> {
  try {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: {
        emergency_attendance_code: true,
        qr_secret_token: true,
        qr_generated_at: true,
      },
    });

    if (!facility) {
      return null;
    }

    return {
      emergencyCode: facility.emergency_attendance_code,
      qrSecretToken: facility.qr_secret_token,
      qrGeneratedAt: facility.qr_generated_at,
    };
  } catch (error) {
    console.error('[getFacilityAttendanceSettings] Error:', error);
    return null;
  }
}

// ================== 利用明細 ==================

/** 手数料率（施設が支払うプラットフォーム手数料） */
const PLATFORM_FEE_RATE = 0.30; // 30%

/** 消費税率 */
const TAX_RATE = 0.10; // 10%

/** 利用明細アイテム（カイテク仕様準拠） */
export interface UsageDetailItem {
  id: number;
  jobId: number;
  workDate: Date;
  workDateTime: string; // 日時（例: 2025/10/23 (木)17:00 〜 18:00）
  facilityName: string;
  workerName: string;
  workerId: number;
  jobTitle: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  scheduledStartTime: string;
  scheduledEndTime: string;
  scheduledBreakTime: number;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  actualBreakTime: number | null;
  calculatedWage: number | null;
  transportationFee: number;
  platformFee: number;        // 手数料（給与×手数料率）
  tax: number;                // 税額（手数料×消費税率）
  totalAmount: number;        // 合計（給与+交通費+手数料+税額）
  hourlyWage: number;
  modificationStatus: string | null;
  attendanceStatus: string;
}

/**
 * 利用明細一覧を取得
 */
export async function getUsageDetails(
  facilityId: number,
  options?: {
    year?: number;
    month?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: UsageDetailItem[]; total: number }> {
  try {
    await getFacilityById(facilityId);

    // 年月の指定がない場合は当月
    const now = getCurrentTime();
    const year = options?.year ?? now.getFullYear();
    const month = options?.month ?? now.getMonth() + 1;

    // 月の開始日と終了日
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const whereClause: any = {
      facility_id: facilityId,
      status: 'CHECKED_OUT', // 退勤済みのみ
      check_in_time: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          facility: {
            select: {
              id: true,
              facility_name: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              start_time: true,
              end_time: true,
              break_time: true,
              hourly_wage: true,
              transportation_fee: true,
            },
          },
          application: {
            select: {
              id: true,
              workDate: {
                select: {
                  work_date: true,
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
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      prisma.attendance.count({
        where: whereClause,
      }),
    ]);

    return {
      items: items.map((att) => {
        const wage = att.calculated_wage ?? 0;
        const transportationFee = att.job?.transportation_fee ?? 0;
        const platformFee = Math.floor(wage * PLATFORM_FEE_RATE);
        const tax = Math.floor(platformFee * TAX_RATE);
        const totalAmount = wage + transportationFee + platformFee + tax;

        // 勤務日時を「2025/10/23 (木)17:00 〜 18:00」形式で生成
        const workDate = att.application?.workDate.work_date ?? att.check_in_time;
        const dateObj = new Date(workDate);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const weekday = weekdays[dateObj.getDay()];
        const dateStr = dateObj.toLocaleDateString('ja-JP');
        const startTime = att.job?.start_time ?? '';
        const endTime = att.job?.end_time ?? '';
        const workDateTime = `${dateStr} (${weekday})${startTime} 〜 ${endTime}`;

        return {
          id: att.id,
          jobId: att.job_id ?? 0,
          workDate,
          workDateTime,
          facilityName: att.facility.facility_name,
          workerName: att.user.name,
          workerId: att.user.id,
          jobTitle: att.job?.title ?? '不明',
          checkInTime: att.check_in_time,
          checkOutTime: att.check_out_time,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          scheduledBreakTime: parseInt(att.job?.break_time ?? '0', 10),
          actualStartTime: att.actual_start_time,
          actualEndTime: att.actual_end_time,
          actualBreakTime: att.actual_break_time,
          calculatedWage: wage,
          transportationFee,
          platformFee,
          tax,
          totalAmount,
          hourlyWage: att.job?.hourly_wage ?? 0,
          modificationStatus: att.modificationRequest?.status ?? null,
          attendanceStatus: att.status,
        };
      }),
      total,
    };
  } catch (error) {
    console.error('[getUsageDetails] Error:', error);
    return { items: [], total: 0 };
  }
}

/**
 * 利用明細をCSV形式で取得（カイテク仕様準拠）
 */
export async function getUsageDetailsCSV(
  facilityId: number,
  options?: {
    year?: number;
    month?: number;
  }
): Promise<string> {
  try {
    const { items } = await getUsageDetails(facilityId, {
      ...options,
      limit: 10000, // CSVは全件取得
    });

    // CSVヘッダー（カイテク仕様）
    const headers = [
      '案件ID',
      '日時',
      '事業所',
      'ワーカー',
      '出勤時刻',
      '退勤時刻',
      '休憩時間',
      '給与',
      '交通費',
      '手数料',
      '税額',
      '合計',
    ];

    // CSV行を生成
    const rows = items.map((item) => {
      const checkIn = item.actualStartTime
        ? new Date(item.actualStartTime).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      const checkOut = item.actualEndTime
        ? new Date(item.actualEndTime).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      return [
        item.jobId,
        item.workDateTime,
        item.facilityName,
        item.workerName,
        checkIn,
        checkOut,
        item.actualBreakTime ?? 0,
        item.calculatedWage ?? 0,
        item.transportationFee,
        item.platformFee,
        item.tax,
        item.totalAmount,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  } catch (error) {
    console.error('[getUsageDetailsCSV] Error:', error);
    return '';
  }
}

/** ステータスラベル変換 */
function getModificationStatusLabel(status: string | null): string {
  switch (status) {
    case 'PENDING':
      return '申請中';
    case 'RESUBMITTED':
      return '再申請';
    case 'APPROVED':
      return '承認済';
    case 'REJECTED':
      return '却下';
    default:
      return '確定';
  }
}

// ================== 統計 ==================

/**
 * 承認待ち件数を取得
 */
export async function getPendingModificationCount(facilityId: number): Promise<number> {
  try {
    const count = await prisma.attendanceModificationRequest.count({
      where: {
        attendance: {
          facility_id: facilityId,
        },
        status: { in: ['PENDING', 'RESUBMITTED'] },
      },
    });

    return count;
  } catch (error) {
    console.error('[getPendingModificationCount] Error:', error);
    return 0;
  }
}
