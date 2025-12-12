'use server';

import { prisma } from '@/lib/prisma';
import {
    startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear,
    format, eachDayOfInterval, eachMonthOfInterval, differenceInHours
} from 'date-fns';

// ========== 型定義 ==========

export interface AnalyticsFilter {
    // 期間指定
    startDate?: Date;
    endDate?: Date;
    // 表示形式
    viewMode: 'daily' | 'monthly';
    // 日次の場合の対象年月、月次の場合の対象年
    targetYear?: number;
    targetMonth?: number; // 1-12
    // ワーカーフィルター（配列対応）
    ageRanges?: string[]; // ["10", "20", "30", "40", "50", "60", "70"]
    qualifications?: string[];
    genders?: string[]; // ["男性", "女性", "その他"]
    // 施設フィルター（配列対応）
    facilityTypes?: string[];
    // 共通フィルター
    regionId?: number; // AnalyticsRegionのID
    // マッチング用
    requiresInterview?: boolean;
    // 後方互換性（単一値）
    ageRange?: string;
    qualification?: string;
    facilityType?: string;
}

export interface WorkerMetrics {
    date: string;
    registeredCount: number;      // 登録ワーカー数（累計）
    newCount: number;             // 入会ワーカー数
    withdrawnCount: number;       // 退会ワーカー数
    reviewCount: number;          // レビュー数
    reviewAvg: number;            // レビュー平均点
    cancelRate: number;           // キャンセル率
    lastMinuteCancelRate: number; // 直前キャンセル率
    dropoutRate: number;          // 登録離脱率（将来用）
    withdrawalRate: number;       // 退会率
}

export interface FacilityMetrics {
    date: string;
    registeredCount: number;      // 登録施設数（累計）
    newCount: number;             // 入会施設数
    withdrawnCount: number;       // 退会施設数
    reviewCount: number;          // レビュー数
    reviewAvg: number;            // レビュー平均点
    dropoutRate: number;          // 登録離脱率（将来用）
    withdrawalRate: number;       // 退会率
    parentJobCount: number;       // 親求人数
    parentJobInterviewCount: number; // 親求人数（面接あり）
    childJobCount: number;        // 子求人数
    childJobInterviewCount: number;  // 子求人数（面接あり）
}

export interface MatchingMetrics {
    date: string;
    parentJobCount: number;
    childJobCount: number;
    totalSlots: number;           // 総応募枠数
    remainingSlots: number;       // 応募枠数（残り）
    applicationCount: number;
    matchingCount: number;
    avgMatchingHours: number;     // マッチング期間（時間）
    applicationsPerWorker: number;
    matchingsPerWorker: number;
    reviewsPerWorker: number;
    parentJobsPerFacility: number;
    childJobsPerFacility: number;
    matchingsPerFacility: number;
    reviewsPerFacility: number;
}

// ========== ヘルパー関数 ==========

/**
 * フィルターに基づいて日付リストを生成
 */
function getDateRanges(filter: AnalyticsFilter) {
    const now = new Date();
    let dateList: Date[] = [];
    let dateFormat = 'yyyy/MM/dd';

    if (filter.viewMode === 'daily') {
        // 日次: 指定月の1日〜末日
        const year = filter.targetYear || now.getFullYear();
        const month = (filter.targetMonth || now.getMonth() + 1) - 1; // 0-indexed
        const targetDate = new Date(year, month, 1);
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);
        dateList = eachDayOfInterval({ start, end });
        dateFormat = 'MM/dd';
    } else {
        // 月次: 指定年の1月〜12月
        const year = filter.targetYear || now.getFullYear();
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 11, 31));
        dateList = eachMonthOfInterval({ start, end });
        dateFormat = 'yyyy/MM';
    }

    return { dateList, dateFormat };
}

/**
 * 期間フィルター用のwhere条件を生成
 */
function getPeriodWhere(filter: AnalyticsFilter, fieldName: string = 'created_at') {
    if (filter.startDate && filter.endDate) {
        return {
            [fieldName]: {
                gte: startOfDay(filter.startDate),
                lte: endOfDay(filter.endDate)
            }
        };
    }
    return {};
}

/**
 * 年齢層から生年月日の範囲を計算
 */
function getAgeRangeDates(ageRange: string): { minDate: Date; maxDate: Date } | null {
    const now = new Date();
    const age = parseInt(ageRange);
    if (isNaN(age)) return null;

    // 例: 20代 = 20-29歳, 70代以上は上限なし
    const maxAge = age >= 70 ? 120 : age + 9;
    const minBirthYear = now.getFullYear() - maxAge - 1;
    const maxBirthYear = now.getFullYear() - age;

    return {
        minDate: new Date(minBirthYear, 0, 1),
        maxDate: new Date(maxBirthYear, 11, 31)
    };
}

/**
 * 複数の年齢層から生年月日のOR条件を生成
 */
function getAgeRangesCondition(ageRanges: string[]): any[] {
    if (!ageRanges || ageRanges.length === 0) return [];

    const conditions: any[] = [];
    for (const ageRange of ageRanges) {
        const range = getAgeRangeDates(ageRange);
        if (range) {
            conditions.push({
                birth_date: {
                    gte: range.minDate,
                    lte: range.maxDate
                }
            });
        }
    }
    return conditions;
}

/**
 * 地域フィルター用のwhere条件を取得
 */
async function getRegionWhere(regionId: number | undefined) {
    if (!regionId) return {};

    const region = await prisma.analyticsRegion.findUnique({
        where: { id: regionId }
    });

    if (!region) return {};

    // prefecture_cities: { "東京都": [], "神奈川県": ["横浜市", "川崎市"] }
    const prefectureCities = region.prefecture_cities as Record<string, string[]> || {};
    const prefectures = Object.keys(prefectureCities);

    if (prefectures.length === 0) return {};

    // 各都道府県の条件を構築
    const orConditions: any[] = [];

    for (const pref of prefectures) {
        const cities = prefectureCities[pref];
        if (cities.length === 0) {
            // 空配列 = その都道府県全体
            orConditions.push({ prefecture: pref });
        } else {
            // 特定の市区町村のみ
            orConditions.push({
                AND: [
                    { prefecture: pref },
                    { city: { in: cities } }
                ]
            });
        }
    }

    return orConditions.length > 0 ? { OR: orConditions } : {};
}

// ========== ワーカー分析 ==========

export async function getWorkerAnalyticsData(filter: AnalyticsFilter): Promise<WorkerMetrics[]> {
    const { dateList, dateFormat } = getDateRanges(filter);
    const periodWhere = getPeriodWhere(filter);
    const regionWhere = await getRegionWhere(filter.regionId);

    // 基本where条件
    const baseWhere: any = {
        ...regionWhere,
        deleted_at: null // 退会していない
    };

    // AND条件を収集
    const andConditions: any[] = [];

    // 年齢層フィルター（配列対応）
    const ageRanges = filter.ageRanges?.length ? filter.ageRanges : (filter.ageRange ? [filter.ageRange] : []);
    if (ageRanges.length > 0) {
        const ageConditions = getAgeRangesCondition(ageRanges);
        if (ageConditions.length > 0) {
            andConditions.push({ OR: ageConditions });
        }
    }

    // 性別フィルター（配列対応）
    if (filter.genders && filter.genders.length > 0) {
        andConditions.push({ gender: { in: filter.genders } });
    }

    // 資格フィルター（配列対応）
    const qualifications = filter.qualifications?.length ? filter.qualifications : (filter.qualification ? [filter.qualification] : []);
    if (qualifications.length > 0) {
        // いずれかの資格を持っている
        andConditions.push({
            OR: qualifications.map(q => ({ qualifications: { has: q } }))
        });
    }

    // AND条件を適用
    if (andConditions.length > 0) {
        baseWhere.AND = andConditions;
    }

    // 並列でデータ取得
    const [
        allUsers,
        newUsers,
        withdrawnUsers,
        reviews,
        applications
    ] = await Promise.all([
        // 全ワーカー（累計用）
        prisma.user.findMany({
            where: baseWhere,
            select: { id: true, created_at: true }
        }),
        // 新規登録ワーカー
        prisma.user.findMany({
            where: { ...baseWhere, ...periodWhere },
            select: { id: true, created_at: true }
        }),
        // 退会ワーカー
        prisma.user.findMany({
            where: {
                ...regionWhere,
                deleted_at: { not: null },
                ...(filter.startDate && filter.endDate ? {
                    deleted_at: {
                        gte: startOfDay(filter.startDate),
                        lte: endOfDay(filter.endDate)
                    }
                } : {})
            },
            select: { id: true, deleted_at: true }
        }),
        // レビュー（施設→ワーカー）
        prisma.review.findMany({
            where: {
                reviewer_type: 'FACILITY',
                ...periodWhere
            },
            select: { created_at: true, rating: true, user_id: true }
        }),
        // 応募（キャンセル率計算用）
        prisma.application.findMany({
            where: periodWhere,
            select: {
                created_at: true,
                status: true,
                cancelled_by: true,
                workDate: {
                    select: { work_date: true }
                },
                updated_at: true
            }
        })
    ]);

    // 日付ごとに集計
    const results: WorkerMetrics[] = dateList.map(date => {
        const dateStr = format(date, dateFormat);
        const periodStart = filter.viewMode === 'daily'
            ? startOfDay(date)
            : startOfMonth(date);
        const periodEnd = filter.viewMode === 'daily'
            ? endOfDay(date)
            : endOfMonth(date);

        // 登録ワーカー数（期間末時点の累計）
        const registeredCount = allUsers.filter(u => u.created_at <= periodEnd).length;

        // 入会ワーカー数
        const newCount = newUsers.filter(u =>
            u.created_at >= periodStart && u.created_at <= periodEnd
        ).length;

        // 退会ワーカー数
        const withdrawnCount = withdrawnUsers.filter(u =>
            u.deleted_at && u.deleted_at >= periodStart && u.deleted_at <= periodEnd
        ).length;

        // レビュー集計
        const periodReviews = reviews.filter(r =>
            r.created_at >= periodStart && r.created_at <= periodEnd
        );
        const reviewCount = periodReviews.length;
        const reviewAvg = reviewCount > 0
            ? periodReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

        // キャンセル率計算
        const periodApps = applications.filter(a =>
            a.created_at >= periodStart && a.created_at <= periodEnd
        );
        const totalApps = periodApps.length;
        const workerCancels = periodApps.filter(a => a.cancelled_by === 'WORKER').length;
        const cancelRate = totalApps > 0 ? (workerCancels / totalApps) * 100 : 0;

        // 直前キャンセル率（勤務日24時間以内のキャンセル）
        const lastMinuteCancels = periodApps.filter(a => {
            if (a.cancelled_by !== 'WORKER' || !a.workDate?.work_date) return false;
            const hoursBeforeWork = differenceInHours(a.workDate.work_date, a.updated_at);
            return hoursBeforeWork >= 0 && hoursBeforeWork <= 24;
        }).length;
        const lastMinuteCancelRate = workerCancels > 0
            ? (lastMinuteCancels / workerCancels) * 100
            : 0;

        // 退会率（期間開始時の登録数に対する退会率）
        const startRegistered = allUsers.filter(u => u.created_at < periodStart).length;
        const withdrawalRate = startRegistered > 0
            ? (withdrawnCount / startRegistered) * 100
            : 0;

        return {
            date: dateStr,
            registeredCount,
            newCount,
            withdrawnCount,
            reviewCount,
            reviewAvg: Math.round(reviewAvg * 100) / 100,
            cancelRate: Math.round(cancelRate * 100) / 100,
            lastMinuteCancelRate: Math.round(lastMinuteCancelRate * 100) / 100,
            dropoutRate: 0, // 将来実装
            withdrawalRate: Math.round(withdrawalRate * 100) / 100
        };
    });

    return results;
}

// ========== 施設分析 ==========

export async function getFacilityAnalyticsData(filter: AnalyticsFilter): Promise<FacilityMetrics[]> {
    const { dateList, dateFormat } = getDateRanges(filter);
    const periodWhere = getPeriodWhere(filter);
    const regionWhere = await getRegionWhere(filter.regionId);

    // 基本where条件
    const baseWhere: any = {
        ...regionWhere,
        deleted_at: null
    };

    // 施設種類フィルター（配列対応）
    const facilityTypes = filter.facilityTypes?.length ? filter.facilityTypes : (filter.facilityType ? [filter.facilityType] : []);
    if (facilityTypes.length > 0) {
        baseWhere.facility_type = { in: facilityTypes };
    }

    // 施設種類フィルター条件（他テーブル用）
    const facilityTypeCondition = facilityTypes.length > 0
        ? { facility: { facility_type: { in: facilityTypes } } }
        : {};
    const jobFacilityTypeCondition = facilityTypes.length > 0
        ? { job: { facility: { facility_type: { in: facilityTypes } } } }
        : {};

    // 並列でデータ取得
    const [
        allFacilities,
        newFacilities,
        withdrawnFacilities,
        reviews,
        jobs,
        jobWorkDates
    ] = await Promise.all([
        prisma.facility.findMany({
            where: baseWhere,
            select: { id: true, created_at: true }
        }),
        prisma.facility.findMany({
            where: { ...baseWhere, ...periodWhere },
            select: { id: true, created_at: true }
        }),
        prisma.facility.findMany({
            where: {
                ...regionWhere,
                deleted_at: { not: null },
                ...(filter.startDate && filter.endDate ? {
                    deleted_at: {
                        gte: startOfDay(filter.startDate),
                        lte: endOfDay(filter.endDate)
                    }
                } : {}),
                ...(facilityTypes.length > 0 ? { facility_type: { in: facilityTypes } } : {})
            },
            select: { id: true, deleted_at: true }
        }),
        prisma.review.findMany({
            where: {
                reviewer_type: 'WORKER',
                ...periodWhere,
                ...facilityTypeCondition
            },
            select: { created_at: true, rating: true }
        }),
        prisma.job.findMany({
            where: {
                ...periodWhere,
                ...facilityTypeCondition
            },
            select: { id: true, created_at: true, requires_interview: true }
        }),
        prisma.jobWorkDate.findMany({
            where: {
                ...periodWhere,
                ...jobFacilityTypeCondition
            },
            select: { id: true, created_at: true, job: { select: { requires_interview: true } } }
        })
    ]);

    const results: FacilityMetrics[] = dateList.map(date => {
        const dateStr = format(date, dateFormat);
        const periodStart = filter.viewMode === 'daily' ? startOfDay(date) : startOfMonth(date);
        const periodEnd = filter.viewMode === 'daily' ? endOfDay(date) : endOfMonth(date);

        const registeredCount = allFacilities.filter(f => f.created_at <= periodEnd).length;
        const newCount = newFacilities.filter(f =>
            f.created_at >= periodStart && f.created_at <= periodEnd
        ).length;
        const withdrawnCount = withdrawnFacilities.filter(f =>
            f.deleted_at && f.deleted_at >= periodStart && f.deleted_at <= periodEnd
        ).length;

        const periodReviews = reviews.filter(r =>
            r.created_at >= periodStart && r.created_at <= periodEnd
        );
        const reviewCount = periodReviews.length;
        const reviewAvg = reviewCount > 0
            ? periodReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

        const startRegistered = allFacilities.filter(f => f.created_at < periodStart).length;
        const withdrawalRate = startRegistered > 0 ? (withdrawnCount / startRegistered) * 100 : 0;

        const periodJobs = jobs.filter(j =>
            j.created_at >= periodStart && j.created_at <= periodEnd
        );
        const parentJobCount = periodJobs.length;
        const parentJobInterviewCount = periodJobs.filter(j => j.requires_interview).length;

        const periodWorkDates = jobWorkDates.filter(jwd =>
            jwd.created_at >= periodStart && jwd.created_at <= periodEnd
        );
        const childJobCount = periodWorkDates.length;
        const childJobInterviewCount = periodWorkDates.filter(jwd => jwd.job.requires_interview).length;

        return {
            date: dateStr,
            registeredCount,
            newCount,
            withdrawnCount,
            reviewCount,
            reviewAvg: Math.round(reviewAvg * 100) / 100,
            dropoutRate: 0,
            withdrawalRate: Math.round(withdrawalRate * 100) / 100,
            parentJobCount,
            parentJobInterviewCount,
            childJobCount,
            childJobInterviewCount
        };
    });

    return results;
}

// ========== 応募・マッチング分析 ==========

export async function getMatchingAnalyticsData(filter: AnalyticsFilter): Promise<MatchingMetrics[]> {
    const { dateList, dateFormat } = getDateRanges(filter);
    const periodWhere = getPeriodWhere(filter);
    const regionWhere = await getRegionWhere(filter.regionId);

    // フィルター条件構築
    const jobWhere: any = { ...periodWhere };
    const facilityWhere: any = { ...regionWhere };

    // 施設種類フィルター（配列対応）
    const facilityTypes = filter.facilityTypes?.length ? filter.facilityTypes : (filter.facilityType ? [filter.facilityType] : []);
    if (facilityTypes.length > 0) {
        facilityWhere.facility_type = { in: facilityTypes };
    }
    if (Object.keys(facilityWhere).length > 0) {
        jobWhere.facility = facilityWhere;
    }
    if (filter.requiresInterview !== undefined) {
        jobWhere.requires_interview = filter.requiresInterview;
    }

    // ワーカーフィルター条件構築
    const userAndConditions: any[] = [];

    // 年齢層フィルター（配列対応）
    const ageRanges = filter.ageRanges?.length ? filter.ageRanges : (filter.ageRange ? [filter.ageRange] : []);
    if (ageRanges.length > 0) {
        const ageConditions = getAgeRangesCondition(ageRanges);
        if (ageConditions.length > 0) {
            userAndConditions.push({ OR: ageConditions });
        }
    }

    // 性別フィルター（配列対応）
    if (filter.genders && filter.genders.length > 0) {
        userAndConditions.push({ gender: { in: filter.genders } });
    }

    // 資格フィルター（配列対応）
    const qualifications = filter.qualifications?.length ? filter.qualifications : (filter.qualification ? [filter.qualification] : []);
    if (qualifications.length > 0) {
        userAndConditions.push({
            OR: qualifications.map(q => ({ qualifications: { has: q } }))
        });
    }

    // userWhere構築
    const userWhere: any = userAndConditions.length > 0 ? { AND: userAndConditions } : {};

    const [
        jobs,
        jobWorkDates,
        jobWorkDatesWithSlots,
        applications,
        reviews
    ] = await Promise.all([
        prisma.job.findMany({
            where: jobWhere,
            select: { id: true, created_at: true, requires_interview: true }
        }),
        prisma.jobWorkDate.findMany({
            where: {
                ...periodWhere,
                job: jobWhere.facility ? { facility: jobWhere.facility } : undefined
            },
            select: { id: true, created_at: true, job: { select: { requires_interview: true } } }
        }),
        // スロット計算用（recruitment_countと確定済み応募を含む）
        prisma.jobWorkDate.findMany({
            where: {
                ...periodWhere,
                job: jobWhere.facility ? { facility: jobWhere.facility } : undefined
            },
            select: {
                id: true,
                created_at: true,
                recruitment_count: true,
                applications: {
                    where: {
                        status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] }
                    },
                    select: { id: true }
                }
            }
        }),
        prisma.application.findMany({
            where: {
                ...periodWhere,
                ...(Object.keys(userWhere).length > 0 ? { user: userWhere } : {}),
                ...(jobWhere.facility ? { workDate: { job: { facility: jobWhere.facility } } } : {}),
                ...(filter.requiresInterview !== undefined ? {
                    workDate: { job: { requires_interview: filter.requiresInterview } }
                } : {})
            },
            select: {
                id: true,
                created_at: true,
                updated_at: true,
                status: true,
                user_id: true,
                workDate: {
                    select: {
                        job: {
                            select: { facility_id: true, created_at: true }
                        }
                    }
                }
            }
        }),
        prisma.review.findMany({
            where: periodWhere,
            select: {
                created_at: true,
                user_id: true,
                facility_id: true,
                reviewer_type: true
            }
        })
    ]);

    const results: MatchingMetrics[] = dateList.map(date => {
        const dateStr = format(date, dateFormat);
        const periodStart = filter.viewMode === 'daily' ? startOfDay(date) : startOfMonth(date);
        const periodEnd = filter.viewMode === 'daily' ? endOfDay(date) : endOfMonth(date);

        const periodJobs = jobs.filter(j =>
            j.created_at >= periodStart && j.created_at <= periodEnd
        );
        const parentJobCount = periodJobs.length;

        const periodWorkDates = jobWorkDates.filter(jwd =>
            jwd.created_at >= periodStart && jwd.created_at <= periodEnd
        );
        const childJobCount = periodWorkDates.length;

        // スロット計算
        const periodWorkDatesWithSlots = jobWorkDatesWithSlots.filter(jwd =>
            jwd.created_at >= periodStart && jwd.created_at <= periodEnd
        );
        const totalSlots = periodWorkDatesWithSlots.reduce((sum, wd) => sum + wd.recruitment_count, 0);
        const remainingSlots = periodWorkDatesWithSlots.reduce((sum, wd) => {
            const filledSlots = wd.applications.length;
            return sum + Math.max(0, wd.recruitment_count - filledSlots);
        }, 0);

        const periodApps = applications.filter(a =>
            a.created_at >= periodStart && a.created_at <= periodEnd
        );
        const applicationCount = periodApps.length;

        // マッチング = SCHEDULED以上のステータス
        const matchedApps = periodApps.filter(a =>
            a.status !== 'APPLIED' && a.status !== 'CANCELLED'
        );
        const matchingCount = matchedApps.length;

        // マッチング期間（求人作成〜マッチングまでの平均時間）
        let totalMatchingHours = 0;
        matchedApps.forEach(app => {
            if (app.workDate?.job?.created_at) {
                const hours = differenceInHours(app.updated_at, app.workDate.job.created_at);
                if (hours > 0) totalMatchingHours += hours;
            }
        });
        const avgMatchingHours = matchingCount > 0 ? totalMatchingHours / matchingCount : 0;

        // ワーカーあたり指標
        const periodUserIds = new Set(periodApps.map(a => a.user_id));
        const activeWorkerCount = periodUserIds.size || 1;
        const applicationsPerWorker = applicationCount / activeWorkerCount;
        const matchingsPerWorker = matchingCount / activeWorkerCount;

        const periodReviews = reviews.filter(r =>
            r.created_at >= periodStart && r.created_at <= periodEnd
        );
        const workerReviewCount = periodReviews.filter(r => r.reviewer_type === 'FACILITY').length;
        const reviewsPerWorker = workerReviewCount / activeWorkerCount;

        // 施設あたり指標
        const periodFacilityIds = new Set(periodApps.map(a => a.workDate?.job?.facility_id).filter(Boolean));
        const activeFacilityCount = periodFacilityIds.size || 1;
        const parentJobsPerFacility = parentJobCount / activeFacilityCount;
        const childJobsPerFacility = childJobCount / activeFacilityCount;
        const matchingsPerFacility = matchingCount / activeFacilityCount;
        const facilityReviewCount = periodReviews.filter(r => r.reviewer_type === 'WORKER').length;
        const reviewsPerFacility = facilityReviewCount / activeFacilityCount;

        return {
            date: dateStr,
            parentJobCount,
            childJobCount,
            totalSlots,
            remainingSlots,
            applicationCount,
            matchingCount,
            avgMatchingHours: Math.round(avgMatchingHours * 10) / 10,
            applicationsPerWorker: Math.round(applicationsPerWorker * 100) / 100,
            matchingsPerWorker: Math.round(matchingsPerWorker * 100) / 100,
            reviewsPerWorker: Math.round(reviewsPerWorker * 100) / 100,
            parentJobsPerFacility: Math.round(parentJobsPerFacility * 100) / 100,
            childJobsPerFacility: Math.round(childJobsPerFacility * 100) / 100,
            matchingsPerFacility: Math.round(matchingsPerFacility * 100) / 100,
            reviewsPerFacility: Math.round(reviewsPerFacility * 100) / 100
        };
    });

    return results;
}

// ========== 条件付き表示ロジック ==========
// Moved to component or utility file to avoid server action error

// ========== 地域管理 ==========

// 地域データの型定義
export interface RegionData {
    id: number;
    name: string;
    prefectureCities: Record<string, string[]>; // { "東京都": [], "神奈川県": ["横浜市"] }
}

export async function getAnalyticsRegions(): Promise<RegionData[]> {
    const regions = await prisma.analyticsRegion.findMany({
        orderBy: { name: 'asc' }
    });
    return regions.map(r => ({
        id: r.id,
        name: r.name,
        prefectureCities: (r.prefecture_cities as Record<string, string[]>) || {}
    }));
}

export async function createAnalyticsRegion(data: {
    name: string;
    prefectureCities: Record<string, string[]>;
}) {
    return prisma.analyticsRegion.create({
        data: {
            name: data.name,
            prefecture_cities: data.prefectureCities
        }
    });
}

export async function updateAnalyticsRegion(id: number, data: {
    name: string;
    prefectureCities: Record<string, string[]>;
}) {
    return prisma.analyticsRegion.update({
        where: { id },
        data: {
            name: data.name,
            prefecture_cities: data.prefectureCities
        }
    });
}

export async function deleteAnalyticsRegion(id: number) {
    return prisma.analyticsRegion.delete({ where: { id } });
}

// ========== エクスポート用 ==========

export interface ExportOptions {
    startDate: Date;
    endDate: Date;
    metrics: {
        worker: string[];   // 選択されたワーカー指標
        facility: string[]; // 選択された施設指標
        matching: string[]; // 選択されたマッチング指標
    };
    filter: AnalyticsFilter;
}

export async function getExportData(options: ExportOptions) {
    const filter: AnalyticsFilter = {
        ...options.filter,
        startDate: options.startDate,
        endDate: options.endDate,
        viewMode: 'daily'
    };

    const [workerData, facilityData, matchingData] = await Promise.all([
        options.metrics.worker.length > 0 ? getWorkerAnalyticsData(filter) : [],
        options.metrics.facility.length > 0 ? getFacilityAnalyticsData(filter) : [],
        options.metrics.matching.length > 0 ? getMatchingAnalyticsData(filter) : []
    ]);

    return { workerData, facilityData, matchingData };
}

// Constants moved to @/src/lib/analytics-constants.ts

// ========== 後方互換性用エイリアス（既存UIコンポーネント用） ==========

interface LegacyFilter {
    period: 'daily' | 'monthly' | 'range';
    startDate?: Date;
    endDate?: Date;
    prefecture?: string;
    gender?: string;
    ageRange?: string;
    qualification?: string;
    facilityType?: string;
}

/** @deprecated Use getWorkerAnalyticsData instead */
export async function getWorkerAnalytics(filter: LegacyFilter) {
    const newFilter: AnalyticsFilter = {
        viewMode: filter.period === 'monthly' ? 'monthly' : 'daily',
        startDate: filter.startDate,
        endDate: filter.endDate,
        ageRange: filter.ageRange,
        qualification: filter.qualification
    };
    const data = await getWorkerAnalyticsData(newFilter);
    return {
        trends: data.map(d => ({ date: d.date, count: d.newCount })),
        total: data.length > 0 ? data[data.length - 1].registeredCount : 0
    };
}

/** @deprecated Use getFacilityAnalyticsData instead */
export async function getFacilityAnalytics(filter: LegacyFilter) {
    const newFilter: AnalyticsFilter = {
        viewMode: filter.period === 'monthly' ? 'monthly' : 'daily',
        startDate: filter.startDate,
        endDate: filter.endDate,
        facilityType: filter.facilityType
    };
    const data = await getFacilityAnalyticsData(newFilter);
    return {
        trends: data.map(d => ({ date: d.date, count: d.newCount })),
        total: data.length > 0 ? data[data.length - 1].registeredCount : 0
    };
}

/** @deprecated Use getMatchingAnalyticsData instead */
export async function getJobAnalytics(filter: LegacyFilter) {
    const newFilter: AnalyticsFilter = {
        viewMode: filter.period === 'monthly' ? 'monthly' : 'daily',
        startDate: filter.startDate,
        endDate: filter.endDate,
        facilityType: filter.facilityType
    };
    const data = await getMatchingAnalyticsData(newFilter);
    return {
        jobs: data.map(d => ({
            date: d.date,
            total: d.parentJobCount,
            published: d.parentJobCount,
            interview: 0
        })),
        applications: data.map(d => ({
            date: d.date,
            total: d.applicationCount,
            matched: d.matchingCount
        })),
        summary: {
            totalJobs: data.reduce((sum, d) => sum + d.parentJobCount, 0),
            totalApplications: data.reduce((sum, d) => sum + d.applicationCount, 0),
            totalMatches: data.reduce((sum, d) => sum + d.matchingCount, 0)
        }
    };
}

/** @deprecated Will be replaced with new implementation */
export async function getReviewAnalytics(filter: LegacyFilter) {
    const newFilter: AnalyticsFilter = {
        viewMode: filter.period === 'monthly' ? 'monthly' : 'daily',
        startDate: filter.startDate,
        endDate: filter.endDate,
        facilityType: filter.facilityType
    };

    // 簡易実装：ワーカーデータからレビュー情報を取得
    const workerData = await getWorkerAnalyticsData(newFilter);
    const facilityData = await getFacilityAnalyticsData(newFilter);

    return {
        trends: workerData.map((w, i) => ({
            date: w.date,
            workerCount: w.reviewCount,
            workerAvg: w.reviewAvg,
            facilityCount: facilityData[i]?.reviewCount || 0,
            facilityAvg: facilityData[i]?.reviewAvg || 0
        }))
    };
}
