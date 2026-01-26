'use server';

/**
 * CSV出力用 Server Actions
 * CROSSNAVI連携用のデータエクスポート機能
 */

import { prisma } from '@/lib/prisma';
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server';
import { generateClientInfoCsv } from '@/src/lib/csv-export/client-info-csv';
import type {
  ClientInfoFilter,
  ClientInfoItem,
  GetClientInfoListParams,
  GetClientInfoListResult,
  ExportCsvResult,
} from '@/app/system-admin/csv-export/client-info/types';

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
