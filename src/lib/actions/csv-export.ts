'use server';

/**
 * CSV出力用 Server Actions
 * CROSSNAVI連携用のデータエクスポート機能
 */

import { prisma } from '@/lib/prisma';
import { requireSystemAdminAuth, getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { generateClientInfoCsv } from '@/src/lib/csv-export/client-info-csv';
import { generateJobInfoCsv } from '@/src/lib/csv-export/job-info-csv';
import { generateShiftInfoCsv } from '@/src/lib/csv-export/shift-info-csv';
import { generateStaffInfoCsv } from '@/src/lib/csv-export/staff-info-csv';
import { generateAttendanceInfoCsv } from '@/src/lib/csv-export/attendance-info-csv';
import type {
  ClientInfoFilter,
  ClientInfoItem,
  GetClientInfoListParams,
  GetClientInfoListResult,
  ExportCsvResult,
} from '@/app/system-admin/csv-export/client-info/types';
import type {
  JobInfoFilter,
  JobInfoItem,
  GetJobInfoListParams,
  GetJobInfoListResult,
  JobWithFacility,
} from '@/app/system-admin/csv-export/job-info/types';
import type {
  ShiftInfoFilter,
  ShiftInfoItem,
  GetShiftInfoListParams,
  GetShiftInfoListResult,
  ShiftWithJobAndFacility,
} from '@/app/system-admin/csv-export/shift-info/types';
import type {
  StaffInfoFilter,
  StaffInfoItem,
  GetStaffInfoListParams,
  GetStaffInfoListResult,
  StaffWithBankAccount,
} from '@/app/system-admin/csv-export/staff-info/types';
import type {
  AttendanceInfoFilter,
  AttendanceInfoItem,
  GetAttendanceInfoListParams,
  GetAttendanceInfoListResult,
  AttendanceWithDetails,
} from '@/app/system-admin/csv-export/attendance-info/types';

/**
 * 取引先情報フィルター用のWHERE条件を構築
 */
function buildClientInfoWhere(filters: ClientInfoFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    deleted_at: null,
    is_pending: false,
  };

  // 検索（法人名 OR 施設名）
  if (filters.search) {
    where.OR = [
      { corporation_name: { contains: filters.search, mode: 'insensitive' } },
      { facility_name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // 法人番号
  if (filters.corporationNumber) {
    where.corporation_number = { contains: filters.corporationNumber };
  }

  // 法人名
  if (filters.corporationName) {
    where.corporation_name = { contains: filters.corporationName, mode: 'insensitive' };
  }

  // 施設名
  if (filters.facilityName) {
    where.facility_name = { contains: filters.facilityName, mode: 'insensitive' };
  }

  // 登録日（開始）
  if (filters.dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
  }

  // 登録日（終了）
  if (filters.dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
  }

  return where;
}

/**
 * 取引先情報一覧取得
 * @param params ページ、件数、フィルター条件
 * @returns 取引先一覧と総件数
 */
export async function getClientInfoList(
  params: GetClientInfoListParams
): Promise<GetClientInfoListResult> {
  await requireSystemAdminAuth();

  const { page, limit, filters } = params;
  const skip = (page - 1) * limit;

  const where = buildClientInfoWhere(filters);

  const [facilities, total] = await Promise.all([
    prisma.facility.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        corporation_number: true,
        corporation_name: true,
        facility_name: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.facility.count({ where }),
  ]);

  const items: ClientInfoItem[] = facilities.map((f) => ({
    id: f.id,
    createdAt: f.created_at,
    corporationNumber: f.corporation_number,
    corporationName: f.corporation_name,
    facilityName: f.facility_name,
  }));

  return { items, total };
}

/**
 * 取引先情報CSV出力
 * @param filters フィルター条件
 * @returns CSV出力結果
 */
export async function exportClientInfoCsv(
  filters: ClientInfoFilter
): Promise<ExportCsvResult> {
  await requireSystemAdminAuth();
  const session = await getSystemAdminSessionData();

  try {
    const where = buildClientInfoWhere(filters);

    // 全データ取得（CSV出力用、上限10000件）
    const facilities = await prisma.facility.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    if (facilities.length === 0) {
      return {
        success: false,
        error: '出力対象のデータがありません',
      };
    }

    // CSV生成
    const csvData = generateClientInfoCsv(facilities);

    // 成功をログ記録
    logActivity({
      userType: 'FACILITY', // システム管理者として記録
      userEmail: session?.email,
      action: 'CSV_EXPORT_CLIENT',
      targetType: 'Facility',
      requestData: { filters, count: facilities.length },
      result: 'SUCCESS',
    }).catch(() => {});

    return {
      success: true,
      csvData,
      count: facilities.length,
    };
  } catch (error) {
    console.error('CSV出力エラー:', error);

    // エラーをログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_CLIENT_FAILED',
      targetType: 'Facility',
      requestData: { filters },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return {
      success: false,
      error: 'CSV出力に失敗しました',
    };
  }
}

// ============================================
// 案件情報(代理)出力
// ============================================

/**
 * 案件情報フィルター用のWHERE条件を構築
 */
function buildJobInfoWhere(filters: JobInfoFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { facility: { facility_name: { contains: filters.search, mode: 'insensitive' } } },
      { facility: { corporation_name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  if (filters.jobTitle) {
    where.title = { contains: filters.jobTitle, mode: 'insensitive' };
  }

  if (filters.facilityName) {
    where.facility = {
      ...where.facility,
      facility_name: { contains: filters.facilityName, mode: 'insensitive' },
    };
  }

  if (filters.corporationName) {
    where.facility = {
      ...where.facility,
      corporation_name: { contains: filters.corporationName, mode: 'insensitive' },
    };
  }

  if (filters.dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
  }

  if (filters.dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export async function getJobInfoList(
  params: GetJobInfoListParams
): Promise<GetJobInfoListResult> {
  await requireSystemAdminAuth();

  const { page, limit, filters } = params;
  const skip = (page - 1) * limit;
  const where = buildJobInfoWhere(filters);

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        title: true,
        facility_id: true,
        hourly_wage: true,
        status: true,
        facility: {
          select: {
            facility_name: true,
            corporation_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  const items: JobInfoItem[] = jobs.map((j) => ({
    id: j.id,
    createdAt: j.created_at,
    title: j.title,
    facilityId: j.facility_id,
    facilityName: j.facility.facility_name,
    corporationName: j.facility.corporation_name,
    hourlyWage: j.hourly_wage,
    status: j.status,
  }));

  return { items, total };
}

export async function exportJobInfoCsv(
  filters: JobInfoFilter
): Promise<ExportCsvResult> {
  await requireSystemAdminAuth();
  const session = await getSystemAdminSessionData();

  try {
    const where = buildJobInfoWhere(filters);

    const jobs = await prisma.job.findMany({
      where,
      include: {
        facility: {
          select: {
            id: true,
            facility_name: true,
            corporation_name: true,
            postal_code: true,
            prefecture: true,
            city: true,
            address_line: true,
            phone_number: true,
            contact_person_last_name: true,
            contact_person_first_name: true,
            manager_last_name: true,
            manager_first_name: true,
            smoking_measure: true,
            corp_postal_code: true,
            corp_prefecture: true,
            corp_city: true,
            corp_address_line: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    if (jobs.length === 0) {
      return { success: false, error: '出力対象のデータがありません' };
    }

    const jobsWithFacility: JobWithFacility[] = jobs.map((j) => ({
      id: j.id,
      created_at: j.created_at,
      title: j.title,
      start_time: j.start_time,
      end_time: j.end_time,
      break_time: j.break_time,
      hourly_wage: j.hourly_wage,
      transportation_fee: j.transportation_fee,
      overview: j.overview,
      work_content: j.work_content,
      status: j.status,
      facility: j.facility,
    }));

    const csvData = generateJobInfoCsv(jobsWithFacility);

    // 成功をログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_JOB',
      targetType: 'Job',
      requestData: { filters, count: jobs.length },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, csvData, count: jobs.length };
  } catch (error) {
    console.error('案件情報CSV出力エラー:', error);

    // エラーをログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_JOB_FAILED',
      targetType: 'Job',
      requestData: { filters },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'CSV出力に失敗しました' };
  }
}

// ============================================
// 案件シフト表(代理)出力
// ============================================

function buildShiftInfoWhere(filters: ShiftInfoFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters.search) {
    where.OR = [
      { job: { title: { contains: filters.search, mode: 'insensitive' } } },
      { job: { facility: { facility_name: { contains: filters.search, mode: 'insensitive' } } } },
    ];
  }

  if (filters.jobTitle) {
    where.job = { ...where.job, title: { contains: filters.jobTitle, mode: 'insensitive' } };
  }

  if (filters.facilityName) {
    where.job = {
      ...where.job,
      facility: { facility_name: { contains: filters.facilityName, mode: 'insensitive' } },
    };
  }

  if (filters.workDateFrom) {
    where.work_date = { ...where.work_date, gte: new Date(filters.workDateFrom) };
  }

  if (filters.workDateTo) {
    where.work_date = { ...where.work_date, lte: new Date(filters.workDateTo + 'T23:59:59') };
  }

  if (filters.dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
  }

  if (filters.dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
  }

  return where;
}

export async function getShiftInfoList(
  params: GetShiftInfoListParams
): Promise<GetShiftInfoListResult> {
  await requireSystemAdminAuth();

  const { page, limit, filters } = params;
  const skip = (page - 1) * limit;
  const where = buildShiftInfoWhere(filters);

  const [workDates, total] = await Promise.all([
    prisma.jobWorkDate.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        work_date: true,
        recruitment_count: true,
        job: {
          select: {
            id: true,
            title: true,
            start_time: true,
            end_time: true,
            facility: {
              select: {
                facility_name: true,
                corporation_name: true,
              },
            },
          },
        },
      },
      orderBy: { work_date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.jobWorkDate.count({ where }),
  ]);

  const items: ShiftInfoItem[] = workDates.map((wd) => ({
    id: wd.id,
    createdAt: wd.created_at,
    workDate: wd.work_date,
    jobId: wd.job.id,
    jobTitle: wd.job.title,
    facilityName: wd.job.facility.facility_name,
    corporationName: wd.job.facility.corporation_name,
    recruitmentCount: wd.recruitment_count,
    startTime: wd.job.start_time,
    endTime: wd.job.end_time,
  }));

  return { items, total };
}

export async function exportShiftInfoCsv(
  filters: ShiftInfoFilter
): Promise<ExportCsvResult> {
  await requireSystemAdminAuth();
  const session = await getSystemAdminSessionData();

  try {
    const where = buildShiftInfoWhere(filters);

    const workDates = await prisma.jobWorkDate.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            start_time: true,
            end_time: true,
            break_time: true,
            facility: {
              select: {
                id: true,
                facility_name: true,
                corporation_name: true,
              },
            },
          },
        },
      },
      orderBy: { work_date: 'desc' },
      take: 10000,
    });

    if (workDates.length === 0) {
      return { success: false, error: '出力対象のデータがありません' };
    }

    const shifts: ShiftWithJobAndFacility[] = workDates.map((wd) => ({
      id: wd.id,
      created_at: wd.created_at,
      work_date: wd.work_date,
      recruitment_count: wd.recruitment_count,
      job: wd.job,
    }));

    const csvData = generateShiftInfoCsv(shifts);

    // 成功をログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_SHIFT',
      targetType: 'JobWorkDate',
      requestData: { filters, count: workDates.length },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, csvData, count: workDates.length };
  } catch (error) {
    console.error('シフト情報CSV出力エラー:', error);

    // エラーをログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_SHIFT_FAILED',
      targetType: 'JobWorkDate',
      requestData: { filters },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'CSV出力に失敗しました' };
  }
}

// ============================================
// プールスタッフ情報出力
// ============================================

function buildStaffInfoWhere(filters: StaffInfoFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    deleted_at: null,
    email_verified: true,
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phone_number: { contains: filters.search } },
    ];
  }

  if (filters.staffId) {
    const staffIdNum = parseInt(filters.staffId, 10);
    if (!isNaN(staffIdNum)) {
      where.id = staffIdNum;
    }
  }

  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }

  if (filters.phoneNumber) {
    where.phone_number = { contains: filters.phoneNumber };
  }

  if (filters.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }

  if (filters.dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
  }

  if (filters.dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
  }

  return where;
}

export async function getStaffInfoList(
  params: GetStaffInfoListParams
): Promise<GetStaffInfoListResult> {
  await requireSystemAdminAuth();

  const { page, limit, filters } = params;
  const skip = (page - 1) * limit;
  const where = buildStaffInfoWhere(filters);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        name: true,
        phone_number: true,
        email: true,
        prefecture: true,
        city: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const items: StaffInfoItem[] = users.map((u) => ({
    id: u.id,
    createdAt: u.created_at,
    name: u.name,
    phoneNumber: u.phone_number,
    email: u.email,
    prefecture: u.prefecture,
    city: u.city,
  }));

  return { items, total };
}

export async function exportStaffInfoCsv(
  filters: StaffInfoFilter
): Promise<ExportCsvResult> {
  await requireSystemAdminAuth();

  try {
    const where = buildStaffInfoWhere(filters);

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        name: true,
        phone_number: true,
        email: true,
        birth_date: true,
        gender: true,
        last_name_kana: true,
        first_name_kana: true,
        postal_code: true,
        prefecture: true,
        city: true,
        address_line: true,
        building: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    if (users.length === 0) {
      return { success: false, error: '出力対象のデータがありません' };
    }

    // 銀行口座情報を取得
    const userIds = users.map((u) => u.id);
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        bankCode: true,
        branchCode: true,
        accountType: true,
        accountNumber: true,
        accountHolderName: true,
      },
    });

    const bankAccountMap = new Map(
      bankAccounts.map((ba) => [ba.userId, ba])
    );

    const staffList: StaffWithBankAccount[] = users.map((u) => {
      const ba = bankAccountMap.get(u.id);
      return {
        id: u.id,
        created_at: u.created_at,
        name: u.name,
        phone_number: u.phone_number,
        email: u.email,
        birth_date: u.birth_date,
        gender: u.gender,
        last_name_kana: u.last_name_kana,
        first_name_kana: u.first_name_kana,
        postal_code: u.postal_code,
        prefecture: u.prefecture,
        city: u.city,
        address_line: u.address_line,
        building: u.building,
        bankAccount: ba
          ? {
              bankCode: ba.bankCode,
              branchCode: ba.branchCode,
              accountType: ba.accountType,
              accountNumber: ba.accountNumber,
              accountHolderName: ba.accountHolderName,
            }
          : null,
      };
    });

    const csvData = generateStaffInfoCsv(staffList);

    // 成功をログ記録
    const session = await getSystemAdminSessionData();
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_STAFF',
      targetType: 'User',
      requestData: { filters, count: users.length },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, csvData, count: users.length };
  } catch (error) {
    console.error('スタッフ情報CSV出力エラー:', error);

    // エラーをログ記録
    const session = await getSystemAdminSessionData();
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_STAFF_FAILED',
      targetType: 'User',
      requestData: { filters },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'CSV出力に失敗しました' };
  }
}

// ============================================
// 勤怠情報出力
// ============================================

function buildAttendanceInfoWhere(filters: AttendanceInfoFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters.search) {
    where.OR = [
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      { facility: { facility_name: { contains: filters.search, mode: 'insensitive' } } },
      { job: { title: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  if (filters.userName) {
    where.user = { name: { contains: filters.userName, mode: 'insensitive' } };
  }

  if (filters.facilityName) {
    where.facility = { facility_name: { contains: filters.facilityName, mode: 'insensitive' } };
  }

  if (filters.workDateFrom) {
    where.check_in_time = { ...where.check_in_time, gte: new Date(filters.workDateFrom) };
  }

  if (filters.workDateTo) {
    where.check_in_time = { ...where.check_in_time, lte: new Date(filters.workDateTo + 'T23:59:59') };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export async function getAttendanceInfoList(
  params: GetAttendanceInfoListParams
): Promise<GetAttendanceInfoListResult> {
  await requireSystemAdminAuth();

  const { page, limit, filters } = params;
  const skip = (page - 1) * limit;
  const where = buildAttendanceInfoWhere(filters);

  const [attendances, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      select: {
        id: true,
        user_id: true,
        check_in_time: true,
        check_out_time: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        job: {
          select: {
            title: true,
          },
        },
        facility: {
          select: {
            facility_name: true,
          },
        },
      },
      orderBy: { check_in_time: 'desc' },
      skip,
      take: limit,
    }),
    prisma.attendance.count({ where }),
  ]);

  const items: AttendanceInfoItem[] = attendances.map((att) => ({
    id: att.id,
    workDate: att.check_in_time,
    userName: att.user.name,
    userId: att.user_id,
    facilityName: att.facility.facility_name,
    jobTitle: att.job?.title || '',
    checkInTime: att.check_in_time,
    checkOutTime: att.check_out_time,
    status: att.status,
  }));

  return { items, total };
}

export async function exportAttendanceInfoCsv(
  filters: AttendanceInfoFilter
): Promise<ExportCsvResult> {
  await requireSystemAdminAuth();
  const session = await getSystemAdminSessionData();

  try {
    const where = buildAttendanceInfoWhere(filters);

    const attendances = await prisma.attendance.findMany({
      where,
      select: {
        id: true,
        user_id: true,
        check_in_time: true,
        check_out_time: true,
        actual_start_time: true,
        actual_end_time: true,
        actual_break_time: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
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
        facility: {
          select: {
            id: true,
            facility_name: true,
          },
        },
      },
      orderBy: { check_in_time: 'desc' },
      take: 10000,
    });

    if (attendances.length === 0) {
      return { success: false, error: '出力対象のデータがありません' };
    }

    const attendanceList: AttendanceWithDetails[] = attendances.map((att) => ({
      id: att.id,
      user_id: att.user_id,
      check_in_time: att.check_in_time,
      check_out_time: att.check_out_time,
      actual_start_time: att.actual_start_time,
      actual_end_time: att.actual_end_time,
      actual_break_time: att.actual_break_time,
      status: att.status,
      user: att.user,
      job: att.job ? {
        ...att.job,
        hourly_wage: att.job.hourly_wage,
      } : null,
      facility: att.facility,
    }));

    const csvData = generateAttendanceInfoCsv(attendanceList);

    // 成功をログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_ATTENDANCE',
      targetType: 'Attendance',
      requestData: { filters, count: attendances.length },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, csvData, count: attendances.length };
  } catch (error) {
    console.error('勤怠情報CSV出力エラー:', error);

    // エラーをログ記録
    logActivity({
      userType: 'FACILITY',
      userEmail: session?.email,
      action: 'CSV_EXPORT_ATTENDANCE_FAILED',
      targetType: 'Attendance',
      requestData: { filters },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'CSV出力に失敗しました' };
  }
}
