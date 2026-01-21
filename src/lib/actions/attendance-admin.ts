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
    if (options?.status && options.status !== 'all') {
      whereClause.status = options.status;
    } else {
      // デフォルトは承認待ち（PENDING, RESUBMITTED）
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
              application: {
                include: {
                  workDate: {
                    include: {
                      job: {
                        select: {
                          id: true,
                          title: true,
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
        jobId: req.attendance.application?.workDate.job.id ?? 0,
        jobTitle: req.attendance.application?.workDate.job.title ?? '不明',
        workDate: req.attendance.application?.workDate.work_date ?? req.created_at,
        status: req.status as any,
        requestedStartTime: req.requested_start_time,
        requestedEndTime: req.requested_end_time,
        requestedBreakTime: req.requested_break_time,
        originalAmount: req.original_amount,
        requestedAmount: req.requested_amount,
        workerComment: req.worker_comment,
        createdAt: req.created_at,
        resubmitCount: req.resubmit_count,
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
        },
      });
    });

    // 3. ワーカーへの通知
    await sendNotification({
      notificationKey: 'ATTENDANCE_MODIFICATION_APPROVED',
      targetType: 'WORKER',
      recipientId: modification.attendance.user.id,
      recipientName: modification.attendance.user.name,
      recipientEmail: modification.attendance.user.email,
      variables: {
        workDate: modification.attendance.application?.workDate.work_date
          ? new Date(modification.attendance.application.workDate.work_date).toLocaleDateString('ja-JP')
          : '',
        facilityName: modification.attendance.facility.facility_name,
        approvedStartTime: modification.requested_start_time.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        approvedEndTime: modification.requested_end_time.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        approvedBreakTime: String(modification.requested_break_time),
        confirmedWage: String(modification.requested_amount),
        adminComment: request.adminComment,
      },
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
      },
    });

    // 3. ワーカーへの通知
    await sendNotification({
      notificationKey: 'ATTENDANCE_MODIFICATION_REJECTED',
      targetType: 'WORKER',
      recipientId: modification.attendance.user.id,
      recipientName: modification.attendance.user.name,
      recipientEmail: modification.attendance.user.email,
      variables: {
        workDate: modification.attendance.application?.workDate.work_date
          ? new Date(modification.attendance.application.workDate.work_date).toLocaleDateString('ja-JP')
          : '',
        facilityName: modification.attendance.facility.facility_name,
        adminComment: request.adminComment,
        resubmitUrl: `${process.env.NEXTAUTH_URL}/attendance/modify?resubmit=${modificationId}`,
      },
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
