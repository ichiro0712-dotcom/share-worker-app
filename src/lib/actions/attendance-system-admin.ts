'use server';

/**
 * QRコード勤怠管理機能 - システム管理者向けServer Actions
 */

import { prisma } from '@/lib/prisma';
import { getCurrentTime } from './helpers';
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
        let isLate = false;
        let isEarlyLeave = false;
        let isOvertime = false;

        if (scheduledStartTime && att.actual_start_time) {
          const [schedH, schedM] = scheduledStartTime.split(':').map(Number);
          const actualStart = new Date(att.actual_start_time);
          const actualH = actualStart.getHours();
          const actualM = actualStart.getMinutes();
          // 実績開始が定刻より遅い場合は遅刻
          if (actualH * 60 + actualM > schedH * 60 + schedM) {
            isLate = true;
          }
        }

        if (scheduledEndTime && att.actual_end_time) {
          const [schedH, schedM] = scheduledEndTime.split(':').map(Number);
          const actualEnd = new Date(att.actual_end_time);
          const actualH = actualEnd.getHours();
          const actualM = actualEnd.getMinutes();
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
 */
export async function exportAttendancesCsv(options: {
  dateFrom: Date;
  dateTo: Date;
  facilityId?: number;
}): Promise<{ success: boolean; csvData?: string; error?: string }> {
  try {
    const isAuth = await checkSystemAdminAuth();
    if (!isAuth) {
      return { success: false, error: '認証エラー' };
    }

    const whereClause: any = {
      check_in_time: {
        gte: options.dateFrom,
        lte: options.dateTo,
      },
      status: 'CHECKED_OUT', // 退勤済みのみ
    };

    if (options.facilityId) {
      whereClause.facility_id = options.facilityId;
    }

    const attendances = await prisma.attendance.findMany({
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
        check_in_time: 'asc',
      },
    });

    // CSVヘッダー
    const headers = [
      '勤務日',
      'ワーカー名',
      'ワーカーID',
      '施設名',
      '案件名',
      '予定出勤',
      '予定退勤',
      '予定休憩(分)',
      '実績出勤',
      '実績退勤',
      '実績休憩(分)',
      '出勤方法',
      '退勤方法',
      '確定報酬',
      '申請状況',
    ].join(',');

    // CSVデータ行
    const rows = attendances.map((att) => {
      const workDate = att.application?.workDate.work_date ?? att.check_in_time;
      const formatTime = (date: Date | null) =>
        date
          ? new Date(date).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';

      return [
        new Date(workDate).toLocaleDateString('ja-JP'),
        att.user.name,
        att.user_id,
        att.facility.facility_name,
        att.application?.workDate.job.title ?? '',
        att.application?.workDate.job.start_time ?? '',
        att.application?.workDate.job.end_time ?? '',
        att.application?.workDate.job.break_time ?? '0',
        att.actual_start_time ? formatTime(att.actual_start_time) : '',
        att.actual_end_time ? formatTime(att.actual_end_time) : '',
        att.actual_break_time ?? '0',
        att.check_in_method === 'QR' ? 'QRコード' : '緊急番号',
        att.check_out_method === 'QR' ? 'QRコード' : att.check_out_method === 'EMERGENCY_CODE' ? '緊急番号' : '',
        att.calculated_wage ?? '',
        att.modificationRequest?.status ?? '確定',
      ]
        .map((v) => `"${v}"`)
        .join(',');
    });

    const csvData = [headers, ...rows].join('\n');

    return { success: true, csvData };
  } catch (error) {
    console.error('[exportAttendancesCsv] Error:', error);
    return { success: false, error: 'エクスポートに失敗しました' };
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
