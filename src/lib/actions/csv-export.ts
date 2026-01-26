'use server';

/**
 * CSV出力用 Server Actions
 * CROSSNAVI連携用のデータエクスポート機能
 */

import { prisma } from '@/lib/prisma';
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server';
import { generateClientInfoCsv } from '@/src/lib/csv-export/client-info-csv';
import { generateJobInfoCsv } from '@/src/lib/csv-export/job-info-csv';
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

    return {
      success: true,
      csvData,
      count: facilities.length,
    };
  } catch (error) {
    console.error('CSV出力エラー:', error);
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

  // 検索（案件名 OR 施設名 OR 法人名）
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { facility: { facility_name: { contains: filters.search, mode: 'insensitive' } } },
      { facility: { corporation_name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  // 案件名
  if (filters.jobTitle) {
    where.title = { contains: filters.jobTitle, mode: 'insensitive' };
  }

  // 施設名
  if (filters.facilityName) {
    where.facility = {
      ...where.facility,
      facility_name: { contains: filters.facilityName, mode: 'insensitive' },
    };
  }

  // 法人名
  if (filters.corporationName) {
    where.facility = {
      ...where.facility,
      corporation_name: { contains: filters.corporationName, mode: 'insensitive' },
    };
  }

  // 登録日（開始）
  if (filters.dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
  }

  // 登録日（終了）
  if (filters.dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
  }

  // ステータス
  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

/**
 * 案件情報一覧取得
 * @param params ページ、件数、フィルター条件
 * @returns 案件一覧と総件数
 */
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

/**
 * 案件情報CSV出力
 * @param filters フィルター条件
 * @returns CSV出力結果
 */
export async function exportJobInfoCsv(
  filters: JobInfoFilter
): Promise<ExportCsvResult> {
  await requireSystemAdminAuth();

  try {
    const where = buildJobInfoWhere(filters);

    // 全データ取得（CSV出力用、上限10000件）
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
      return {
        success: false,
        error: '出力対象のデータがありません',
      };
    }

    // JobWithFacility型に変換
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

    // CSV生成
    const csvData = generateJobInfoCsv(jobsWithFacility);

    return {
      success: true,
      csvData,
      count: jobs.length,
    };
  } catch (error) {
    console.error('案件情報CSV出力エラー:', error);
    return {
      success: false,
      error: 'CSV出力に失敗しました',
    };
  }
}
