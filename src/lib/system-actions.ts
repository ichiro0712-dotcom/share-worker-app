'use server';

import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, format, subMonths, startOfMonth, endOfMonth, differenceInHours } from 'date-fns';
import bcrypt from 'bcryptjs';
import { JobStatus } from '@prisma/client';
import { generateLaborDocumentPdf } from '@/src/lib/laborDocumentPdf';
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server';
import { createFacilityAdminSession } from '@/lib/admin-session-server';
import { geocodeAddress } from '@/src/lib/geocoding';
import { sendAdminNewFacilityNotification, sendAdminNewWorkerNotification, sendAdminHighCancelRateNotification, sendAdminLowRatingStreakNotification } from '@/src/lib/actions/notification';
import { generateUniqueEmergencyCode, generateQRSecretToken } from '@/src/lib/emergency-code-utils';
export { geocodeAddress };



export interface AnalyticsFilter {
    period: 'daily' | 'monthly' | 'range';
    startDate?: Date;
    endDate?: Date;
}

/**
 * ダッシュボードの主要な数値を一括取得
 */
export async function getDashboardStats() {
    // 認証チェック
    await requireSystemAdminAuth();

    const [
        totalWorkers,
        totalFacilities,
        activeJobs,
        totalApplications
    ] = await Promise.all([
        prisma.user.count(),
        prisma.facility.count(),
        prisma.job.count({ where: { status: 'PUBLISHED' } }),
        prisma.application.count()
    ]);

    return {
        totalWorkers,
        totalFacilities,
        activeJobs,
        totalApplications
    };
}

/**
 * ワーカー登録推移（直近30日）
 */
export async function getWorkerRegistrationTrends() {
    await requireSystemAdminAuth();
    const endDate = new Date();
    const startDate = subDays(endDate, 30);

    const workers = await prisma.user.findMany({
        where: {
            created_at: {
                gte: startDate,
                lte: endDate,
            },
        },
        select: {
            created_at: true,
        },
    });

    // 日付ごとに集計
    const trends: Record<string, number> = {};
    for (let i = 0; i <= 30; i++) {
        const d = subDays(endDate, i);
        const key = format(d, 'MM/dd');
        trends[key] = 0;
    }

    workers.forEach(w => {
        const key = format(w.created_at, 'MM/dd');
        if (trends[key] !== undefined) {
            trends[key]++;
        }
    });

    return Object.entries(trends)
        .sort((a, b) => a[0].localeCompare(b[0])) // 日付順
        .map(([date, count]) => ({ date, count }));
}

/**
 * ワーカー属性分析（性別、年齢層、資格）
 */
export async function getWorkerDemographics() {
    await requireSystemAdminAuth();
    const users = await prisma.user.findMany({
        select: {
            gender: true,
            birth_date: true,
            qualifications: true,
        },
    });

    const genderStats: Record<string, number> = { '男性': 0, '女性': 0, 'その他': 0 };
    const ageStats: Record<string, number> = { '20代以下': 0, '30代': 0, '40代': 0, '50代': 0, '60代以上': 0 };
    const qualStats: Record<string, number> = {};

    const now = new Date();

    users.forEach(u => {
        // 性別
        if (u.gender === '男性' || u.gender === '女性') {
            genderStats[u.gender]++;
        } else {
            genderStats['その他']++;
        }

        // 年齢
        if (u.birth_date) {
            const birth = new Date(u.birth_date);
            let age = now.getFullYear() - birth.getFullYear();
            if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
                age--;
            }

            if (age < 30) ageStats['20代以下']++;
            else if (age < 40) ageStats['30代']++;
            else if (age < 50) ageStats['40代']++;
            else if (age < 60) ageStats['50代']++;
            else ageStats['60代以上']++;
        }

        // 資格
        u.qualifications.forEach(q => {
            qualStats[q] = (qualStats[q] || 0) + 1;
        });
    });

    return {
        gender: Object.entries(genderStats).map(([name, value]) => ({ name, value })),
        age: Object.entries(ageStats).map(([name, value]) => ({ name, value })),
        qualifications: Object.entries(qualStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5), // Top 5
    };
}

/**
 * サービス種別ごとの登録数
 */
export async function getFacilityTypeStats() {
    await requireSystemAdminAuth();
    const facilities = await prisma.facility.groupBy({
        by: ['facility_type'],
        _count: {
            _all: true,
        },
    });

    return facilities.map(f => ({
        name: f.facility_type,
        value: f._count._all,
    }));
}

/**
 * Haversine公式による2点間の距離を計算（km）
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * 国土地理院APIで住所から座標を取得
 */


/**
 * システム管理用：ワーカー一覧取得（フィルター対応版 - 拡張版）
 */
export async function getSystemWorkers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    filters?: {
        status?: 'all' | 'active' | 'suspended';
        prefecture?: string;
        city?: string;
        qualification?: string;
        // 距離検索用
        distanceFrom?: {
            lat: number;
            lng: number;
            maxDistance: number; // km
        };
    }
) {
    // 認証チェック - 機密データへのアクセス
    await requireSystemAdminAuth();

    const skip = (page - 1) * limit;

    const where: any = {};

    // 検索条件（IDも検索可能に）
    if (search) {
        const searchTerm = search.trim();
        // IDで検索（数字のみの場合）
        if (/^\d+$/.test(searchTerm)) {
            where.OR = [
                { id: parseInt(searchTerm, 10) },
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phone_number: { contains: searchTerm, mode: 'insensitive' } },
            ];
        } else {
            where.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phone_number: { contains: searchTerm, mode: 'insensitive' } },
            ];
        }
    }

    // フィルター条件
    if (filters) {
        // ステータスフィルター
        if (filters.status === 'active') {
            where.is_suspended = false;
        } else if (filters.status === 'suspended') {
            where.is_suspended = true;
        }

        // 都道府県フィルター
        if (filters.prefecture) {
            where.prefecture = filters.prefecture;
        }

        // 市区町村フィルター
        if (filters.city) {
            where.city = filters.city;
        }

        // 資格フィルター
        if (filters.qualification) {
            where.qualifications = {
                has: filters.qualification
            };
        }
    }

    // 距離検索または計算フィールドでのソートの場合は全件取得してJS側で処理
    const isCalculatedSort = ['totalWorkCount', 'avgRating', 'reviewCount'].includes(sort);
    const isDistanceSearch = filters?.distanceFrom && filters.distanceFrom.lat && filters.distanceFrom.lng;

    let workers;
    let total;

    if (isDistanceSearch || isCalculatedSort) {
        // 全件取得（必要なフィールドのみ）
        const allWorkers = await prisma.user.findMany({
            where: {
                ...where,
                ...(isDistanceSearch ? { AND: [{ lat: { not: { equals: null } } }, { lng: { not: { equals: null } } }] } : {})
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone_number: true,
                created_at: true,
                qualifications: true,
                profile_image: true,
                prefecture: true,
                city: true,
                gender: true,
                birth_date: true,
                is_suspended: true,
                lat: true,
                lng: true,
                notifications: false, // 負荷軽減のため除外
            },
            orderBy: !isCalculatedSort ? { [sort]: order } : undefined, // 通常ソートならDB側で
        });

        // 評価と勤務回数を一括取得
        const workerIds = allWorkers.map(w => w.id);
        const [reviews, applications] = await Promise.all([
            prisma.review.findMany({
                where: {
                    user_id: { in: workerIds },
                    reviewer_type: 'FACILITY',
                },
                select: { user_id: true, rating: true },
            }),
            prisma.application.findMany({
                where: {
                    user_id: { in: workerIds },
                    status: { in: ['COMPLETED_PENDING', 'COMPLETED_RATED'] },
                },
                select: { user_id: true },
            }),
        ]);

        // マップ作成
        const reviewStats = new Map<number, { sum: number; count: number }>();
        reviews.forEach(r => {
            const stat = reviewStats.get(r.user_id) || { sum: 0, count: 0 };
            stat.sum += r.rating;
            stat.count += 1;
            reviewStats.set(r.user_id, stat);
        });

        const workCounts = new Map<number, number>();
        applications.forEach(a => {
            workCounts.set(a.user_id, (workCounts.get(a.user_id) || 0) + 1);
        });

        // データ整形と計算
        let processedWorkers = allWorkers.map(w => {
            const stat = reviewStats.get(w.id);
            const avgRating = stat ? stat.sum / stat.count : 0;
            const reviewCount = stat?.count || 0;
            const totalWorkCount = workCounts.get(w.id) || 0;

            let distance = null;
            if (isDistanceSearch && filters?.distanceFrom) {
                distance = calculateDistance(
                    filters.distanceFrom.lat,
                    filters.distanceFrom.lng,
                    w.lat!,
                    w.lng!
                );
            }

            return {
                ...w,
                avgRating,
                reviewCount,
                totalWorkCount,
                distance,
                isSuspended: w.is_suspended || false,
                age: null, // 後で計算
            };
        });

        // フィルタリング（距離）
        if (isDistanceSearch && filters?.distanceFrom) {
            processedWorkers = processedWorkers.filter(w => (w.distance as number) <= filters.distanceFrom!.maxDistance);
        }

        // ソート
        if (isCalculatedSort) {
            processedWorkers.sort((a, b) => {
                const valA = (a as any)[sort];
                const valB = (b as any)[sort];
                return order === 'asc' ? valA - valB : valB - valA;
            });
        } else if (isDistanceSearch && sort === 'distance') { // sort by distance if specified or default for distance search?
            processedWorkers.sort((a, b) => (a.distance as number) - (b.distance as number));
        }

        total = processedWorkers.length;
        const pagedWorkers = processedWorkers.slice(skip, skip + limit);

        // 年齢計算ヘルパー
        const calculateAge = (birthDate: Date | null): number | null => {
            if (!birthDate) return null;
            const now = new Date();
            const birth = new Date(birthDate);
            let age = now.getFullYear() - birth.getFullYear();
            if (now.getMonth() < birth.getMonth() ||
                (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        };

        return {
            workers: pagedWorkers.map(w => ({
                ...w,
                age: calculateAge(w.birth_date),
            })),
            total,
            totalPages: Math.ceil(total / limit),
        };

    } else {
        // 通常のDB検索（既存ロジック）
        [workers, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sort]: order },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone_number: true,
                    created_at: true,
                    qualifications: true,
                    profile_image: true,
                    prefecture: true,
                    city: true,
                    gender: true,
                    birth_date: true,
                    is_suspended: true,
                    lat: true,
                    lng: true,
                },
            }),
            prisma.user.count({ where }),
        ]);

        // ... (以下、既存の集計ロジックを流用したいが、構造が変わるので再実装) ...

        const workerIds = workers.map(w => w.id);

        const [reviews, applications] = await Promise.all([
            prisma.review.findMany({
                where: {
                    user_id: { in: workerIds },
                    reviewer_type: 'FACILITY',
                },
                select: { user_id: true, rating: true },
            }),
            prisma.application.findMany({
                where: {
                    user_id: { in: workerIds },
                    status: { in: ['COMPLETED_PENDING', 'COMPLETED_RATED'] },
                },
                select: { user_id: true },
            }),
        ]);

        const reviewStats = new Map<number, { sum: number; count: number }>();
        reviews.forEach(r => {
            const stat = reviewStats.get(r.user_id) || { sum: 0, count: 0 };
            stat.sum += r.rating;
            stat.count += 1;
            reviewStats.set(r.user_id, stat);
        });

        const workCounts = new Map<number, number>();
        applications.forEach(a => {
            workCounts.set(a.user_id, (workCounts.get(a.user_id) || 0) + 1);
        });

        // 年齢計算ヘルパー
        const calculateAge = (birthDate: Date | null): number | null => {
            if (!birthDate) return null;
            const now = new Date();
            const birth = new Date(birthDate);
            let age = now.getFullYear() - birth.getFullYear();
            if (now.getMonth() < birth.getMonth() ||
                (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        };

        return {
            workers: workers.map(w => {
                const stat = reviewStats.get(w.id);
                return {
                    ...w,
                    isSuspended: w.is_suspended || false,
                    age: calculateAge(w.birth_date),
                    avgRating: stat ? stat.sum / stat.count : null,
                    reviewCount: stat?.count || 0,
                    totalWorkCount: workCounts.get(w.id) || 0,
                    distance: null,
                };
            }),
            total,
            totalPages: Math.ceil(total / limit),
        };
    }
}

/**
 * システム管理用：ワーカー詳細取得（拡張版）
 */
export async function getSystemWorkerDetail(id: number) {
    await requireSystemAdminAuth();
    const worker = await prisma.user.findUnique({
        where: { id },
        include: {
            reviews: {
                include: {
                    facility: {
                        select: { facility_name: true }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 10
            },
            applications: {
                orderBy: { created_at: 'desc' },
                include: {
                    workDate: {
                        include: {
                            job: {
                                include: {
                                    facility: {
                                        select: { facility_name: true, facility_type: true }
                                    }
                                }
                            }
                        }
                    }
                },
            },
        },
    });

    if (!worker) return null;

    // 勤務実績を集計（COMPLETED_PENDING または COMPLETED_RATED を完了とみなす）
    const completedApplications = worker.applications.filter(app =>
        app.status === 'COMPLETED_PENDING' || app.status === 'COMPLETED_RATED'
    );
    const canceledApplications = worker.applications.filter(app => app.status === 'CANCELLED');
    const totalWorkDays = completedApplications.length;
    const cancelRate = worker.applications.length > 0
        ? (canceledApplications.length / worker.applications.length) * 100
        : 0;

    // 評価の平均を計算
    const totalAvgRating = worker.reviews.length > 0
        ? worker.reviews.reduce((sum, r) => sum + r.rating, 0) / worker.reviews.length
        : 0;

    // 項目別評価の計算
    const ratingsByCategory = worker.reviews.length > 0 ? {
        attendance: worker.reviews.reduce((sum, r) => sum + (r.rating_attendance || 0), 0) / worker.reviews.length,
        skill: worker.reviews.reduce((sum, r) => sum + (r.rating_skill || 0), 0) / worker.reviews.length,
        execution: worker.reviews.reduce((sum, r) => sum + (r.rating_execution || 0), 0) / worker.reviews.length,
        communication: worker.reviews.reduce((sum, r) => sum + (r.rating_communication || 0), 0) / worker.reviews.length,
        attitude: worker.reviews.reduce((sum, r) => sum + (r.rating_attitude || 0), 0) / worker.reviews.length,
    } : null;

    // 直近の勤務予定を取得（SCHEDULED または WORKING を予定確定とみなす）
    const upcomingSchedules = worker.applications
        .filter(app => (app.status === 'SCHEDULED' || app.status === 'WORKING') && new Date(app.workDate.work_date) >= new Date())
        .sort((a, b) => new Date(a.workDate.work_date).getTime() - new Date(b.workDate.work_date).getTime())
        .slice(0, 5)
        .map(app => ({
            id: app.id,
            workDate: app.workDate.work_date,
            startTime: app.workDate.job.start_time,
            endTime: app.workDate.job.end_time,
            jobTitle: app.workDate.job.title,
            facilityName: app.workDate.job.facility.facility_name,
        }));

    // 勤務履歴（完了済み）
    const workHistory = completedApplications.slice(0, 10).map(app => ({
        id: app.id,
        jobTitle: app.workDate.job.title,
        workDate: app.workDate.work_date,
        facilityName: app.workDate.job.facility.facility_name,
        status: app.status,
    }));

    // サービス種別ごとの評価（仮実装）
    const facilityTypeRatings: Record<string, { sum: number; count: number }> = {};
    worker.reviews.forEach(review => {
        // reviewにfacility_typeがない場合はスキップ
        // ここでは仮にすべてを「未分類」として扱う
    });

    // 年齢計算
    let age: number | null = null;
    if (worker.birth_date) {
        const now = new Date();
        const birth = new Date(worker.birth_date);
        age = now.getFullYear() - birth.getFullYear();
        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
            age--;
        }
    }

    return {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        phone_number: worker.phone_number,
        profile_image: worker.profile_image,
        qualifications: worker.qualifications,
        birth_date: worker.birth_date,
        age,
        gender: worker.gender,
        nationality: worker.nationality,
        last_name_kana: worker.last_name_kana,
        first_name_kana: worker.first_name_kana,
        postal_code: worker.postal_code,
        prefecture: worker.prefecture,
        city: worker.city,
        address_line: worker.address_line,
        building: worker.building,
        emergency_name: worker.emergency_name,
        emergency_relation: worker.emergency_relation,
        emergency_phone: worker.emergency_phone,
        emergency_address: worker.emergency_address,
        current_work_style: worker.current_work_style,
        desired_work_style: worker.desired_work_style,
        job_change_desire: worker.job_change_desire,
        desired_work_days_week: worker.desired_work_days_week,
        desired_work_period: worker.desired_work_period,
        desired_work_days: worker.desired_work_days,
        desired_start_time: worker.desired_start_time,
        desired_end_time: worker.desired_end_time,
        experience_fields: worker.experience_fields,
        work_histories: worker.work_histories,
        self_pr: worker.self_pr,
        bank_name: worker.bank_name,
        branch_name: worker.branch_name,
        account_name: worker.account_name,
        account_number: worker.account_number,
        pension_number: worker.pension_number,
        created_at: worker.created_at,
        isSuspended: worker.is_suspended || false,
        suspendedAt: worker.suspended_at,
        // 集計データ
        totalWorkDays,
        cancelRate,
        totalAvgRating,
        totalReviewCount: worker.reviews.length,
        ratingsByCategory,
        upcomingSchedules,
        workHistory,
        reviews: worker.reviews.slice(0, 5).map(r => ({
            id: r.id,
            rating: r.rating,
            comment: r.good_points || r.improvements || '',
            created_at: r.created_at,
            reviewerName: r.facility?.facility_name || '匿名',
        })),
        qualificationCertificates: worker.qualification_certificates,
    };
}

/**
 * システム管理用：ワーカーアカウント停止/解除
 */
export async function toggleWorkerSuspension(id: number, suspend: boolean) {
    await requireSystemAdminAuth();
    try {
        const worker = await prisma.user.update({
            where: { id },
            data: {
                is_suspended: suspend,
                suspended_at: suspend ? new Date() : null,
            },
        });

        return { success: true, isSuspended: worker.is_suspended };
    } catch (error) {
        console.error('Failed to toggle suspension:', error);
        return { success: false, error: '更新に失敗しました' };
    }
}

/**
 * システム管理用：施設一覧取得
 */
export async function getSystemFacilities(
    page: number = 1,
    limit: number = 20,
    search?: string,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc'
) {
    await requireSystemAdminAuth();
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
        where.OR = [
            { facility_name: { contains: search, mode: 'insensitive' } },
            { facility_type: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [facilities, total] = await Promise.all([
        prisma.facility.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sort]: order },
            include: {
                _count: {
                    select: {
                        jobs: true,
                    }
                }
            }
        }),
        prisma.facility.count({ where }),
    ]);

    return {
        facilities,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

/**
 * 施設管理者としてログインするためのトークンを生成
 */
export async function generateMasqueradeToken(facilityId: number, adminId: number) {
    await requireSystemAdminAuth();
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    await prisma.systemLog.create({
        data: {
            admin_id: adminId,
            action: 'MASQUERADE_INIT',
            target_type: 'Facility',
            target_id: facilityId,
            details: { token, expiresAt: Date.now() + 5 * 60 * 1000 },
        },
    });

    return token;
}

/**
 * ワーカーとしてログインするためのトークンを生成
 */
export async function generateWorkerMasqueradeToken(workerId: number) {
    await requireSystemAdminAuth();
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // ワーカーの存在確認
    const worker = await prisma.user.findUnique({
        where: { id: workerId },
        select: { id: true, name: true, email: true },
    });

    if (!worker) {
        return { success: false, error: 'ワーカーが見つかりません' };
    }

    // マスカレードログを記録
    await prisma.systemLog.create({
        data: {
            admin_id: 1, // TODO: 実際のシステム管理者IDを取得
            action: 'WORKER_MASQUERADE_INIT',
            target_type: 'User',
            target_id: workerId,
            details: { token, expiresAt: Date.now() + 5 * 60 * 1000, workerName: worker.name },
        },
    });

    return { success: true, token };
}

/**
 * ワーカーマスカレードトークンを検証し、ワーカーセッションデータを返す
 */
export async function verifyWorkerMasqueradeToken(token: string) {
    const log = await prisma.systemLog.findFirst({
        where: {
            action: 'WORKER_MASQUERADE_INIT',
            details: {
                path: ['token'],
                equals: token,
            },
        },
        orderBy: { created_at: 'desc' },
    });

    if (!log || !log.target_id) {
        return { success: false, error: 'トークンが無効です' };
    }

    const details = log.details as any;
    if (Date.now() > details.expiresAt) {
        return { success: false, error: 'トークンの有効期限が切れています' };
    }

    const worker = await prisma.user.findUnique({
        where: { id: log.target_id },
        select: {
            id: true,
            name: true,
            email: true,
            profile_image: true,
        },
    });

    if (!worker) {
        return { success: false, error: 'ワーカーが存在しません' };
    }

    // マスカレード開始をログに記録
    await prisma.systemLog.create({
        data: {
            admin_id: log.admin_id,
            action: 'WORKER_MASQUERADE_START',
            target_type: 'User',
            target_id: worker.id,
            details: { workerName: worker.name, workerEmail: worker.email },
        },
    });

    return {
        success: true,
        worker: {
            id: worker.id,
            name: worker.name,
            email: worker.email,
            profileImage: worker.profile_image,
        },
        systemAdminId: log.admin_id,
    };
}

/**
 * マスカレードトークンを検証し、施設管理者セッションデータを返す
 */
export async function verifyMasqueradeToken(token: string) {
    const log = await prisma.systemLog.findFirst({
        where: {
            action: 'MASQUERADE_INIT',
            details: {
                path: ['token'],
                equals: token,
            },
        },
        orderBy: { created_at: 'desc' },
    });

    if (!log || !log.target_id) {
        return { success: false, error: 'トークンが無効です' };
    }

    const details = log.details as any;
    if (Date.now() > details.expiresAt) {
        return { success: false, error: 'トークンの有効期限が切れています' };
    }

    const facilityAdmin = await prisma.facilityAdmin.findFirst({
        where: { facility_id: log.target_id },
        orderBy: { is_primary: 'desc' },
        include: {
            facility: {
                select: {
                    facility_name: true,
                    is_pending: true,
                },
            },
        }
    });

    if (!facilityAdmin) {
        return { success: false, error: '施設管理者が存在しません' };
    }

    // サーバーサイドセッション（iron-session）を作成
    // これにより、API認証（withFacilityAuth）が正常に動作する
    await createFacilityAdminSession({
        adminId: facilityAdmin.id,
        facilityId: facilityAdmin.facility_id,
        name: facilityAdmin.name,
        email: facilityAdmin.email,
        role: 'admin',
    });

    return {
        success: true,
        admin: {
            id: facilityAdmin.id,
            email: facilityAdmin.email,
            facilityId: facilityAdmin.facility_id,
            name: facilityAdmin.name,
            phone: facilityAdmin.phone_number || undefined,
            role: 'admin',
            facilityName: facilityAdmin.facility.facility_name,
            isPending: facilityAdmin.facility.is_pending,
        }
    };
}

/**
 * システム管理用：施設一覧取得（拡張版）
 */
export async function getSystemFacilitiesExtended(
    page: number = 1,
    limit: number = 20,
    search?: string,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    filters?: {
        facilityType?: string;
        prefecture?: string;
        city?: string;
        distanceFrom?: {
            lat: number;
            lng: number;
            maxDistance: number;
        };
    }
) {
    await requireSystemAdminAuth();
    try {
        const skip = (page - 1) * limit;
        const where: any = {};

        // 検索条件
        if (search) {
            const searchTerm = search.trim();
            if (/^\d+$/.test(searchTerm)) {
                where.OR = [
                    { id: parseInt(searchTerm, 10) },
                    { facility_name: { contains: searchTerm, mode: 'insensitive' } },
                    { corporation_name: { contains: searchTerm, mode: 'insensitive' } },
                    { prefecture: { contains: searchTerm, mode: 'insensitive' } },
                    { city: { contains: searchTerm, mode: 'insensitive' } },
                    { address_line: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } },
                    { manager_email: { contains: searchTerm, mode: 'insensitive' } },
                    { staff_email: { contains: searchTerm, mode: 'insensitive' } },
                ];
            } else {
                where.OR = [
                    { facility_name: { contains: searchTerm, mode: 'insensitive' } },
                    { corporation_name: { contains: searchTerm, mode: 'insensitive' } },
                    { prefecture: { contains: searchTerm, mode: 'insensitive' } },
                    { city: { contains: searchTerm, mode: 'insensitive' } },
                    { address_line: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } },
                    { manager_email: { contains: searchTerm, mode: 'insensitive' } },
                    { staff_email: { contains: searchTerm, mode: 'insensitive' } },
                ];
            }
        }

        // フィルター
        if (filters) {
            if (filters.facilityType) {
                where.facility_type = filters.facilityType;
            }
            if (filters.prefecture) {
                where.prefecture = filters.prefecture;
            }
            if (filters.city) {
                where.city = filters.city;
            }
        }

        // 計算フィールドでのソートかどうか
        const calculatedSortFields = [
            'parentJobCount',
            'childJobCount',
            'applicationCount',
            'matchingCount',
            'avgApplicationMatchingPeriod',
            'avgJobMatchingPeriod',
            'distance'
        ];
        const isCalculatedSort = calculatedSortFields.includes(sort);
        const isDistanceSearch = filters?.distanceFrom && filters.distanceFrom.lat && filters.distanceFrom.lng;

        if (isCalculatedSort || isDistanceSearch) {
            // 全件取得してJS処理
            // 施設のlat/lngは @default(0) でnullableではないため、0以外の値を持つものを検索
            const allFacilities = await prisma.facility.findMany({
                where: {
                    ...where,
                    ...(isDistanceSearch ? { AND: [{ lat: { not: 0 } }, { lng: { not: 0 } }] } : {})
                },
                include: {
                    jobs: {
                        include: {
                            workDates: {
                                include: {
                                    applications: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            reviews: true
                        }
                    }
                }
            });

            // データ加工
            let processed = allFacilities.map(f => {
                const parentJobCount = f.jobs.length;
                const childJobCount = f.jobs.reduce((sum, j) => sum + j.workDates.length, 0);

                // 全応募のフラットリスト
                const allApplications = f.jobs.flatMap(j => j.workDates.flatMap(wd => wd.applications));
                const applicationCount = allApplications.length;

                // SCHEDULED以上のステータスをマッチングとみなす
                // JobStatusではなくWorkerStatus: APPLIED, SCHEDULED, WORKING, COMPLETED_PENDING, COMPLETED_RATED, CANCELLED
                const matchedApps = allApplications.filter(a =>
                    ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(a.status)
                );
                const matchingCount = matchedApps.length;

                // 応募マッチング期間 (updated_at - created_at)
                // statusがSCHEDULED以上の場合、updated_atをマッチング時刻とみなす（厳密ではないが指示通り）
                const appPeriods = matchedApps.map(a =>
                    (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
                );
                const avgApplicationMatchingPeriod = appPeriods.length > 0
                    ? appPeriods.reduce((a, b) => a + b, 0) / appPeriods.length
                    : 0;

                // 求人マッチング期間 (最初のマッチング時刻 - Job.created_at)
                // Jobごとに最初のマッチングを探す
                const jobPeriods = f.jobs.map(j => {
                    const jobApps = j.workDates.flatMap(wd => wd.applications)
                        .filter(a => ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(a.status));

                    if (jobApps.length === 0) return null;

                    // 最初に応募日時ではなくステータス更新日時が早いもの
                    // ここでは Application.updated_at の最小値を使う
                    const firstMatch = jobApps.reduce((min, a) =>
                        new Date(a.updated_at) < new Date(min.updated_at) ? a : min
                        , jobApps[0]);

                    return (new Date(firstMatch.updated_at).getTime() - new Date(j.created_at).getTime()) / (1000 * 60 * 60);
                }).filter(p => p !== null) as number[];

                const avgJobMatchingPeriod = jobPeriods.length > 0
                    ? jobPeriods.reduce((a, b) => a + b, 0) / jobPeriods.length
                    : 0;

                let distance: number | null = null;
                if (isDistanceSearch && filters?.distanceFrom && f.lat !== null && f.lng !== null) {
                    distance = calculateDistance(
                        filters.distanceFrom.lat,
                        filters.distanceFrom.lng,
                        f.lat,
                        f.lng
                    );
                }

                return {
                    ...f,
                    parentJobCount,
                    childJobCount,
                    applicationCount,
                    matchingCount,
                    avgApplicationMatchingPeriod,
                    avgJobMatchingPeriod,
                    distance,
                    // jobsデータが重いので削除して返す
                    jobs: undefined
                };
            });

            // 距離フィルタ（distanceがnullの場合は除外）
            if (isDistanceSearch && filters?.distanceFrom) {
                processed = processed.filter(f =>
                    f.distance !== null && f.distance <= filters.distanceFrom!.maxDistance
                );
            }

            // ソート
            processed.sort((a, b) => {
                const valA = (a as any)[sort] || 0;
                const valB = (b as any)[sort] || 0;
                return order === 'asc' ? valA - valB : valB - valA;
            });

            const total = processed.length;
            const paged = processed.slice(skip, skip + limit);

            return {
                facilities: paged,
                total,
                totalPages: Math.ceil(total / limit)
            };
        } else {
            // DB検索
            const [facilities, total] = await Promise.all([
                prisma.facility.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sort]: order },
                    include: {
                        _count: {
                            select: {
                                jobs: true,
                                reviews: true
                            }
                        },
                        jobs: {
                            select: {
                                id: true,
                                workDates: {
                                    select: {
                                        id: true,
                                        applications: {
                                            select: {
                                                id: true,
                                                status: true,
                                                created_at: true,
                                                updated_at: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }),
                prisma.facility.count({ where }),
            ]);

            // 統計情報計算（ソートには使わないが表示に必要）
            const processed = facilities.map(f => {
                const parentJobCount = f._count.jobs;
                const childJobCount = f.jobs.reduce((sum, j) => sum + j.workDates.length, 0);
                const allApplications = f.jobs.flatMap(j => j.workDates.flatMap(wd => wd.applications));
                const applicationCount = allApplications.length;

                const matchedApps = allApplications.filter(a =>
                    ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(a.status)
                );
                const matchingCount = matchedApps.length;

                return {
                    ...f,
                    parentJobCount,
                    childJobCount,
                    applicationCount,
                    matchingCount,
                    avgApplicationMatchingPeriod: 0, // 一覧での詳細計算は負荷が高いのでスキップ（必要なら実装）
                    avgJobMatchingPeriod: 0,
                    jobs: undefined
                };
            });

            return {
                facilities: processed,
                total,
                totalPages: Math.ceil(total / limit)
            };
        }
    } catch (error) {
        console.error('[getSystemFacilitiesExtended] Error:', error);
        throw error;
    }
}

/**
 * 施設詳細取得（拡張版）
 */
export async function getSystemFacilityDetailExtended(id: number) {
    await requireSystemAdminAuth();
    const facility = await prisma.facility.findUnique({
        where: { id },
        include: {
            admins: true,
            reviews: {
                take: 5,
                orderBy: { created_at: 'desc' },
                include: { user: { select: { name: true, profile_image: true } } }
            },
            jobs: {
                take: 5,
                orderBy: { created_at: 'desc' },
                include: {
                    workDates: true
                }
            }
        }
    });

    if (!facility) return null;

    // 全期間の統計用データ取得
    const allJobs = await prisma.job.findMany({
        where: { facility_id: id },
        include: {
            workDates: {
                include: {
                    applications: true
                }
            }
        }
    });

    const parentJobCount = allJobs.length;
    const childJobCount = allJobs.reduce((sum, j) => sum + j.workDates.length, 0);
    const allApplications = allJobs.flatMap(j => j.workDates.flatMap(wd => wd.applications));
    const applicationCount = allApplications.length;

    const matchedApps = allApplications.filter(a =>
        ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(a.status)
    );
    const matchingCount = matchedApps.length;

    // 平均マッチング期間
    const appPeriods = matchedApps.map(a =>
        (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
    );
    const avgApplicationMatchingPeriod = appPeriods.length > 0
        ? appPeriods.reduce((a, b) => a + b, 0) / appPeriods.length
        : 0;

    const jobPeriods = allJobs.map(j => {
        const jobApps = j.workDates.flatMap(wd => wd.applications)
            .filter(a => ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(a.status));

        if (jobApps.length === 0) return null;

        const firstMatch = jobApps.reduce((min, a) =>
            new Date(a.updated_at) < new Date(min.updated_at) ? a : min
            , jobApps[0]);

        return (new Date(firstMatch.updated_at).getTime() - new Date(j.created_at).getTime()) / (1000 * 60 * 60);
    }).filter(p => p !== null) as number[];

    const avgJobMatchingPeriod = jobPeriods.length > 0
        ? jobPeriods.reduce((a, b) => a + b, 0) / jobPeriods.length
        : 0;

    return {
        ...facility,
        parentJobCount,
        childJobCount,
        applicationCount,
        matchingCount,
        avgApplicationMatchingPeriod,
        avgJobMatchingPeriod
    };
}

/**
 * 新規施設登録
 */
export async function createFacilityWithAdmin(data: {
    corporationName: string;
    facilityName: string;
    facilityType: string;
    postalCode?: string;
    prefecture: string;
    city: string;
    addressLine?: string;
    phoneNumber: string;
    description?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    adminPhone?: string;
}) {
    await requireSystemAdminAuth();
    // メールアドレス重複チェック
    const existingAdmin = await prisma.facilityAdmin.findUnique({
        where: { email: data.adminEmail }
    });
    if (existingAdmin) {
        return { success: false, error: 'このメールアドレスは既に使用されています' };
    }

    // ジオコーディング
    let lat = 0;
    let lng = 0;
    const address = `${data.prefecture}${data.city}${data.addressLine || ''}`;
    const location = await geocodeAddress(address);
    if (location) {
        lat = location.lat;
        lng = location.lng;
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(data.adminPassword, 10);

    // 緊急時出退勤番号とQRトークンを生成
    const emergencyCode = await generateUniqueEmergencyCode();
    const qrSecretToken = generateQRSecretToken();

    try {
        const result = await prisma.$transaction(async (tx) => {
            const facility = await tx.facility.create({
                data: {
                    corporation_name: data.corporationName,
                    facility_name: data.facilityName,
                    facility_type: data.facilityType,
                    prefecture: data.prefecture,
                    city: data.city,
                    address_line: data.addressLine,
                    address: address,
                    phone_number: data.phoneNumber,
                    description: data.description,
                    lat,
                    lng,
                    // 通知先メールアドレスに管理者のメールアドレスを初期設定
                    staff_email: data.adminEmail,
                    staff_emails: [data.adminEmail],
                    // 勤怠管理用
                    emergency_attendance_code: emergencyCode,
                    qr_secret_token: qrSecretToken,
                    qr_generated_at: new Date(),
                }
            });

            const admin = await tx.facilityAdmin.create({
                data: {
                    facility_id: facility.id,
                    name: data.adminName,
                    email: data.adminEmail,
                    password_hash: passwordHash,
                    phone_number: data.adminPhone,
                    is_primary: true,
                    role: 'admin'
                }
            });

            // ログ記録
            await tx.systemLog.create({
                data: {
                    admin_id: 1, // システム管理者ID
                    action: 'CREATE_FACILITY',
                    target_type: 'Facility',
                    target_id: facility.id,
                    details: { adminId: admin.id, facilityName: facility.facility_name }
                }
            });

            return facility;
        });

        // 管理者に新規施設登録を通知
        await sendAdminNewFacilityNotification(
            result.id,
            data.facilityName,
            data.corporationName
        );

        return { success: true, facility: result };
    } catch (error) {
        console.error('Create facility error:', error);
        return { success: false, error: '施設の作成に失敗しました' };
    }
}

/**
 * 施設の全求人を停止
 */
export async function stopAllFacilityJobs(facilityId: number) {
    await requireSystemAdminAuth();
    try {
        await prisma.job.updateMany({
            where: {
                facility_id: facilityId,
                status: 'PUBLISHED'
            },
            data: { status: 'STOPPED' }
        });

        await prisma.systemLog.create({
            data: {
                admin_id: 1,
                action: 'STOP_ALL_JOBS',
                target_type: 'Facility',
                target_id: facilityId,
            }
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: '求人の停止に失敗しました' };
    }
}

/**
 * パスワードリセットメール送信（モック）
 */
export async function sendPasswordResetEmail(adminId: number) {
    await requireSystemAdminAuth();
    try {
        const admin = await prisma.facilityAdmin.findUnique({ where: { id: adminId } });
        if (!admin) return { success: false, error: '管理者が存在しません' };

        // 実際にはここでトークン生成とメール送信を行う
        console.log(`Sending password reset email to ${admin.email}`);

        await prisma.systemLog.create({
            data: {
                admin_id: 1,
                action: 'SEND_PASSWORD_RESET',
                target_type: 'FacilityAdmin',
                target_id: adminId,
            }
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: 'メール送信に失敗しました' };
    }
}

/**
 * マッチング期間統計を取得（アナリティクス用）
 */
export async function getMatchingPeriodStats(facilityId?: number) {
    const whereClause = facilityId ? { facility_id: facilityId } : {};

    // Applicationベース（応募マッチング期間）
    // 直近3ヶ月などの制限を入れた方が良いかもしれないが、一旦全件
    const applications = await prisma.application.findMany({
        where: {
            status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
            workDate: {
                job: whereClause
            }
        },
        select: {
            created_at: true,
            updated_at: true
        }
    });

    const appPeriods = applications.map(a =>
        (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
    );
    const avgApplicationMatchingPeriod = appPeriods.length > 0
        ? appPeriods.reduce((a, b) => a + b, 0) / appPeriods.length
        : 0;

    // Jobベース（求人マッチング期間）
    const jobs = await prisma.job.findMany({
        where: {
            ...whereClause,
            status: { not: 'DRAFT' } // 公開されたもの
        },
        include: {
            workDates: {
                include: {
                    applications: {
                        where: {
                            status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] }
                        },
                        orderBy: { updated_at: 'asc' },
                        take: 1
                    }
                }
            }
        }
    });

    const jobPeriods = jobs.map(j => {
        // 全勤務日の中で最も早いマッチングを探す
        const firstMatches = j.workDates.flatMap(wd => wd.applications);
        if (firstMatches.length === 0) return null;

        const firstMatch = firstMatches.reduce((min, a) =>
            new Date(a.updated_at) < new Date(min.updated_at) ? a : min
            , firstMatches[0]);

        return (new Date(firstMatch.updated_at).getTime() - new Date(j.created_at).getTime()) / (1000 * 60 * 60);
    }).filter(p => p !== null) as number[];

    const avgJobMatchingPeriod = jobPeriods.length > 0
        ? jobPeriods.reduce((a, b) => a + b, 0) / jobPeriods.length
        : 0;

    return {
        avgApplicationMatchingPeriod,
        avgJobMatchingPeriod
    };
}


/**
 * システム管理用：施設詳細取得
 */
export async function getSystemFacilityDetail(id: number) {
    const facility = await prisma.facility.findUnique({
        where: { id },
        include: {
            admins: {
                select: { id: true, name: true, email: true, is_primary: true }
            },
            _count: {
                select: { jobs: true }
            }
        }
    });

    return facility;
}

/**
 * システム管理用：求人一覧取得
 */
export async function getSystemJobs(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc'
) {
    await requireSystemAdminAuth();
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { facility: { facility_name: { contains: search, mode: 'insensitive' } } },
        ];
    }

    if (status && status !== 'ALL') {
        where.status = status;
    }

    const [jobs, total] = await Promise.all([
        prisma.job.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sort]: order },
            include: {
                facility: {
                    select: { facility_name: true }
                },
                workDates: {
                    select: { applied_count: true }
                }
            }
        }),
        prisma.job.count({ where }),
    ]);

    return {
        jobs: jobs.map(job => ({
            ...job,
            applicationCount: job.workDates.reduce((sum, date) => sum + date.applied_count, 0)
        })),
        total,
        totalPages: Math.ceil(total / limit),
    };
}

/**
 * システム管理用：応募一覧取得
 */
export async function getSystemApplications(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc'
) {
    await requireSystemAdminAuth();
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
        where.OR = [
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { workDate: { job: { title: { contains: search, mode: 'insensitive' } } } },
            { workDate: { job: { facility: { facility_name: { contains: search, mode: 'insensitive' } } } } }
        ];
    }

    if (status && status !== 'ALL') {
        where.status = status;
    }

    const [applications, total] = await Promise.all([
        prisma.application.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sort]: order },
            include: {
                user: { select: { name: true, email: true } },
                workDate: {
                    include: {
                        job: {
                            select: { title: true, facility: { select: { facility_name: true } } }
                        }
                    }
                }
            }
        }),
        prisma.application.count({ where }),
    ]);

    return {
        applications: applications.map(app => ({
            id: app.id,
            status: app.status,
            createdAt: app.created_at,
            applicantName: app.user.name,
            applicantEmail: app.user.email,
            jobTitle: app.workDate.job.title,
            facilityName: app.workDate.job.facility.facility_name,
            workDate: app.workDate.work_date,
        })),
        total,
        totalPages: Math.ceil(total / limit),
    };
}

/**
 * お知らせ一覧取得
 */
export async function getSystemAnnouncements(
    page: number = 1,
    limit: number = 20,
    search?: string,
    targetType?: string,
    status?: string // 'PUBLISHED' | 'DRAFT'
) {
    await requireSystemAdminAuth();
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (targetType && targetType !== 'ALL') {
        where.target_type = targetType;
    }

    if (status) {
        if (status === 'PUBLISHED') {
            where.published = true;
        } else if (status === 'DRAFT') {
            where.published = false;
        }
    }

    const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
            where,
            skip,
            take: limit,
            orderBy: { created_at: 'desc' },
        }),
        prisma.announcement.count({ where }),
    ]);

    return {
        announcements,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

// お知らせフィルター条件の型定義
export interface AnnouncementFilterConditions {
    [key: string]: boolean | number[] | string[] | undefined;
    selectAll?: boolean;
    workerSelectAll?: boolean;
    facilitySelectAll?: boolean;
    regionIds?: number[];
    // ワーカー向け
    ageRanges?: string[];
    genders?: string[];
    qualifications?: string[];
    // 施設向け
    facilityTypes?: string[];
}

export interface CreateAnnouncementData {
    title: string;
    content: string;
    category: string;
    target_type: string; // "WORKER" | "FACILITY" | "BOTH"
    published: boolean;
    scheduled_at?: string | null; // ISO形式の日時文字列（予約公開日時）
    filter_conditions?: AnnouncementFilterConditions;
}

/**
 * お知らせ作成（フィルター条件付き）
 */
export async function createAnnouncement(data: CreateAnnouncementData) {
    await requireSystemAdminAuth();
    try {
        // 予約公開日時の処理
        const scheduledAt = data.scheduled_at ? new Date(data.scheduled_at) : null;

        // 「今すぐ公開」の場合のみpublished=true、それ以外はfalse（予約または下書き）
        const shouldPublishNow = data.published && !scheduledAt;

        const announcement = await prisma.announcement.create({
            data: {
                title: data.title,
                content: data.content,
                category: data.category,
                target_type: data.target_type,
                published: shouldPublishNow,
                published_at: shouldPublishNow ? new Date() : null,
                scheduled_at: scheduledAt,
                filter_conditions: data.filter_conditions ?? undefined,
            },
        });

        // 今すぐ公開の場合、配信先を登録
        if (shouldPublishNow) {
            await registerAnnouncementRecipients(announcement.id, data.target_type, data.filter_conditions);
        }

        return { success: true, announcement };
    } catch (error) {
        console.error('Create Announcement Error:', error);
        return { success: false, error: 'お知らせの作成に失敗しました' };
    }
}

/**
 * お知らせ更新（フィルター条件付き）
 */
export async function updateAnnouncement(id: number, data: CreateAnnouncementData) {
    await requireSystemAdminAuth();
    try {
        // 既存のお知らせを取得
        const existing = await prisma.announcement.findUnique({ where: { id } });
        const wasPublished = existing?.published;

        // 予約公開日時の処理
        const scheduledAt = data.scheduled_at ? new Date(data.scheduled_at) : null;

        // 「今すぐ公開」の場合のみpublished=true
        const shouldPublishNow = data.published && !scheduledAt;

        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                title: data.title,
                content: data.content,
                category: data.category,
                target_type: data.target_type,
                published: shouldPublishNow,
                published_at: shouldPublishNow && !wasPublished ? new Date() : existing?.published_at,
                scheduled_at: scheduledAt,
                filter_conditions: data.filter_conditions ?? undefined,
            }
        });

        // 下書き→公開に変更された場合、配信先を登録
        if (!wasPublished && shouldPublishNow) {
            await registerAnnouncementRecipients(announcement.id, data.target_type, data.filter_conditions);
        }

        return { success: true, announcement };
    } catch (error) {
        console.error('Update Announcement Error:', error);
        return { success: false, error: 'お知らせの更新に失敗しました' };
    }
}

/**
 * お知らせ削除
 */
export async function deleteAnnouncement(id: number) {
    await requireSystemAdminAuth();
    try {
        await prisma.announcement.delete({
            where: { id },
        });
        return { success: true };
    } catch (error) {
        console.error('Delete Announcement Error:', error);
        return { success: false, error: 'お知らせの削除に失敗しました' };
    }
}

/**
 * 予約公開日時が来たお知らせを公開する
 * cronジョブまたはAPI呼び出しで定期的に実行する
 */
export async function publishScheduledAnnouncements() {
    try {
        const now = new Date();

        // 予約公開日時が過ぎている未公開のお知らせを取得
        const scheduledAnnouncements = await prisma.announcement.findMany({
            where: {
                published: false,
                scheduled_at: {
                    not: null,
                    lte: now,
                },
            },
        });

        for (const announcement of scheduledAnnouncements) {
            // 公開状態に更新
            await prisma.announcement.update({
                where: { id: announcement.id },
                data: {
                    published: true,
                    published_at: now,
                    scheduled_at: null, // 予約日時をクリア
                },
            });

            // 配信先を登録
            const filterConditions = announcement.filter_conditions as AnnouncementFilterConditions | null;
            await registerAnnouncementRecipients(
                announcement.id,
                announcement.target_type,
                filterConditions ?? undefined
            );
        }

        return { success: true, publishedCount: scheduledAnnouncements.length };
    } catch (error) {
        console.error('Publish Scheduled Announcements Error:', error);
        return { success: false, error: '予約公開の処理に失敗しました' };
    }
}

/**
 * お知らせ詳細取得
 */
export async function getAnnouncementDetail(id: number) {
    await requireSystemAdminAuth();
    return await prisma.announcement.findUnique({
        where: { id },
        include: {
            recipients: {
                select: {
                    recipient_type: true,
                    recipient_id: true,
                    is_read: true,
                }
            }
        }
    });
}

/**
 * お知らせ配信先登録（フィルター条件に基づく）
 */
async function registerAnnouncementRecipients(
    announcementId: number,
    targetType: string,
    filterConditions?: AnnouncementFilterConditions
) {
    const recipients: { announcement_id: number; recipient_type: string; recipient_id: number }[] = [];

    // ワーカー向け配信
    if (targetType === 'WORKER' || targetType === 'BOTH') {
        const workerIds = await getFilteredWorkerIds(filterConditions);
        workerIds.forEach(id => {
            recipients.push({
                announcement_id: announcementId,
                recipient_type: 'WORKER',
                recipient_id: id,
            });
        });
    }

    // 施設向け配信
    if (targetType === 'FACILITY' || targetType === 'BOTH') {
        const facilityIds = await getFilteredFacilityIds(filterConditions);
        facilityIds.forEach(id => {
            recipients.push({
                announcement_id: announcementId,
                recipient_type: 'FACILITY',
                recipient_id: id,
            });
        });
    }

    // バッチ挿入
    if (recipients.length > 0) {
        await prisma.announcementRecipient.createMany({
            data: recipients,
            skipDuplicates: true,
        });
    }

    return recipients.length;
}

/**
 * フィルター条件に基づくワーカーID取得
 */
async function getFilteredWorkerIds(filterConditions?: AnnouncementFilterConditions): Promise<number[]> {
    if (!filterConditions || filterConditions.selectAll) {
        const workers = await prisma.user.findMany({ select: { id: true } });
        return workers.map(w => w.id);
    }

    const where: any = {};

    // 地域フィルター
    if (filterConditions.regionIds && filterConditions.regionIds.length > 0) {
        const regions = await prisma.analyticsRegion.findMany({
            where: { id: { in: filterConditions.regionIds } }
        });

        const prefectureCityConditions: any[] = [];
        for (const region of regions) {
            const prefCities = region.prefecture_cities as Record<string, string[]>;
            for (const [pref, cities] of Object.entries(prefCities)) {
                if (cities.length === 0) {
                    prefectureCityConditions.push({ prefecture: pref });
                } else {
                    prefectureCityConditions.push({ prefecture: pref, city: { in: cities } });
                }
            }
        }
        if (prefectureCityConditions.length > 0) {
            where.OR = prefectureCityConditions;
        }
    }

    // 性別フィルター
    if (filterConditions.genders && filterConditions.genders.length > 0) {
        where.gender = { in: filterConditions.genders };
    }

    // 資格フィルター
    if (filterConditions.qualifications && filterConditions.qualifications.length > 0) {
        where.qualifications = { hasSome: filterConditions.qualifications };
    }

    // 年齢フィルターは取得後にフィルタリング
    let workers = await prisma.user.findMany({
        where,
        select: { id: true, birth_date: true }
    });

    // 年齢フィルター適用
    if (filterConditions.ageRanges && filterConditions.ageRanges.length > 0) {
        const now = new Date();
        workers = workers.filter(w => {
            if (!w.birth_date) return false;
            const age = now.getFullYear() - w.birth_date.getFullYear();
            return filterConditions.ageRanges!.some(range => {
                switch (range) {
                    case '20代以下': return age <= 29;
                    case '30代': return age >= 30 && age <= 39;
                    case '40代': return age >= 40 && age <= 49;
                    case '50代': return age >= 50 && age <= 59;
                    case '60代以上': return age >= 60;
                    default: return false;
                }
            });
        });
    }

    return workers.map(w => w.id);
}

/**
 * フィルター条件に基づく施設ID取得
 */
async function getFilteredFacilityIds(filterConditions?: AnnouncementFilterConditions): Promise<number[]> {
    if (!filterConditions || filterConditions.selectAll) {
        const facilities = await prisma.facility.findMany({ select: { id: true } });
        return facilities.map(f => f.id);
    }

    const where: any = {};

    // 地域フィルター
    if (filterConditions.regionIds && filterConditions.regionIds.length > 0) {
        const regions = await prisma.analyticsRegion.findMany({
            where: { id: { in: filterConditions.regionIds } }
        });

        const prefectureCityConditions: any[] = [];
        for (const region of regions) {
            const prefCities = region.prefecture_cities as Record<string, string[]>;
            for (const [pref, cities] of Object.entries(prefCities)) {
                if (cities.length === 0) {
                    prefectureCityConditions.push({ prefecture: pref });
                } else {
                    prefectureCityConditions.push({ prefecture: pref, city: { in: cities } });
                }
            }
        }
        if (prefectureCityConditions.length > 0) {
            where.OR = prefectureCityConditions;
        }
    }

    // サービス種別フィルター
    if (filterConditions.facilityTypes && filterConditions.facilityTypes.length > 0) {
        where.facility_type = { in: filterConditions.facilityTypes };
    }

    const facilities = await prisma.facility.findMany({
        where,
        select: { id: true }
    });

    return facilities.map(f => f.id);
}

/**
 * ワーカー向けお知らせ取得
 */
export async function getWorkerAnnouncements(userId: number) {
    const announcements = await prisma.announcementRecipient.findMany({
        where: {
            recipient_type: 'WORKER',
            recipient_id: userId,
            announcement: {
                published: true,
            }
        },
        include: {
            announcement: true,
        },
        orderBy: {
            announcement: {
                published_at: 'desc'
            }
        }
    });

    return announcements.map(r => ({
        id: r.announcement.id,
        title: r.announcement.title,
        content: r.announcement.content,
        category: r.announcement.category,
        publishedAt: r.announcement.published_at,
        isRead: r.is_read,
        readAt: r.read_at,
    }));
}

/**
 * 施設向けお知らせ取得
 */
export async function getFacilityAnnouncements(facilityId: number) {
    const announcements = await prisma.announcementRecipient.findMany({
        where: {
            recipient_type: 'FACILITY',
            recipient_id: facilityId,
            announcement: {
                published: true,
            }
        },
        include: {
            announcement: true,
        },
        orderBy: {
            announcement: {
                published_at: 'desc'
            }
        }
    });

    return announcements.map(r => ({
        id: r.announcement.id,
        title: r.announcement.title,
        content: r.announcement.content,
        category: r.announcement.category,
        publishedAt: r.announcement.published_at,
        isRead: r.is_read,
        readAt: r.read_at,
    }));
}

/**
 * お知らせ既読にする
 */
export async function markAnnouncementAsRead(
    announcementId: number,
    recipientType: 'WORKER' | 'FACILITY',
    recipientId: number
) {
    try {
        await prisma.announcementRecipient.update({
            where: {
                announcement_id_recipient_type_recipient_id: {
                    announcement_id: announcementId,
                    recipient_type: recipientType,
                    recipient_id: recipientId,
                }
            },
            data: {
                is_read: true,
                read_at: new Date(),
            }
        });
        return { success: true };
    } catch (error) {
        console.error('Mark announcement as read error:', error);
        return { success: false };
    }
}

/**
 * システム管理者一覧取得
 */
export async function getSystemAdmins() {
    return await prisma.systemAdmin.findMany({
        orderBy: { created_at: 'desc' },
    });
}

/**
 * システム管理者招待（作成）
 */
export async function createSystemAdmin(data: {
    name: string;
    email: string;
    role: string;
}) {
    // パスワードは初期ランダム or 固定
    const initialPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    try {
        const admin = await prisma.systemAdmin.create({
            data: {
                ...data,
                password_hash: hashedPassword,
            },
        });
        return { success: true, admin, initialPassword };
    } catch (error) {
        console.error('Create SystemAdmin Error:', error);
        return { success: false, error: 'システム管理者の作成に失敗しました' };
    }
}

/**
 * システム管理者削除
 */
export async function deleteSystemAdmin(id: number) {
    try {
        await prisma.systemAdmin.delete({
            where: { id },
        });
        return { success: true };
    } catch (error) {
        console.error('Delete SystemAdmin Error:', error);
        return { success: false, error: '削除に失敗しました' };
    }
}

/**
 * 求人強制停止
 */
export async function forceStopJob(id: number) {
    try {
        const job = await prisma.job.update({
            where: { id },
            data: { status: 'STOPPED' }
        });
        return { success: true, job };
    } catch (error) {
        console.error('Force Stop Job Error:', error);
        return { success: false, error: '求人の停止に失敗しました' };
    }
}

/**
 * 求人停止解除
 */
export async function forceResumeJob(id: number) {
    try {
        const job = await prisma.job.update({
            where: { id },
            data: { status: 'PUBLISHED' }
        });
        return { success: true, job };
    } catch (error) {
        console.error('Force Resume Job Error:', error);
        return { success: false, error: '求人の停止解除に失敗しました' };
    }
}

/**
 * 求人強制削除
 */
export async function forceDeleteJob(id: number) {
    try {
        // 関連データが多いのでDeleteManyが必要だが、Cascade設定されていればOK
        // 今回は単純にDelete
        await prisma.job.delete({
            where: { id }
        });
        return { success: true };
    } catch (error) {
        console.error('Force Delete Job Error:', error);
        return { success: false, error: '求人の削除に失敗しました' };
    }
}

/**
 * マスカレード編集ログを記録
 */
export async function logMasqueradeEdit(
    systemAdminId: number,
    workerId: number,
    action: string,
    fieldChanged: string,
    oldValue: string | null,
    newValue: string | null
) {
    try {
        await prisma.systemLog.create({
            data: {
                admin_id: systemAdminId,
                action: 'MASQUERADE_EDIT',
                target_type: 'User',
                target_id: workerId,
                details: {
                    editAction: action,
                    fieldChanged,
                    oldValue,
                    newValue,
                    timestamp: new Date().toISOString(),
                },
            },
        });
        return { success: true };
    } catch (error) {
        console.error('Log Masquerade Edit Error:', error);
        return { success: false };
    }
}

/**
 * 編集ログ一覧取得（システム管理者用）
 */
export async function getEditLogs(
    page: number = 1,
    limit: number = 20,
    filters?: {
        targetType?: string;
        adminId?: number;
        startDate?: string;
        endDate?: string;
    }
) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // マスカレード関連のアクションのみ取得
    where.action = {
        in: ['MASQUERADE_EDIT', 'MASQUERADE_START', 'WORKER_MASQUERADE_START', 'WORKER_MASQUERADE_INIT'],
    };

    if (filters?.targetType) {
        where.target_type = filters.targetType;
    }

    if (filters?.adminId) {
        where.admin_id = filters.adminId;
    }

    if (filters?.startDate || filters?.endDate) {
        where.created_at = {};
        if (filters.startDate) {
            where.created_at.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            where.created_at.lte = new Date(filters.endDate);
        }
    }

    const [logs, total] = await Promise.all([
        prisma.systemLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { created_at: 'desc' },
        }),
        prisma.systemLog.count({ where }),
    ]);

    // admin_idからSystemAdmin情報を取得
    const adminIds = Array.from(new Set(logs.map(log => log.admin_id)));
    const admins = await prisma.systemAdmin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true, email: true },
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    return {
        logs: logs.map(log => ({
            id: log.id,
            adminId: log.admin_id,
            adminName: adminMap.get(log.admin_id)?.name || '不明',
            adminEmail: adminMap.get(log.admin_id)?.email || '',
            action: log.action,
            targetType: log.target_type,
            targetId: log.target_id,
            details: log.details,
            createdAt: log.created_at,
        })),
        total,
        totalPages: Math.ceil(total / limit),
    };
}

/**
 * ワーカー別の編集ログを取得
 */
export async function getWorkerEditLogs(workerId: number, limit: number = 20) {
    const logs = await prisma.systemLog.findMany({
        where: {
            target_type: 'User',
            target_id: workerId,
            action: {
                in: ['MASQUERADE_EDIT', 'WORKER_MASQUERADE_START'],
            },
        },
        take: limit,
        orderBy: { created_at: 'desc' },
    });

    // admin_idからSystemAdmin情報を取得
    const adminIds = Array.from(new Set(logs.map(log => log.admin_id)));
    const admins = await prisma.systemAdmin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true },
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    return logs.map(log => ({
        id: log.id,
        adminName: adminMap.get(log.admin_id)?.name || '不明',
        action: log.action,
        details: log.details,
        createdAt: log.created_at,
    }));
}

/**
 * システム管理用：求人一覧取得（拡張版）
 * 親求人（Job）単位で表示
 */
export async function getSystemJobsExtended(
    page: number = 1,
    limit: number = 20,
    search?: string,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    filters?: {
        status?: string;
        startDate?: string;
        endDate?: string;
        prefecture?: string;
        city?: string;
        facilityType?: string;
        requiresInterview?: boolean;
        qualification?: string;
    }
) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // フリーテキスト検索（求人名、テンプレート名、施設名、求人ID）
    if (search) {
        const searchTerm = search.trim();
        if (/^\d+$/.test(searchTerm)) {
            // 数字のみの場合はID検索も含める
            where.OR = [
                { id: parseInt(searchTerm, 10) },
                { title: { contains: searchTerm, mode: 'insensitive' } },
                { template: { name: { contains: searchTerm, mode: 'insensitive' } } },
                { facility: { facility_name: { contains: searchTerm, mode: 'insensitive' } } },
            ];
        } else {
            where.OR = [
                { title: { contains: searchTerm, mode: 'insensitive' } },
                { template: { name: { contains: searchTerm, mode: 'insensitive' } } },
                { facility: { facility_name: { contains: searchTerm, mode: 'insensitive' } } },
            ];
        }
    }

    // ステータスフィルター
    if (filters?.status && filters.status !== 'ALL') {
        where.status = filters.status;
    }

    // 日付範囲フィルター
    if (filters?.startDate || filters?.endDate) {
        where.created_at = {};
        if (filters.startDate) {
            where.created_at.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            where.created_at.lte = new Date(filters.endDate);
        }
    }

    // 都道府県・市区町村フィルター
    if (filters?.prefecture) {
        where.facility = {
            ...where.facility,
            prefecture: filters.prefecture,
        };
    }
    if (filters?.city) {
        where.facility = {
            ...where.facility,
            city: filters.city,
        };
    }

    // サービス種別フィルター
    if (filters?.facilityType) {
        where.facility = {
            ...where.facility,
            facility_type: filters.facilityType,
        };
    }

    // 面接ありフィルター
    if (filters?.requiresInterview !== undefined) {
        where.requires_interview = filters.requiresInterview;
    }

    // 資格フィルター（求人が要求する資格でフィルター）
    if (filters?.qualification) {
        where.required_qualifications = {
            has: filters.qualification
        };
    }

    // 計算フィールドでのソートかどうか
    const calculatedSortFields = ['applicationSlots', 'applicationCount', 'matchingPeriod'];
    const isCalculatedSort = calculatedSortFields.includes(sort);

    if (isCalculatedSort) {
        // 全件取得してJS処理
        const allJobs = await prisma.job.findMany({
            where,
            include: {
                facility: {
                    select: {
                        id: true,
                        facility_name: true,
                        facility_type: true,
                    },
                },
                template: {
                    select: { name: true },
                },
                workDates: {
                    select: {
                        id: true,
                        recruitment_count: true,
                        applications: {
                            select: {
                                id: true,
                                status: true,
                                updated_at: true,
                            },
                        },
                    },
                },
            },
        });

        // データ加工
        let processed = allJobs.map((job) => {
            // 応募枠 = 全workDateのrecruitment_countの合計
            const applicationSlots = job.workDates.reduce(
                (sum, wd) => sum + wd.recruitment_count,
                0
            );

            // 応募数 = 全applicationの数
            const applicationCount = job.workDates.reduce(
                (sum, wd) => sum + wd.applications.length,
                0
            );

            // 求人マッチング期間 = Job.created_at → 最初のSCHEDULED以上のApplication.updated_at
            const matchedApps = job.workDates.flatMap((wd) =>
                wd.applications.filter((a) =>
                    ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(
                        a.status
                    )
                )
            );

            let matchingPeriod: number | null = null;
            if (matchedApps.length > 0) {
                const firstMatch = matchedApps.reduce((min, a) =>
                    new Date(a.updated_at) < new Date(min.updated_at) ? a : min
                );
                matchingPeriod =
                    (new Date(firstMatch.updated_at).getTime() -
                        new Date(job.created_at).getTime()) /
                    (1000 * 60 * 60); // 時間単位
            }

            return {
                id: job.id,
                title: job.title,
                status: job.status,
                facilityId: job.facility.id,
                facilityName: job.facility.facility_name,
                facilityType: job.facility.facility_type,
                templateName: job.template?.name || null,
                requiresInterview: job.requires_interview,
                applicationSlots,
                applicationCount,
                matchingPeriod,
                createdAt: job.created_at,
                updatedAt: job.updated_at,
            };
        });

        // ソート
        processed.sort((a, b) => {
            let valA = (a as any)[sort];
            let valB = (b as any)[sort];
            // nullは末尾に
            if (valA === null) valA = order === 'asc' ? Infinity : -Infinity;
            if (valB === null) valB = order === 'asc' ? Infinity : -Infinity;
            return order === 'asc' ? valA - valB : valB - valA;
        });

        const total = processed.length;
        const paged = processed.slice(skip, skip + limit);

        return {
            jobs: paged,
            total,
            totalPages: Math.ceil(total / limit),
        };
    } else {
        // DB検索
        const [jobs, total] = await Promise.all([
            prisma.job.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sort]: order },
                include: {
                    facility: {
                        select: {
                            id: true,
                            facility_name: true,
                            facility_type: true,
                        },
                    },
                    template: {
                        select: { name: true },
                    },
                    workDates: {
                        select: {
                            id: true,
                            recruitment_count: true,
                            applications: {
                                select: {
                                    id: true,
                                    status: true,
                                    updated_at: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.job.count({ where }),
        ]);

        // 統計情報計算
        const processed = jobs.map((job) => {
            const applicationSlots = job.workDates.reduce(
                (sum, wd) => sum + wd.recruitment_count,
                0
            );
            const applicationCount = job.workDates.reduce(
                (sum, wd) => sum + wd.applications.length,
                0
            );

            const matchedApps = job.workDates.flatMap((wd) =>
                wd.applications.filter((a) =>
                    ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(
                        a.status
                    )
                )
            );

            let matchingPeriod: number | null = null;
            if (matchedApps.length > 0) {
                const firstMatch = matchedApps.reduce((min, a) =>
                    new Date(a.updated_at) < new Date(min.updated_at) ? a : min
                );
                matchingPeriod =
                    (new Date(firstMatch.updated_at).getTime() -
                        new Date(job.created_at).getTime()) /
                    (1000 * 60 * 60);
            }

            return {
                id: job.id,
                title: job.title,
                status: job.status,
                facilityId: job.facility.id,
                facilityName: job.facility.facility_name,
                facilityType: job.facility.facility_type,
                templateName: job.template?.name || null,
                requiresInterview: job.requires_interview,
                applicationSlots,
                applicationCount,
                matchingPeriod,
                createdAt: job.created_at,
                updatedAt: job.updated_at,
            };
        });

        return {
            jobs: processed,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }
}

/**
 * 新規施設をペンディング状態で作成し、マスカレードトークンを生成する
 * システム管理者が新規施設を登録する際のマスカレード方式用
 */
export async function createPendingFacilityWithMasquerade(
    adminId: number,
    adminEmail: string,
    adminPassword: string
) {
    // メールアドレス重複チェック
    const existingAdmin = await prisma.facilityAdmin.findUnique({
        where: { email: adminEmail }
    });
    if (existingAdmin) {
        return { success: false, error: 'このメールアドレスは既に使用されています' };
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 仮登録状態の施設を作成（最小限の情報のみ）
            const facility = await tx.facility.create({
                data: {
                    corporation_name: '（未設定）',
                    facility_name: '（新規施設 - 設定中）',
                    facility_type: '（未設定）',
                    prefecture: '（未設定）',
                    city: '（未設定）',
                    address: '',
                    is_pending: true, // 仮登録フラグ
                    // 通知先メールアドレスに管理者のメールアドレスを初期設定
                    staff_email: adminEmail,
                    staff_emails: [adminEmail],
                }
            });

            // 施設管理者アカウントを作成
            const facilityAdmin = await tx.facilityAdmin.create({
                data: {
                    facility_id: facility.id,
                    name: '施設管理者',
                    email: adminEmail,
                    password_hash: passwordHash,
                    is_primary: true,
                    role: 'admin'
                }
            });

            // マスカレードトークンを生成
            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            // ログ記録
            await tx.systemLog.create({
                data: {
                    admin_id: adminId,
                    action: 'CREATE_PENDING_FACILITY',
                    target_type: 'Facility',
                    target_id: facility.id,
                    details: {
                        facilityAdminId: facilityAdmin.id,
                        email: adminEmail,
                        isPending: true
                    }
                }
            });

            // マスカレードログも記録
            await tx.systemLog.create({
                data: {
                    admin_id: adminId,
                    action: 'MASQUERADE_INIT',
                    target_type: 'Facility',
                    target_id: facility.id,
                    details: { token, expiresAt: Date.now() + 30 * 60 * 1000 }, // 30分有効
                }
            });

            return { facility, facilityAdmin, token };
        });

        return {
            success: true,
            facilityId: result.facility.id,
            token: result.token
        };
    } catch (error) {
        console.error('Create pending facility error:', error);
        return { success: false, error: '施設の作成に失敗しました' };
    }
}

/**
 * 仮登録状態の施設を削除（保存せずにキャンセルした場合）
 */
export async function deletePendingFacility(facilityId: number, adminId: number) {
    try {
        // 施設が仮登録状態か確認
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { is_pending: true }
        });

        if (!facility) {
            return { success: false, error: '施設が見つかりません' };
        }

        if (!facility.is_pending) {
            return { success: false, error: 'この施設は仮登録状態ではありません' };
        }

        // トランザクションで削除
        await prisma.$transaction(async (tx) => {
            // 施設管理者を削除
            await tx.facilityAdmin.deleteMany({
                where: { facility_id: facilityId }
            });

            // 施設を削除
            await tx.facility.delete({
                where: { id: facilityId }
            });

            // ログ記録
            await tx.systemLog.create({
                data: {
                    admin_id: adminId,
                    action: 'DELETE_PENDING_FACILITY',
                    target_type: 'Facility',
                    target_id: facilityId,
                    details: { reason: 'cancelled_by_user' }
                }
            });
        });

        return { success: true };
    } catch (error) {
        console.error('Delete pending facility error:', error);
        return { success: false, error: '施設の削除に失敗しました' };
    }
}

/**
 * 施設の仮登録状態を解除（正式登録に切り替え）
 * 同時に緊急時出退勤番号とQRトークンを自動生成・付与する
 */
export async function activateFacility(facilityId: number) {
    try {
        // 現在の施設情報を取得（既に番号が設定されているか確認）
        const currentFacility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: {
                emergency_attendance_code: true,
                qr_secret_token: true,
            }
        });

        // 緊急時出退勤番号とQRトークンを生成（未設定の場合のみ）
        const emergencyCode = currentFacility?.emergency_attendance_code
            || await generateUniqueEmergencyCode();
        const qrSecretToken = currentFacility?.qr_secret_token
            || generateQRSecretToken();

        await prisma.facility.update({
            where: { id: facilityId },
            data: {
                is_pending: false,
                emergency_attendance_code: emergencyCode,
                qr_secret_token: qrSecretToken,
                qr_generated_at: currentFacility?.qr_secret_token ? undefined : new Date(),
            }
        });
        return { success: true };
    } catch (error) {
        console.error('Activate facility error:', error);
        return { success: false, error: '施設のアクティベーションに失敗しました' };
    }
}

/**
 * システム管理者による施設削除（マスカレード時用）
 */
export async function deleteFacilityBySystemAdmin(facilityId: number) {
    try {
        // トランザクションで関連データを削除
        await prisma.$transaction(async (tx) => {
            // 求人に紐づくデータを削除
            const jobs = await tx.job.findMany({
                where: { facility_id: facilityId },
                select: { id: true }
            });
            const jobIds = jobs.map(j => j.id);

            if (jobIds.length > 0) {
                // 勤務日のIDを取得
                const workDates = await tx.jobWorkDate.findMany({
                    where: { job_id: { in: jobIds } },
                    select: { id: true }
                });
                const workDateIds = workDates.map(wd => wd.id);

                if (workDateIds.length > 0) {
                    // 応募を削除
                    await tx.application.deleteMany({
                        where: { work_date_id: { in: workDateIds } }
                    });
                    // レビューを削除（勤務日に紐づくもの）
                    await tx.review.deleteMany({
                        where: { work_date_id: { in: workDateIds } }
                    });
                }

                // 勤務日を削除
                await tx.jobWorkDate.deleteMany({
                    where: { job_id: { in: jobIds } }
                });

                // 求人に紐づくレビュー（job_idで紐づくもの）を削除
                await tx.review.deleteMany({
                    where: { job_id: { in: jobIds } }
                });

                // 求人を削除
                await tx.job.deleteMany({
                    where: { facility_id: facilityId }
                });
            }

            // メッセージを削除（送信・受信両方）
            await tx.message.deleteMany({
                where: {
                    OR: [
                        { to_facility_id: facilityId },
                        { from_facility_id: facilityId }
                    ]
                }
            });

            // 施設に紐づくレビューを削除
            await tx.review.deleteMany({
                where: { facility_id: facilityId }
            });

            // 施設管理者を削除
            await tx.facilityAdmin.deleteMany({
                where: { facility_id: facilityId }
            });

            // ブックマークを削除
            await tx.bookmark.deleteMany({
                where: { facility_id: facilityId }
            });

            // 求人テンプレートを削除
            await tx.jobTemplate.deleteMany({
                where: { facility_id: facilityId }
            });

            // レビューテンプレートを削除
            await tx.reviewTemplate.deleteMany({
                where: { facility_id: facilityId }
            });

            // 施設を削除
            await tx.facility.delete({
                where: { id: facilityId }
            });
        });

        return { success: true };
    } catch (error) {
        console.error('Delete facility by system admin error:', error);
        return { success: false, error: '施設の削除に失敗しました' };
    }
}

/**
 * 施設の管理者一覧を取得
 */
export async function getFacilityAdmins(facilityId: number) {
    try {
        const admins = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
            select: {
                id: true,
                name: true,
                email: true,
                is_primary: true,
            },
            orderBy: [
                { is_primary: 'desc' },
                { created_at: 'asc' }
            ]
        });
        return { success: true, admins };
    } catch (error) {
        console.error('Get facility admins error:', error);
        return { success: false, error: '管理者一覧の取得に失敗しました' };
    }
}

/**
 * 施設担当者にパスワードリセットメールを送信
 */
export async function sendFacilityPasswordResetEmail(adminId: number) {
    try {
        const admin = await prisma.facilityAdmin.findUnique({
            where: { id: adminId },
            select: { email: true, name: true }
        });

        if (!admin) {
            return { success: false, error: '管理者が見つかりません' };
        }

        // TODO: 実際のメール送信処理を実装
        // 現在はモック（ログ出力のみ）
        console.log(`[MOCK] Password reset email sent to: ${admin.email} (${admin.name})`);

        return { success: true };
    } catch (error) {
        console.error('Send password reset email error:', error);
        return { success: false, error: 'メール送信に失敗しました' };
    }
}

// =====================================
// 労働条件通知書テンプレート管理
// =====================================


// デフォルトテンプレート
const DEFAULT_TEMPLATE_CONTENT = `労働条件通知書

発行日: {{発行日}}

■ 使用者情報
使用者法人名: {{法人名}}
事業所名称: {{施設名}}
法人所在地: {{所在地}}
就業場所: {{就業場所}}

■ 労働者情報
労働者氏名: {{ワーカー名}} 殿

■ 契約情報
就労日: {{就労日}}
労働契約の期間: 1日（単発契約）
契約更新の有無: 有（ただし条件あり、都度契約）

■ 業務内容
{{業務内容}}

■ 勤務時間
始業時刻: {{始業時刻}}
終業時刻: {{終業時刻}}
休憩時間: {{休憩時間}}
所定時間外労働: 原則なし

■ 賃金
基本賃金: 時給 {{時給}}
日給合計: {{日給}}
諸手当（交通費）: {{交通費}}
時間外労働割増: 法定通り（25%増）
賃金支払日: 翌月末日払い
支払方法: 銀行振込

■ 社会保険等
単発契約のため、社会保険・雇用保険・労災保険の適用については、法定の要件に基づき判断されます。

■ 作業用品その他
{{持ち物}}

■ 受動喫煙防止措置
{{喫煙対策}}

■ 解雇の事由その他関連する事項
当社では、以下に該当する場合、やむを得ず契約解除となる可能性がございます。

【即時契約解除となる事由】
・正当な理由なく無断欠勤が続いた場合
・業務上の重大な過失または故意による事故を起こした場合
・利用者様や他の職員に対する暴力行為、ハラスメント行為があった場合
・業務上知り得た秘密を漏洩した場合
・犯罪行為により逮捕または起訴された場合

■ 誓約事項
1. 業務上知り得た秘密は、在職中のみならず退職後においても第三者に漏洩いたしません。
2. 利用者様の個人情報は適切に取り扱い、プライバシーを尊重いたします。
3. 施設の規則・指示に従い、誠実に業務を遂行いたします。
4. 遅刻・早退・欠勤の際は、速やかに連絡いたします。

---
本書は労働基準法第15条に基づき、労働条件を明示するものです。
発行: +タスタス`;

export interface LaborDocumentTemplateData {
    id?: number;
    template_content: string;
    accent_color: string;
}

/**
 * 労働条件通知書テンプレートを取得
 */
export async function getLaborDocumentTemplate(): Promise<LaborDocumentTemplateData> {
    try {
        let template = await prisma.laborDocumentTemplate.findFirst({
            orderBy: { id: 'asc' },
        });

        if (!template) {
            template = await prisma.laborDocumentTemplate.create({
                data: {
                    template_content: DEFAULT_TEMPLATE_CONTENT,
                },
            });
        }

        return {
            id: template.id,
            template_content: template.template_content,
            accent_color: template.accent_color,
        };
    } catch (error) {
        console.error('Get labor document template error:', error);
        throw new Error('テンプレートの取得に失敗しました');
    }
}

/**
 * 労働条件通知書テンプレートを更新
 */
export async function updateLaborDocumentTemplate(
    data: Partial<LaborDocumentTemplateData>
): Promise<{ success: boolean; error?: string }> {
    try {
        let template = await prisma.laborDocumentTemplate.findFirst({
            orderBy: { id: 'asc' },
        });

        if (!template) {
            template = await prisma.laborDocumentTemplate.create({
                data: {
                    template_content: data.template_content || DEFAULT_TEMPLATE_CONTENT,
                },
            });
        }

        await prisma.laborDocumentTemplate.update({
            where: { id: template.id },
            data: {
                template_content: data.template_content,
                accent_color: data.accent_color,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Update labor document template error:', error);
        return { success: false, error: 'テンプレートの更新に失敗しました' };
    }
}

/**
 * 労働条件通知書テンプレートをリセット
 */
export async function resetLaborDocumentTemplate(): Promise<{ success: boolean; error?: string }> {
    try {
        const template = await prisma.laborDocumentTemplate.findFirst({
            orderBy: { id: 'asc' },
        });

        if (template) {
            await prisma.laborDocumentTemplate.update({
                where: { id: template.id },
                data: {
                    template_content: DEFAULT_TEMPLATE_CONTENT,
                    accent_color: '#3B82F6',
                },
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Reset labor document template error:', error);
        return { success: false, error: 'テンプレートのリセットに失敗しました' };
    }
}

/**
 * 労働条件通知書テンプレートのプレビューPDFを生成
 */
export async function previewLaborDocumentTemplate(
    templateContent: string,
    accentColor: string
): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        // ダミーデータを作成
        const dummyData = {
            application: {
                id: 0,
                status: 'APPLIED',
                work_date: new Date().toISOString(),
                created_at: new Date().toISOString(),
            },
            user: {
                id: 0,
                name: '山田 太郎',
            },
            job: {
                id: 0,
                title: '【未経験歓迎】介護アシスタント募集',
                start_time: '09:00',
                end_time: '18:00',
                break_time: 60,
                wage: 12000,
                hourly_wage: 1500,
                transportation_fee: 1000,
                address: '東京都渋谷区...',
                overview: '高齢者施設での介護補助業務です。',
                work_content: ['食事介助', '入浴介助', 'レクリエーション補助'],
                belongings: ['筆記用具', '動きやすい服装', '上履き'],
            },
            facility: {
                id: 0,
                corporation_name: '株式会社サンプルケア',
                facility_name: 'サンプル老人ホーム渋谷',
                address: '東京都渋谷区渋谷1-1-1',
                prefecture: '東京都',
                city: '渋谷区',
                address_detail: '渋谷1-1-1',
                smoking_measure: '屋内禁煙（喫煙室あり）',
            },
            dismissalReasons: null,
        };

        const pdfBuffer = await generateLaborDocumentPdf(dummyData, {
            template_content: templateContent,
            accent_color: accentColor,
        });

        // Base64に変換して返す
        const base64Pdf = pdfBuffer.toString('base64');
        return { success: true, data: `data:application/pdf;base64,${base64Pdf}` };
    } catch (error) {
        console.error('Preview labor document template error:', error);
        return { success: false, error: 'プレビューの生成に失敗しました' };
    }
}

/**
 * ダッシュボード用の拡張KPIを取得
 */
export async function getDashboardKPIs() {
    const [
        totalWorkers,
        totalFacilities,
        activeParentJobs,
        totalChildJobs,
        workDatesWithApps
    ] = await Promise.all([
        // 登録ワーカー数
        prisma.user.count({ where: { deleted_at: null } }),
        // 登録施設数
        prisma.facility.count({ where: { deleted_at: null } }),
        // 親求人数（公開中）
        prisma.job.count({ where: { status: 'PUBLISHED' } }),
        // 子求人数（全て）
        prisma.jobWorkDate.count(),
        // 応募枠計算用
        prisma.jobWorkDate.findMany({
            select: {
                recruitment_count: true,
                applications: {
                    where: {
                        status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] }
                    },
                    select: { id: true }
                }
            }
        })
    ]);

    // 残り応募枠の計算
    const totalRemainingSlots = workDatesWithApps.reduce((sum, wd) => {
        const filledSlots = wd.applications.length;
        const remaining = Math.max(0, wd.recruitment_count - filledSlots);
        return sum + remaining;
    }, 0);

    return {
        totalWorkers,
        totalFacilities,
        activeParentJobs,
        totalChildJobs,
        totalRemainingSlots
    };
}

/**
 * ダッシュボード用トレンドデータ（直近30日）
 */
export async function getDashboardTrends() {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);

    // 日付リスト生成
    const dateLabels: string[] = [];
    for (let i = 30; i >= 0; i--) {
        dateLabels.push(format(subDays(endDate, i), 'MM/dd'));
    }

    const [workers, facilities, workDates, applications] = await Promise.all([
        // 新規ワーカー
        prisma.user.findMany({
            where: { created_at: { gte: startDate, lte: endDate }, deleted_at: null },
            select: { created_at: true }
        }),
        // 新規施設
        prisma.facility.findMany({
            where: { created_at: { gte: startDate, lte: endDate }, deleted_at: null },
            select: { created_at: true }
        }),
        // 新規子求人
        prisma.jobWorkDate.findMany({
            where: { created_at: { gte: startDate, lte: endDate } },
            select: { created_at: true }
        }),
        // 応募（マッチング計算用）
        prisma.application.findMany({
            where: { created_at: { gte: startDate, lte: endDate } },
            select: {
                created_at: true,
                updated_at: true,
                status: true,
                user_id: true,
                workDate: {
                    select: { job: { select: { created_at: true } } }
                }
            }
        })
    ]);

    // 日付ごとに集計
    const newWorkersByDate: Record<string, number> = {};
    const newFacilitiesByDate: Record<string, number> = {};
    const newChildJobsByDate: Record<string, number> = {};
    const matchingsByDate: Record<string, number> = {};
    const applicationsByDate: Record<string, number> = {};
    const matchingHoursByDate: Record<string, number[]> = {};
    const activeWorkersByDate: Record<string, Set<number>> = {};

    // 初期化
    dateLabels.forEach(d => {
        newWorkersByDate[d] = 0;
        newFacilitiesByDate[d] = 0;
        newChildJobsByDate[d] = 0;
        matchingsByDate[d] = 0;
        applicationsByDate[d] = 0;
        matchingHoursByDate[d] = [];
        activeWorkersByDate[d] = new Set();
    });

    workers.forEach(w => {
        const key = format(w.created_at, 'MM/dd');
        if (newWorkersByDate[key] !== undefined) newWorkersByDate[key]++;
    });

    facilities.forEach(f => {
        const key = format(f.created_at, 'MM/dd');
        if (newFacilitiesByDate[key] !== undefined) newFacilitiesByDate[key]++;
    });

    workDates.forEach(wd => {
        const key = format(wd.created_at, 'MM/dd');
        if (newChildJobsByDate[key] !== undefined) newChildJobsByDate[key]++;
    });

    applications.forEach(app => {
        const key = format(app.created_at, 'MM/dd');

        // 応募数
        if (applicationsByDate[key] !== undefined) {
            applicationsByDate[key]++;
            activeWorkersByDate[key].add(app.user_id);
        }

        // マッチング（SCHEDULED以上）
        if (app.status !== 'APPLIED' && app.status !== 'CANCELLED') {
            const matchKey = format(app.updated_at, 'MM/dd');
            if (matchingsByDate[matchKey] !== undefined) {
                matchingsByDate[matchKey]++;

                // マッチング期間
                if (app.workDate?.job?.created_at) {
                    const hours = differenceInHours(app.updated_at, app.workDate.job.created_at);
                    if (hours > 0) matchingHoursByDate[matchKey].push(hours);
                }
            }
        }
    });

    // 配列に変換
    const graph1 = {
        labels: dateLabels,
        newWorkers: dateLabels.map(d => newWorkersByDate[d]),
        newFacilities: dateLabels.map(d => newFacilitiesByDate[d])
    };

    const graph2 = {
        labels: dateLabels,
        childJobs: dateLabels.map(d => newChildJobsByDate[d]),
        matchings: dateLabels.map(d => matchingsByDate[d])
    };

    const graph3 = {
        labels: dateLabels,
        applicationsPerWorker: dateLabels.map(d => {
            const workers = activeWorkersByDate[d].size || 1;
            return Math.round((applicationsByDate[d] / workers) * 100) / 100;
        }),
        matchingsPerWorker: dateLabels.map(d => {
            const workers = activeWorkersByDate[d].size || 1;
            return Math.round((matchingsByDate[d] / workers) * 100) / 100;
        })
    };

    const graph4 = {
        labels: dateLabels,
        avgMatchingHours: dateLabels.map(d => {
            const hours = matchingHoursByDate[d];
            if (hours.length === 0) return 0;
            return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;
        })
    };

    return { graph1, graph2, graph3, graph4 };
}

/**
 * アラート対象のワーカー/施設を取得
 */
export async function getDashboardAlerts() {
    // 閾値設定とダッシュボード表示設定を取得
    const alertSettings = await prisma.notificationSetting.findMany({
        where: {
            notification_key: {
                in: [
                    'ADMIN_WORKER_LOW_RATING_STREAK',
                    'ADMIN_FACILITY_LOW_RATING_STREAK',
                    'ADMIN_WORKER_HIGH_CANCEL_RATE',
                    'ADMIN_FACILITY_HIGH_CANCEL_RATE',
                ]
            }
        },
        select: {
            notification_key: true,
            alert_thresholds: true,
            dashboard_enabled: true,
        }
    });

    const settings: Record<string, { thresholds: any; dashboardEnabled: boolean }> = {};
    alertSettings.forEach(s => {
        settings[s.notification_key] = {
            thresholds: s.alert_thresholds || {},
            dashboardEnabled: s.dashboard_enabled,
        };
    });

    // 各閾値を取得（デフォルト: 評価2.5点以下、キャンセル率30%超）
    const workerRatingThreshold = settings['ADMIN_WORKER_LOW_RATING_STREAK']?.thresholds?.avg_rating_threshold || 2.5;
    const facilityRatingThreshold = settings['ADMIN_FACILITY_LOW_RATING_STREAK']?.thresholds?.avg_rating_threshold || 2.5;
    const workerCancelThreshold = settings['ADMIN_WORKER_HIGH_CANCEL_RATE']?.thresholds?.cancel_rate_threshold || 30;
    const facilityCancelThreshold = settings['ADMIN_FACILITY_HIGH_CANCEL_RATE']?.thresholds?.cancel_rate_threshold || 30;

    // ダッシュボード表示ON/OFF
    const workerRatingEnabled = settings['ADMIN_WORKER_LOW_RATING_STREAK']?.dashboardEnabled ?? true;
    const facilityRatingEnabled = settings['ADMIN_FACILITY_LOW_RATING_STREAK']?.dashboardEnabled ?? true;
    const workerCancelEnabled = settings['ADMIN_WORKER_HIGH_CANCEL_RATE']?.dashboardEnabled ?? true;
    const facilityCancelEnabled = settings['ADMIN_FACILITY_HIGH_CANCEL_RATE']?.dashboardEnabled ?? true;

    const alerts: Array<{
        id: number;
        type: 'worker' | 'facility';
        name: string;
        alertType: 'low_rating' | 'high_cancel_rate';
        value: number;
        threshold: number;
        detailUrl: string;
    }> = [];

    // ワーカーの低評価チェック
    const workersWithRatings = await prisma.user.findMany({
        where: { deleted_at: null },
        select: {
            id: true,
            name: true,
            reviews: {
                where: { reviewer_type: 'FACILITY' },
                select: { rating: true }
            }
        }
    });

    // ワーカー低評価アラートがONの場合のみ
    if (workerRatingEnabled) {
        workersWithRatings.forEach(w => {
            if (w.reviews.length >= 3) {
                const avgRating = w.reviews.reduce((sum, r) => sum + r.rating, 0) / w.reviews.length;
                if (avgRating <= workerRatingThreshold) {
                    alerts.push({
                        id: w.id,
                        type: 'worker',
                        name: w.name,
                        alertType: 'low_rating',
                        value: avgRating,
                        threshold: workerRatingThreshold,
                        detailUrl: `/system-admin/workers/${w.id}`
                    });
                }
            }
        });
    }

    // 施設の低評価チェック
    const facilitiesWithRatings = await prisma.facility.findMany({
        where: { deleted_at: null },
        select: {
            id: true,
            facility_name: true,
            reviews: {
                where: { reviewer_type: 'WORKER' },
                select: { rating: true }
            }
        }
    });

    // 施設低評価アラートがONの場合のみ
    if (facilityRatingEnabled) {
        facilitiesWithRatings.forEach(f => {
            if (f.reviews.length >= 3) {
                const avgRating = f.reviews.reduce((sum, r) => sum + r.rating, 0) / f.reviews.length;
                if (avgRating <= facilityRatingThreshold) {
                    alerts.push({
                        id: f.id,
                        type: 'facility',
                        name: f.facility_name,
                        alertType: 'low_rating',
                        value: avgRating,
                        threshold: facilityRatingThreshold,
                        detailUrl: `/system-admin/facilities/${f.id}`
                    });
                }
            }
        });
    }

    // ワーカーのキャンセル率チェック
    const workersWithApps = await prisma.user.findMany({
        where: { deleted_at: null },
        select: {
            id: true,
            name: true,
            applications: {
                select: { status: true, cancelled_by: true }
            }
        }
    });

    // ワーカーキャンセル率アラートがONの場合のみ
    if (workerCancelEnabled) {
        workersWithApps.forEach(w => {
            if (w.applications.length >= 5) {
                const cancelledByWorker = w.applications.filter(a => a.cancelled_by === 'WORKER').length;
                const cancelRate = (cancelledByWorker / w.applications.length) * 100;
                if (cancelRate > workerCancelThreshold) {
                    alerts.push({
                        id: w.id,
                        type: 'worker',
                        name: w.name,
                        alertType: 'high_cancel_rate',
                        value: cancelRate,
                        threshold: workerCancelThreshold,
                        detailUrl: `/system-admin/workers/${w.id}`
                    });
                }
            }
        });
    }

    // 施設のキャンセル率チェック（施設側キャンセル）
    const facilitiesWithJobs = await prisma.facility.findMany({
        where: { deleted_at: null },
        select: {
            id: true,
            facility_name: true,
            jobs: {
                select: {
                    workDates: {
                        select: {
                            applications: {
                                select: { status: true, cancelled_by: true }
                            }
                        }
                    }
                }
            }
        }
    });

    // 施設キャンセル率アラートがONの場合のみ
    if (facilityCancelEnabled) {
        facilitiesWithJobs.forEach(f => {
            const allApps = f.jobs.flatMap(j => j.workDates.flatMap(wd => wd.applications));
            if (allApps.length >= 5) {
                const cancelledByFacility = allApps.filter(a => a.cancelled_by === 'FACILITY').length;
                const cancelRate = (cancelledByFacility / allApps.length) * 100;
                if (cancelRate > facilityCancelThreshold) {
                    alerts.push({
                        id: f.id,
                        type: 'facility',
                        name: f.facility_name,
                        alertType: 'high_cancel_rate',
                        value: cancelRate,
                        threshold: facilityCancelThreshold,
                        detailUrl: `/system-admin/facilities/${f.id}`
                    });
                }
            }
        });
    }

    return alerts;
}

// システムアラートの型定義
export interface SystemAlert {
    id: string;
    alertType: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    value: number;
    limit: number;
}

/**
 * システムアラートを取得（メール送信量など）
 * systemSettingのキャッシュデータから閾値判定を行う
 */
export async function getSystemAlerts(): Promise<SystemAlert[]> {
    const RESEND_MONTHLY_LIMIT = 50_000;
    const WARNING_RATIO = 0.80;
    const CRITICAL_RATIO = 0.95;

    const alerts: SystemAlert[] = [];

    try {
        const quotaSetting = await prisma.systemSetting.findUnique({
            where: { key: 'resend_email_monthly_count' },
        });

        if (quotaSetting) {
            const data = JSON.parse(quotaSetting.value);
            const effectiveCount: number = data.effectiveCount || 0;
            const ratio = effectiveCount / RESEND_MONTHLY_LIMIT;
            const remaining = RESEND_MONTHLY_LIMIT - effectiveCount;

            let severity: 'info' | 'warning' | 'critical' = 'info';
            let title = 'メール送信数';
            let alertType = 'email_quota_info';

            if (ratio >= CRITICAL_RATIO) {
                severity = 'critical';
                title = 'メール送信上限危険';
                alertType = 'email_quota_critical';
            } else if (ratio >= WARNING_RATIO) {
                severity = 'warning';
                title = 'メール送信上限警告';
                alertType = 'email_quota_warning';
            }

            alerts.push({
                id: 'email_quota',
                alertType,
                severity,
                title,
                message: `${effectiveCount.toLocaleString()} / ${RESEND_MONTHLY_LIMIT.toLocaleString()}通（${(ratio * 100).toFixed(1)}%）- 残り ${remaining.toLocaleString()}通`,
                value: effectiveCount,
                limit: RESEND_MONTHLY_LIMIT,
            });
        }
    } catch (error) {
        console.error('[getSystemAlerts] Error checking email quota:', error);
    }

    return alerts;
}
