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
  status?: 'active' | 'scheduled';
}

/**
 * 管理画面用: 都道府県ごとの現行 + 予定ビュー
 */
export interface AdminMinimumWageView {
  prefecture: string;
  active: MinimumWageData | null;
  scheduled: MinimumWageData | null;
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
 * DBレコードをMinimumWageDataに変換するヘルパー
 */
function toWageData(
  w: { id: number; prefecture: string; hourly_wage: number; effective_from: Date; created_at: Date; updated_at: Date },
  status: 'active' | 'scheduled'
): MinimumWageData {
  return {
    id: w.id,
    prefecture: w.prefecture,
    hourlyWage: w.hourly_wage,
    effectiveFrom: w.effective_from,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    status,
  };
}

// --- JST日付ユーティリティ ---
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** DateをJSTの日付文字列（YYYY-MM-DD）に変換 */
function toJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 今日のJST 00:00:00 をDateで返す */
function getTodayJSTStart(): Date {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET_MS);
}

/**
 * 予定が適用日を過ぎたレコードを自動昇格（古いactiveをHistoryへ移動）
 * クエリ時に呼び出される。47都道府県×最大2件のため処理コストは無視可能。
 *
 * 比較はJST日付レベルで行う。例: effective_from が 2026-02-07 のレコードは
 * JST 2026-02-07 00:00 以降に active とみなす（UTC保存時刻に依存しない）。
 */
async function promoteScheduledWages(): Promise<void> {
  const now = new Date();
  // 今日のJST日付の開始時刻（00:00:00 JST = 前日15:00:00 UTC）
  const todayJSTStart = getTodayJSTStart();

  await prisma.$transaction(async (tx) => {
    const allWages = await tx.minimumWage.findMany({
      orderBy: [{ prefecture: 'asc' }, { effective_from: 'desc' }],
    });

    // 都道府県ごとにグループ化
    const byPref = new Map<string, typeof allWages>();
    for (const w of allWages) {
      if (!byPref.has(w.prefecture)) byPref.set(w.prefecture, []);
      byPref.get(w.prefecture)!.push(w);
    }

    for (const records of Array.from(byPref.values())) {
      // effective_from の JST日付 が今日以前のレコード（active候補）
      const activeRecords = records.filter(r => toJSTDateString(r.effective_from) <= toJSTDateString(todayJSTStart));
      if (activeRecords.length > 1) {
        // effective_from descで並んでいるので、先頭が最新
        const latestEffectiveFrom = activeRecords[0].effective_from;
        const archiveIds = activeRecords.slice(1).map(r => r.id);

        // 冪等な一括アーカイブ: 条件付きdeleteMany で存在チェック不要
        for (const old of activeRecords.slice(1)) {
          await tx.minimumWageHistory.create({
            data: {
              prefecture: old.prefecture,
              hourly_wage: old.hourly_wage,
              effective_from: old.effective_from,
              effective_to: latestEffectiveFrom,
              archived_at: now,
            },
          });
        }
        await tx.minimumWage.deleteMany({
          where: { id: { in: archiveIds } },
        });
      }
    }
  });
}

/**
 * 全都道府県の最低賃金を取得（ワーカー/施設向け）
 * - 適用開始日が現在日以前のデータのみ有効
 * - 各都道府県で最新の1件のみ返す
 */
export async function getAllMinimumWages(): Promise<MinimumWageData[]> {
  try {
    await promoteScheduledWages();
    // JSTの「今日の終わり」(23:59:59 JST)をクエリに使用
    // → 今日が適用開始日のレコードも含まれる
    const todayJSTEnd = new Date(getTodayJSTStart().getTime() + 24 * 60 * 60 * 1000 - 1);

    const wages = await prisma.minimumWage.findMany({
      where: {
        effective_from: { lte: todayJSTEnd },
      },
      orderBy: [{ prefecture: 'asc' }, { effective_from: 'desc' }],
    });

    // 各都道府県で最新の1件のみ
    const seen = new Set<string>();
    const result: MinimumWageData[] = [];
    for (const w of wages) {
      if (!seen.has(w.prefecture)) {
        seen.add(w.prefecture);
        result.push(toWageData(w, 'active'));
      }
    }
    return result;
  } catch (error) {
    console.error('[getAllMinimumWages] Error:', error);
    return [];
  }
}

/**
 * 管理画面用: 全都道府県の現行 + 予定を取得
 * 都道府県ごとに active と scheduled に分類して返す
 */
export async function getAllMinimumWagesForAdmin(): Promise<AdminMinimumWageView[]> {
  try {
    await promoteScheduledWages();
    const todayStr = toJSTDateString(getTodayJSTStart());

    const wages = await prisma.minimumWage.findMany({
      orderBy: [{ prefecture: 'asc' }, { effective_from: 'desc' }],
    });

    // 都道府県ごとに分類
    const prefMap = new Map<string, { active: MinimumWageData | null; scheduled: MinimumWageData | null }>();

    for (const w of wages) {
      if (!prefMap.has(w.prefecture)) {
        prefMap.set(w.prefecture, { active: null, scheduled: null });
      }
      const entry = prefMap.get(w.prefecture)!;
      // JST日付レベルで比較（UTC保存時刻に依存しない）
      const isScheduled = toJSTDateString(w.effective_from) > todayStr;

      if (isScheduled) {
        // 予定: 最も早い未来日付のもの
        if (!entry.scheduled || w.effective_from < entry.scheduled.effectiveFrom) {
          entry.scheduled = toWageData(w, 'scheduled');
        }
      } else {
        // 現行: 最新の effective_from（descソートなので最初のもの）
        if (!entry.active) {
          entry.active = toWageData(w, 'active');
        }
      }
    }

    // 47都道府県すべてについてビューを返す
    return PREFECTURES.map(pref => ({
      prefecture: pref,
      active: prefMap.get(pref)?.active ?? null,
      scheduled: prefMap.get(pref)?.scheduled ?? null,
    }));
  } catch (error) {
    console.error('[getAllMinimumWagesForAdmin] Error:', error);
    return PREFECTURES.map(pref => ({ prefecture: pref, active: null, scheduled: null }));
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
  const normalized = normalizePrefecture(prefecture);
  if (!normalized) return null;

  const todayEnd = new Date(getTodayJSTStart().getTime() + 24 * 60 * 60 * 1000 - 1);

  const wage = await prisma.minimumWage.findFirst({
    where: {
      prefecture: normalized,
      effective_from: { lte: todayEnd },
    },
    orderBy: { effective_from: 'desc' },
  });

  return wage?.hourly_wage ?? null;
}

/**
 * 単一の都道府県の最低賃金を更新/予定登録
 * - effectiveFrom > now → 予定として登録（現行は変更しない）
 * - effectiveFrom <= now → 即時更新（現行をHistoryに移動）
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

    const todayStart = getTodayJSTStart();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const isScheduled = toJSTDateString(effectiveFrom) > toJSTDateString(todayStart);

    await prisma.$transaction(async (tx) => {
      if (isScheduled) {
        // 予定登録: 既存の予定を削除してから新規作成
        await tx.minimumWage.deleteMany({
          where: {
            prefecture: normalized,
            effective_from: { gt: todayEnd },
          },
        });
        await tx.minimumWage.create({
          data: {
            prefecture: normalized,
            hourly_wage: hourlyWage,
            effective_from: effectiveFrom,
            updated_by_type: updatedBy?.type,
            updated_by_id: updatedBy?.id,
          },
        });
      } else {
        // 即時更新: 現行のactiveをHistory移動してupdate
        const currentActive = await tx.minimumWage.findFirst({
          where: {
            prefecture: normalized,
            effective_from: { lte: todayEnd },
          },
          orderBy: { effective_from: 'desc' },
        });

        if (currentActive) {
          await tx.minimumWageHistory.create({
            data: {
              prefecture: currentActive.prefecture,
              hourly_wage: currentActive.hourly_wage,
              effective_from: currentActive.effective_from,
              effective_to: effectiveFrom,
              archived_at: new Date(),
            },
          });
          await tx.minimumWage.update({
            where: { id: currentActive.id },
            data: {
              hourly_wage: hourlyWage,
              effective_from: effectiveFrom,
              updated_by_type: updatedBy?.type,
              updated_by_id: updatedBy?.id,
            },
          });
        } else {
          await tx.minimumWage.create({
            data: {
              prefecture: normalized,
              hourly_wage: hourlyWage,
              effective_from: effectiveFrom,
              updated_by_type: updatedBy?.type,
              updated_by_id: updatedBy?.id,
            },
          });
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error('[upsertMinimumWage] Error:', error);
    return { success: false, error: '最低賃金の更新に失敗しました' };
  }
}

/**
 * CSVから最低賃金を一括インポート
 * - 行ごとの適用開始日をサポート（3列目が省略された行はdefaultEffectiveFromを使用）
 * - effectiveFrom > now → 予定として登録（現行は変更しない）
 * - effectiveFrom <= now → 即時更新（現行をHistoryに移動）
 */
export async function importMinimumWages(
  csvContent: string,
  defaultEffectiveFrom: Date,
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

    const now = new Date();
    const todayStart = getTodayJSTStart();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const todayStr = toJSTDateString(todayStart);
    const defaultDateKey = toJSTDateString(defaultEffectiveFrom);

    // 適用開始日ごとにグループ化
    const groupedByDate = new Map<string, typeof data>();
    for (const item of data) {
      const dateKey = item.effectiveFrom || defaultDateKey;
      if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, []);
      groupedByDate.get(dateKey)!.push(item);
    }

    await prisma.$transaction(async (tx) => {
      for (const [dateStr, items] of Array.from(groupedByDate.entries())) {
        const effectiveFrom = new Date(dateStr + 'T00:00:00+09:00');
        const isScheduled = dateStr > todayStr;
        const prefectures = items.map(d => d.prefecture);

        if (isScheduled) {
          // 予定登録: 対象都道府県の既存予定を削除してから新規作成
          await tx.minimumWage.deleteMany({
            where: {
              prefecture: { in: prefectures },
              effective_from: { gt: todayEnd },
            },
          });
          await tx.minimumWage.createMany({
            data: items.map(item => ({
              prefecture: item.prefecture,
              hourly_wage: item.hourlyWage,
              effective_from: effectiveFrom,
              updated_by_type: updatedBy?.type,
              updated_by_id: updatedBy?.id,
            })),
          });
        } else {
          // 即時更新: 既存activeをHistoryに保存してから更新/作成
          const existingActive = await tx.minimumWage.findMany({
            where: {
              prefecture: { in: prefectures },
              effective_from: { lte: todayEnd },
            },
            orderBy: [{ prefecture: 'asc' }, { effective_from: 'desc' }],
          });

          const activeByPref = new Map<string, typeof existingActive[0]>();
          for (const w of existingActive) {
            if (!activeByPref.has(w.prefecture)) {
              activeByPref.set(w.prefecture, w);
            }
          }

          if (activeByPref.size > 0) {
            await tx.minimumWageHistory.createMany({
              data: Array.from(activeByPref.values()).map(w => ({
                prefecture: w.prefecture,
                hourly_wage: w.hourly_wage,
                effective_from: w.effective_from,
                effective_to: effectiveFrom,
                archived_at: new Date(),
              })),
            });
          }

          for (const item of items) {
            const existing = activeByPref.get(item.prefecture);
            if (existing) {
              await tx.minimumWage.update({
                where: { id: existing.id },
                data: {
                  hourly_wage: item.hourlyWage,
                  effective_from: effectiveFrom,
                  updated_by_type: updatedBy?.type,
                  updated_by_id: updatedBy?.id,
                },
              });
            } else {
              await tx.minimumWage.create({
                data: {
                  prefecture: item.prefecture,
                  hourly_wage: item.hourlyWage,
                  effective_from: effectiveFrom,
                  updated_by_type: updatedBy?.type,
                  updated_by_id: updatedBy?.id,
                },
              });
            }
          }
        }
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
 * 予定の最低賃金を取消
 * effective_from > now のレコードのみ削除可能
 */
export async function deleteScheduledWage(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const todayEnd = new Date(getTodayJSTStart().getTime() + 24 * 60 * 60 * 1000 - 1);
    // TOCTOU安全: 1クエリで条件付き削除（JST日付で未来のレコードのみ削除可能）
    const result = await prisma.minimumWage.deleteMany({
      where: {
        id,
        effective_from: { gt: todayEnd },
      },
    });
    if (result.count === 0) {
      return { success: false, error: '該当する予定データが見つからないか、既に適用中のため削除できません' };
    }
    return { success: true };
  } catch (error) {
    console.error('[deleteScheduledWage] Error:', error);
    return { success: false, error: '予定の取消に失敗しました' };
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
 * 現行（active）のレコードがない都道府県を返す（予定のみの場合も未登録扱い）
 */
export async function getMissingPrefectures(): Promise<Prefecture[]> {
  try {
    const todayEnd = new Date(getTodayJSTStart().getTime() + 24 * 60 * 60 * 1000 - 1);
    const existing = await prisma.minimumWage.findMany({
      where: {
        effective_from: { lte: todayEnd },
      },
      select: { prefecture: true },
    });

    const existingSet = new Set(existing.map(e => e.prefecture));
    return PREFECTURES.filter(p => !existingSet.has(p));
  } catch (error) {
    console.error('[getMissingPrefectures] Error:', error);
    return [...PREFECTURES];
  }
}
