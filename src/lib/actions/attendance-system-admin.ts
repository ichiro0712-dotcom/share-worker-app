'use server';

/**
 * QRコード勤怠管理機能 - システム管理者向けServer Actions
 */

import { prisma } from '@/lib/prisma';
import { getCurrentTime } from './helpers';
import { calculateSalary } from '@/src/lib/salary-calculator';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import type {
  AttendanceFilter,
  AttendanceSortOption,
  AttendanceExportRow,
} from '@/src/types/attendance';

// ================== 認証ヘルパー ==================

/**
 * システム管理者認証チェック（簡易版）
 * TODO: 実際の認証実装に合わせて修正
 */
async function checkSystemAdminAuth(): Promise<boolean> {
  // 本番環境ではセッションベースの認証を実装
  return true;
}

// ================== 勤務実績管理 ==================

/**
 * 全勤務実績を取得
 */
export async function getAllAttendances(options?: {
  filter?: AttendanceFilter;
  sort?: AttendanceSortOption;
  limit?: number;
  offset?: number;
}): Promise<{
  items: any[];
  total: number;
}> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { items: [], total: 0 };
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const filter = options?.filter;

    // WHERE句の構築
    const whereClause: any = {};

    if (filter?.facilityId) {
      whereClause.facility_id = filter.facilityId;
    }

    if (filter?.workerId) {
      whereClause.user_id = filter.workerId;
    }

    if (filter?.status) {
      whereClause.status = filter.status;
    }

    if (filter?.dateFrom || filter?.dateTo) {
      whereClause.check_in_time = {};
      if (filter?.dateFrom) {
        whereClause.check_in_time.gte = filter.dateFrom;
      }
      if (filter?.dateTo) {
        whereClause.check_in_time.lte = filter.dateTo;
      }
    }

    // 施設名で絞り込み（部分一致）
    if (filter?.facilityName) {
      whereClause.facility = {
        ...whereClause.facility,
        facility_name: { contains: filter.facilityName, mode: 'insensitive' },
      };
    }

    // 法人名で絞り込み（部分一致）
    if (filter?.corporationName) {
      whereClause.facility = {
        ...whereClause.facility,
        corporation_name: { contains: filter.corporationName, mode: 'insensitive' },
      };
    }

    // ワーカー名またはメールで絞り込み（部分一致）
    if (filter?.workerSearch) {
      whereClause.user = {
        OR: [
          { name: { contains: filter.workerSearch, mode: 'insensitive' } },
          { email: { contains: filter.workerSearch, mode: 'insensitive' } },
        ],
      };
    }

    // ソート
    const orderBy: any = {};
    if (options?.sort) {
      orderBy[options.sort.field === 'workDate' ? 'check_in_time' : options.sort.field] =
        options.sort.direction;
    } else {
      orderBy.check_in_time = 'desc';
    }

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          facility: {
            select: {
              id: true,
              facility_name: true,
              corporation_name: true,
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
          modificationRequest: {
            select: {
              id: true,
              status: true,
              requested_start_time: true,
              requested_end_time: true,
              requested_break_time: true,
              requested_amount: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.attendance.count({ where: whereClause }),
    ]);

    return {
      items: items.map((att) => {
        const scheduledStartTime = att.application?.workDate.job.start_time;
        const scheduledEndTime = att.application?.workDate.job.end_time;
        const scheduledBreakTime = att.application?.workDate.job.break_time
          ? parseInt(att.application.workDate.job.break_time)
          : 0;

        // 遅刻・早退・残業フラグの計算
        // JST（日本時間）で比較するため、UTCからJSTに変換
        let isLate = false;
        let isEarlyLeave = false;
        let isOvertime = false;

        // DateをJST時刻（時:分）に変換するヘルパー
        const getJSTHoursMinutes = (date: Date): { hours: number; minutes: number } => {
          // JSTはUTC+9
          const jstOffset = 9 * 60; // 分
          const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
          const jstMinutes = (utcMinutes + jstOffset) % (24 * 60);
          return {
            hours: Math.floor(jstMinutes / 60),
            minutes: jstMinutes % 60,
          };
        };

        if (scheduledStartTime && att.actual_start_time) {
          const [schedH, schedM] = scheduledStartTime.split(':').map(Number);
          const actualStart = new Date(att.actual_start_time);
          const { hours: actualH, minutes: actualM } = getJSTHoursMinutes(actualStart);
          // 実績開始が定刻より遅い場合は遅刻
          if (actualH * 60 + actualM > schedH * 60 + schedM) {
            isLate = true;
          }
        }

        if (scheduledEndTime && att.actual_end_time) {
          const [schedH, schedM] = scheduledEndTime.split(':').map(Number);
          const actualEnd = new Date(att.actual_end_time);
          const { hours: actualH, minutes: actualM } = getJSTHoursMinutes(actualEnd);
          // 実績終了が定刻より早い場合は早退
          if (actualH * 60 + actualM < schedH * 60 + schedM) {
            isEarlyLeave = true;
          }
          // 実績終了が定刻より遅い場合は残業
          if (actualH * 60 + actualM > schedH * 60 + schedM) {
            isOvertime = true;
          }
        }

        return {
          id: att.id,
          userId: att.user_id,
          userName: att.user.name,
          userEmail: att.user.email,
          facilityId: att.facility_id,
          facilityName: att.facility.facility_name,
          corporationName: att.facility.corporation_name,
          jobId: att.application?.workDate.job.id,
          jobTitle: att.application?.workDate.job.title ?? '不明',
          workDate: att.application?.workDate.work_date ?? att.check_in_time,
          checkInTime: att.check_in_time,
          checkOutTime: att.check_out_time,
          checkInMethod: att.check_in_method,
          checkOutMethod: att.check_out_method,
          status: att.status,
          actualStartTime: att.actual_start_time,
          actualEndTime: att.actual_end_time,
          actualBreakTime: att.actual_break_time,
          calculatedWage: att.calculated_wage,
          // 交通費と時給
          transportationFee: att.application?.workDate.job.transportation_fee ?? 0,
          hourlyWage: att.application?.workDate.job.hourly_wage ?? 0,
          scheduledStartTime,
          scheduledEndTime,
          scheduledBreakTime,
          hasModificationRequest: !!att.modificationRequest,
          modificationStatus: att.modificationRequest?.status,
          // 遅刻・早退・残業フラグ
          isLate,
          isEarlyLeave,
          isOvertime,
        };
      }),
      total,
    };
  } catch (error) {
    console.error('[getAllAttendances] Error:', error);
    return { items: [], total: 0 };
  }
}

/**
 * 勤務実績をCSV形式でエクスポート
 * CROSSNAVI連携用36項目（35項目 + ワーカー名）
 */
export async function exportAttendancesCsv(options: {
  dateFrom?: Date | string;
  dateTo?: Date | string;
  facilityId?: number;
  facilityName?: string;
  corporationName?: string;
  workerSearch?: string;
  status?: 'CHECKED_IN' | 'CHECKED_OUT';
}): Promise<{ success: boolean; csvData?: string; count?: number; error?: string }> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { success: false, error: '認証エラー' };
    }

    // Date型またはstring型をDate型に変換
    const dateFrom = options.dateFrom ? new Date(options.dateFrom) : undefined;
    const dateTo = options.dateTo ? new Date(options.dateTo) : undefined;

    const whereClause: any = {};

    // 期間フィルター
    if (dateFrom || dateTo) {
      whereClause.check_in_time = {};
      if (dateFrom) {
        whereClause.check_in_time.gte = dateFrom;
      }
      if (dateTo) {
        whereClause.check_in_time.lte = dateTo;
      }
    }

    // ステータスフィルター（指定がなければ退勤済みのみ）
    if (options.status) {
      whereClause.status = options.status;
    } else {
      whereClause.status = 'CHECKED_OUT';
    }

    if (options.facilityId) {
      whereClause.facility_id = options.facilityId;
    }

    // 施設名フィルター
    if (options.facilityName) {
      whereClause.facility = {
        ...whereClause.facility,
        facility_name: { contains: options.facilityName, mode: 'insensitive' },
      };
    }

    // 法人名フィルター
    if (options.corporationName) {
      whereClause.facility = {
        ...whereClause.facility,
        corporation_name: { contains: options.corporationName, mode: 'insensitive' },
      };
    }

    // ワーカー検索フィルター
    if (options.workerSearch) {
      whereClause.user = {
        OR: [
          { name: { contains: options.workerSearch, mode: 'insensitive' } },
          { email: { contains: options.workerSearch, mode: 'insensitive' } },
        ],
      };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
                    transportation_fee: true,
                    hourly_wage: true,  // 時給（深夜・残業計算に必要）
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        check_in_time: 'asc',
      },
    });

    // CROSSNAVI連携用データ形式に変換
    const attendanceData = attendances.map((att) => ({
      id: att.id,
      user_id: att.user_id,
      check_in_time: att.check_in_time,
      check_out_time: att.check_out_time,
      actual_start_time: att.actual_start_time,
      actual_end_time: att.actual_end_time,
      actual_break_time: att.actual_break_time,
      status: att.status,
      user: {
        id: att.user.id,
        name: att.user.name,
        email: att.user.email,
      },
      job: att.application?.workDate.job ? {
        id: att.application.workDate.job.id,
        title: att.application.workDate.job.title,
        start_time: att.application.workDate.job.start_time,
        end_time: att.application.workDate.job.end_time,
        break_time: att.application.workDate.job.break_time,
        transportation_fee: att.application.workDate.job.transportation_fee,
        hourly_wage: att.application.workDate.job.hourly_wage,  // 時給追加
      } : null,
      facility: {
        id: att.facility.id,
        facility_name: att.facility.facility_name,
      },
    }));

    // CROSSNAVI連携用CSV生成（36項目）
    try {
      const { generateAttendanceInfoCsv } = await import('@/src/lib/csv-export/attendance-info-csv');
      const csvData = generateAttendanceInfoCsv(attendanceData);
      return { success: true, csvData, count: attendances.length };
    } catch (csvError) {
      console.error('[exportAttendancesCsv] CSV generation error:', csvError);
      console.error('[exportAttendancesCsv] Sample data:', JSON.stringify(attendanceData.slice(0, 2), null, 2));
      return { success: false, error: `CSV生成エラー: ${csvError instanceof Error ? csvError.message : 'Unknown error'}` };
    }
  } catch (error) {
    console.error('[exportAttendancesCsv] Error:', error);
    return { success: false, error: `エクスポートに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * 統計サマリーを取得
 */
export async function getAttendanceStats(options?: {
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{
  totalAttendances: number;
  pendingModifications: number;
  totalWage: number;
}> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { totalAttendances: 0, pendingModifications: 0, totalWage: 0 };
    }

    const whereClause: any = {};
    if (options?.dateFrom || options?.dateTo) {
      whereClause.check_in_time = {};
      if (options?.dateFrom) {
        whereClause.check_in_time.gte = options.dateFrom;
      }
      if (options?.dateTo) {
        whereClause.check_in_time.lte = options.dateTo;
      }
    }

    const [totalAttendances, pendingModifications, wageSum] = await Promise.all([
      prisma.attendance.count({ where: whereClause }),
      prisma.attendanceModificationRequest.count({
        where: {
          status: { in: ['PENDING', 'RESUBMITTED'] },
        },
      }),
      prisma.attendance.aggregate({
        where: {
          ...whereClause,
          calculated_wage: { not: null },
        },
        _sum: {
          calculated_wage: true,
        },
      }),
    ]);

    return {
      totalAttendances,
      pendingModifications,
      totalWage: wageSum._sum.calculated_wage ?? 0,
    };
  } catch (error) {
    console.error('[getAttendanceStats] Error:', error);
    return { totalAttendances: 0, pendingModifications: 0, totalWage: 0 };
  }
}


// ================== 勤怠編集（システム管理者） ==================

/**
 * 勤怠詳細を取得（編集画面用）
 */
export interface AttendanceDetailForEdit {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  facilityId: number;
  facilityName: string;
  corporationName?: string;
  jobId?: number;
  jobTitle: string;
  workDate: string; // ISO string
  checkInTime: string;
  checkOutTime?: string;
  checkInMethod: string;
  checkOutMethod?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledBreakTime?: number;
  actualStartTime?: string;
  actualEndTime?: string;
  actualBreakTime?: number;
  calculatedWage?: number;
  hourlyWage?: number;
  transportationFee?: number;
  status: string;
  modificationRequest?: {
    id: number;
    status: string;
    requestedStartTime: string;
    requestedEndTime: string;
    requestedBreakTime: number;
    workerComment: string;
    adminComment?: string;
    originalAmount: number;
    requestedAmount: number;
  };
  editHistories: {
    id: number;
    editedBy: string;
    prevActualStartTime?: string;
    prevActualEndTime?: string;
    prevActualBreakTime?: number;
    prevCalculatedWage?: number;
    prevStatus?: string;
    newActualStartTime?: string;
    newActualEndTime?: string;
    newActualBreakTime?: number;
    newCalculatedWage?: number;
    newStatus?: string;
    reason: string;
    wageManuallySet: boolean;
    createdAt: string;
  }[];
}

export async function getAttendanceDetail(
  attendanceId: number
): Promise<{ success: boolean; data?: AttendanceDetailForEdit; message?: string }> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { success: false, message: '認証エラー' };
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        facility: { select: { id: true, facility_name: true, corporation_name: true } },
        application: {
          include: {
            workDate: {
              include: {
                job: {
                  select: {
                    id: true, title: true, start_time: true, end_time: true,
                    break_time: true, hourly_wage: true, transportation_fee: true,
                  },
                },
              },
            },
          },
        },
        modificationRequest: true,
        editHistories: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!attendance) {
      return { success: false, message: '勤怠記録が見つかりません' };
    }

    const job = attendance.application?.workDate.job;

    const data: AttendanceDetailForEdit = {
      id: attendance.id,
      userId: attendance.user_id,
      userName: attendance.user.name,
      userEmail: attendance.user.email,
      facilityId: attendance.facility_id,
      facilityName: attendance.facility.facility_name,
      corporationName: attendance.facility.corporation_name ?? undefined,
      jobId: job?.id,
      jobTitle: job?.title ?? '不明',
      workDate: (attendance.application?.workDate.work_date ?? attendance.check_in_time).toISOString(),
      checkInTime: attendance.check_in_time.toISOString(),
      checkOutTime: attendance.check_out_time?.toISOString(),
      checkInMethod: attendance.check_in_method,
      checkOutMethod: attendance.check_out_method ?? undefined,
      scheduledStartTime: job?.start_time,
      scheduledEndTime: job?.end_time,
      scheduledBreakTime: job?.break_time ? parseInt(job.break_time) : undefined,
      actualStartTime: attendance.actual_start_time?.toISOString(),
      actualEndTime: attendance.actual_end_time?.toISOString(),
      actualBreakTime: attendance.actual_break_time ?? undefined,
      calculatedWage: attendance.calculated_wage ?? undefined,
      hourlyWage: job?.hourly_wage,
      transportationFee: job?.transportation_fee ?? 0,
      status: attendance.status,
      modificationRequest: attendance.modificationRequest
        ? {
            id: attendance.modificationRequest.id,
            status: attendance.modificationRequest.status,
            requestedStartTime: attendance.modificationRequest.requested_start_time.toISOString(),
            requestedEndTime: attendance.modificationRequest.requested_end_time.toISOString(),
            requestedBreakTime: attendance.modificationRequest.requested_break_time,
            workerComment: attendance.modificationRequest.worker_comment,
            adminComment: attendance.modificationRequest.admin_comment ?? undefined,
            originalAmount: attendance.modificationRequest.original_amount,
            requestedAmount: attendance.modificationRequest.requested_amount,
          }
        : undefined,
      editHistories: attendance.editHistories.map((h) => ({
        id: h.id,
        editedBy: h.edited_by,
        prevActualStartTime: h.prev_actual_start_time?.toISOString(),
        prevActualEndTime: h.prev_actual_end_time?.toISOString(),
        prevActualBreakTime: h.prev_actual_break_time ?? undefined,
        prevCalculatedWage: h.prev_calculated_wage ?? undefined,
        prevStatus: h.prev_status ?? undefined,
        newActualStartTime: h.new_actual_start_time?.toISOString(),
        newActualEndTime: h.new_actual_end_time?.toISOString(),
        newActualBreakTime: h.new_actual_break_time ?? undefined,
        newCalculatedWage: h.new_calculated_wage ?? undefined,
        newStatus: h.new_status ?? undefined,
        reason: h.reason,
        wageManuallySet: h.wage_manually_set,
        createdAt: h.created_at.toISOString(),
      })),
    };

    return { success: true, data };
  } catch (error) {
    console.error('[getAttendanceDetail] Error:', error);
    return { success: false, message: '勤怠詳細の取得に失敗しました' };
  }
}

/**
 * 給与を再計算（プレビュー用、保存しない）
 */
export async function recalculateWage(
  attendanceId: number,
  actualStartTime: string,
  actualEndTime: string,
  breakMinutes: number
): Promise<{ success: boolean; wage?: number; message?: string }> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { success: false, message: '認証エラー' };
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        application: {
          include: {
            workDate: {
              include: {
                job: { select: { hourly_wage: true, transportation_fee: true } },
              },
            },
          },
        },
      },
    });

    if (!attendance) {
      return { success: false, message: '勤怠記録が見つかりません' };
    }

    const hourlyRate = attendance.application?.workDate.job.hourly_wage ?? 1000;
    const transportationFee = attendance.application?.workDate.job.transportation_fee ?? 0;

    const result = calculateSalary({
      startTime: new Date(actualStartTime),
      endTime: new Date(actualEndTime),
      breakMinutes,
      hourlyRate,
    });

    return { success: true, wage: result.totalPay + transportationFee };
  } catch (error) {
    console.error('[recalculateWage] Error:', error);
    return { success: false, message: '給与計算に失敗しました' };
  }
}

/**
 * 勤怠をシステム管理者が編集
 */
export interface UpdateAttendanceData {
  actualStartTime: string;
  actualEndTime: string;
  actualBreakTime: number;
  calculatedWage: number;
  wageManuallySet: boolean;
  status: string;
  reason: string;
}

export async function updateAttendanceBySystemAdmin(
  attendanceId: number,
  data: UpdateAttendanceData
): Promise<{ success: boolean; message: string }> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { success: false, message: '認証エラー' };
    }

    if (!data.reason.trim()) {
      return { success: false, message: '変更理由は必須です' };
    }

    const newStart = new Date(data.actualStartTime);
    const newEnd = new Date(data.actualEndTime);

    if (newStart >= newEnd) {
      return { success: false, message: '開始時間は終了時間より前にしてください' };
    }

    const totalMinutes = (newEnd.getTime() - newStart.getTime()) / (1000 * 60);
    if (data.actualBreakTime >= totalMinutes) {
      return { success: false, message: '休憩時間が実働時間を超えています' };
    }

    if (data.calculatedWage < 0) {
      return { success: false, message: '給与は0以上を指定してください' };
    }

    if (!['CHECKED_IN', 'CHECKED_OUT'].includes(data.status)) {
      return { success: false, message: '無効なステータスです' };
    }

    const current = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        actual_start_time: true, actual_end_time: true, actual_break_time: true,
        calculated_wage: true, status: true, user_id: true, facility_id: true,
      },
    });

    if (!current) {
      return { success: false, message: '勤怠記録が見つかりません' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendanceEditHistory.create({
        data: {
          attendance_id: attendanceId,
          edited_by: 'SYSTEM_ADMIN',
          prev_actual_start_time: current.actual_start_time,
          prev_actual_end_time: current.actual_end_time,
          prev_actual_break_time: current.actual_break_time,
          prev_calculated_wage: current.calculated_wage,
          prev_status: current.status,
          new_actual_start_time: newStart,
          new_actual_end_time: newEnd,
          new_actual_break_time: data.actualBreakTime,
          new_calculated_wage: data.calculatedWage,
          new_status: data.status,
          reason: data.reason.trim(),
          wage_manually_set: data.wageManuallySet,
        },
      });

      await tx.attendance.update({
        where: { id: attendanceId },
        data: {
          actual_start_time: newStart,
          actual_end_time: newEnd,
          actual_break_time: data.actualBreakTime,
          calculated_wage: data.calculatedWage,
          status: data.status,
        },
      });
    });

    logActivity({
      userType: 'SYSTEM_ADMIN',
      action: 'ATTENDANCE_EDIT_BY_SYSTEM_ADMIN',
      targetType: 'Attendance',
      targetId: attendanceId,
      requestData: {
        attendanceId,
        workerId: current.user_id,
        facilityId: current.facility_id,
        changes: {
          actualStartTime: { from: current.actual_start_time?.toISOString(), to: data.actualStartTime },
          actualEndTime: { from: current.actual_end_time?.toISOString(), to: data.actualEndTime },
          actualBreakTime: { from: current.actual_break_time, to: data.actualBreakTime },
          calculatedWage: { from: current.calculated_wage, to: data.calculatedWage },
          status: { from: current.status, to: data.status },
        },
        reason: data.reason.trim(),
        wageManuallySet: data.wageManuallySet,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, message: '勤怠を更新しました' };
  } catch (error) {
    console.error('[updateAttendanceBySystemAdmin] Error:', error);

    logActivity({
      userType: 'SYSTEM_ADMIN',
      action: 'ATTENDANCE_EDIT_BY_SYSTEM_ADMIN_FAILED',
      targetType: 'Attendance',
      targetId: attendanceId,
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return {
      success: false,
      message: error instanceof Error ? error.message : '勤怠の更新に失敗しました',
    };
  }
}
