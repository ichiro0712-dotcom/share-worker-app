'use server';

import { prisma } from '@/lib/prisma';
import { PREFECTURES, type Prefecture } from '@/constants/prefectureCities';
import { parseMinimumWageCsv, normalizePrefecture } from '@/src/lib/prefecture-utils';

/**
 * 更新者情報の型
 */
interface UpdatedBy {
  type: 'SYSTEM_ADMIN';
  id: number;
}

/**
 * 最低賃金データの型
 */
export interface MinimumWageData {
  id: number;
  prefecture: string;
  hourlyWage: number;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 履歴データの型
 */
export interface MinimumWageHistoryData {
  id: number;
  prefecture: string;
  hourlyWage: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  archivedAt: Date;
}

/**
 * 全都道府県の最低賃金を取得（適用開始日を考慮）
 * - 適用開始日が現在日以前のデータのみ有効
 */
export async function getAllMinimumWages(): Promise<MinimumWageData[]> {
  try {
    const now = new Date();

    const wages = await prisma.minimumWage.findMany({
      where: {
        effective_from: {
          lte: now,
        },
      },
      orderBy: {
        prefecture: 'asc',
      },
    });

    return wages.map(w => ({
      id: w.id,
      prefecture: w.prefecture,
      hourlyWage: w.hourly_wage,
      effectiveFrom: w.effective_from,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }));
  } catch (error) {
    console.error('[getAllMinimumWages] Error:', error);
    return [];
  }
}

/**
 * 全都道府県の最低賃金を取得（適用開始日関係なく全件）
 * 管理画面表示用
 */
export async function getAllMinimumWagesForAdmin(): Promise<MinimumWageData[]> {
  try {
    const wages = await prisma.minimumWage.findMany({
      orderBy: {
        prefecture: 'asc',
      },
    });

    return wages.map(w => ({
      id: w.id,
      prefecture: w.prefecture,
      hourlyWage: w.hourly_wage,
      effectiveFrom: w.effective_from,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }));
  } catch (error) {
    console.error('[getAllMinimumWagesForAdmin] Error:', error);
    return [];
  }
}

/**
 * 特定の都道府県の最低賃金を取得
 * @param prefecture 都道府県名（正規化済み or 省略形）
 * @returns 最低賃金（円）、データがない場合は null
 */
export async function getMinimumWageForPrefecture(
  prefecture: string
): Promise<number | null> {
  try {
    const normalized = normalizePrefecture(prefecture);
    if (!normalized) return null;

    const now = new Date();

    const wage = await prisma.minimumWage.findFirst({
      where: {
        prefecture: normalized,
        effective_from: {
          lte: now,
        },
      },
    });

    return wage?.hourly_wage ?? null;
  } catch (error) {
    console.error('[getMinimumWageForPrefecture] Error:', error);
    return null;
  }
}

/**
 * 単一の都道府県の最低賃金を更新
 */
export async function upsertMinimumWage(
  prefecture: string,
  hourlyWage: number,
  effectiveFrom: Date,
  updatedBy?: UpdatedBy
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalized = normalizePrefecture(prefecture);
    if (!normalized) {
      return { success: false, error: '無効な都道府県名です' };
    }

    if (hourlyWage <= 0) {
      return { success: false, error: '時給は正の数である必要があります' };
    }

    // 既存データを履歴に保存
    const existing = await prisma.minimumWage.findUnique({
      where: { prefecture: normalized },
    });

    if (existing) {
      await prisma.minimumWageHistory.create({
        data: {
          prefecture: existing.prefecture,
          hourly_wage: existing.hourly_wage,
          effective_from: existing.effective_from,
          effective_to: effectiveFrom,
          archived_at: new Date(),
        },
      });
    }

    // upsert
    await prisma.minimumWage.upsert({
      where: { prefecture: normalized },
      update: {
        hourly_wage: hourlyWage,
        effective_from: effectiveFrom,
        updated_by_type: updatedBy?.type,
        updated_by_id: updatedBy?.id,
      },
      create: {
        prefecture: normalized,
        hourly_wage: hourlyWage,
        effective_from: effectiveFrom,
        updated_by_type: updatedBy?.type,
        updated_by_id: updatedBy?.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[upsertMinimumWage] Error:', error);
    return { success: false, error: '最低賃金の更新に失敗しました' };
  }
}

/**
 * CSVから最低賃金を一括インポート
 * @param csvContent CSV文字列
 * @param effectiveFrom 適用開始日
 * @param updatedBy 更新者情報
 */
export async function importMinimumWages(
  csvContent: string,
  effectiveFrom: Date,
  updatedBy?: UpdatedBy
): Promise<{
  success: boolean;
  imported: number;
  errors: { line: number; content: string; reason: string }[];
}> {
  try {
    const { data, errors } = parseMinimumWageCsv(csvContent);

    if (data.length === 0) {
      return {
        success: false,
        imported: 0,
        errors: errors.length > 0 ? errors : [{ line: 0, content: '', reason: '有効なデータがありません' }],
      };
    }

    // トランザクションで一括処理
    await prisma.$transaction(async (tx) => {
      // 既存データを履歴に保存
      const existingWages = await tx.minimumWage.findMany({
        where: {
          prefecture: {
            in: data.map(d => d.prefecture),
          },
        },
      });

      if (existingWages.length > 0) {
        await tx.minimumWageHistory.createMany({
          data: existingWages.map(w => ({
            prefecture: w.prefecture,
            hourly_wage: w.hourly_wage,
            effective_from: w.effective_from,
            effective_to: effectiveFrom,
            archived_at: new Date(),
          })),
        });
      }

      // 新データをupsert
      for (const item of data) {
        await tx.minimumWage.upsert({
          where: { prefecture: item.prefecture },
          update: {
            hourly_wage: item.hourlyWage,
            effective_from: effectiveFrom,
            updated_by_type: updatedBy?.type,
            updated_by_id: updatedBy?.id,
          },
          create: {
            prefecture: item.prefecture,
            hourly_wage: item.hourlyWage,
            effective_from: effectiveFrom,
            updated_by_type: updatedBy?.type,
            updated_by_id: updatedBy?.id,
          },
        });
      }
    });

    return {
      success: true,
      imported: data.length,
      errors,
    };
  } catch (error) {
    console.error('[importMinimumWages] Error:', error);
    return {
      success: false,
      imported: 0,
      errors: [{ line: 0, content: '', reason: 'インポート処理中にエラーが発生しました' }],
    };
  }
}

/**
 * 最低賃金の履歴を取得
 * @param prefecture 都道府県（指定しない場合は全件）
 * @param limit 取得件数
 */
export async function getMinimumWageHistory(
  prefecture?: string,
  limit: number = 100
): Promise<MinimumWageHistoryData[]> {
  try {
    const where: { prefecture?: string } = {};
    if (prefecture) {
      const normalized = normalizePrefecture(prefecture);
      if (normalized) {
        where.prefecture = normalized;
      }
    }

    const history = await prisma.minimumWageHistory.findMany({
      where,
      orderBy: {
        archived_at: 'desc',
      },
      take: limit,
    });

    return history.map(h => ({
      id: h.id,
      prefecture: h.prefecture,
      hourlyWage: h.hourly_wage,
      effectiveFrom: h.effective_from,
      effectiveTo: h.effective_to,
      archivedAt: h.archived_at,
    }));
  } catch (error) {
    console.error('[getMinimumWageHistory] Error:', error);
    return [];
  }
}

/**
 * 未登録の都道府県一覧を取得
 */
export async function getMissingPrefectures(): Promise<Prefecture[]> {
  try {
    const existing = await prisma.minimumWage.findMany({
      select: { prefecture: true },
    });

    const existingSet = new Set(existing.map(e => e.prefecture));
    return PREFECTURES.filter(p => !existingSet.has(p));
  } catch (error) {
    console.error('[getMissingPrefectures] Error:', error);
    return [...PREFECTURES];
  }
}
