'use server';

import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import bcrypt from 'bcryptjs';
import { JobStatus } from '@prisma/client';


export interface AnalyticsFilter {
    period: 'daily' | 'monthly' | 'range';
    startDate?: Date;
    endDate?: Date;
}

/**
 * ダッシュボードの主要な数値を一括取得
 */
export async function getDashboardStats() {
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
 * 施設種別ごとの登録数
 */
export async function getFacilityTypeStats() {
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
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
            `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodedAddress}`
        );
        const data = await response.json();

        if (data && data.length > 0 && data[0].geometry?.coordinates) {
            const [lng, lat] = data[0].geometry.coordinates;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

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
                ...(isDistanceSearch ? { lat: { not: null }, lng: { not: null } } : {})
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

    // 施設種別ごとの評価（仮実装）
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
            ];
        } else {
            where.OR = [
                { facility_name: { contains: searchTerm, mode: 'insensitive' } },
                { corporation_name: { contains: searchTerm, mode: 'insensitive' } },
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
        const allFacilities = await prisma.facility.findMany({
            where: {
                ...where,
                ...(isDistanceSearch ? { lat: { not: null }, lng: { not: null } } : {})
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

            let distance = null;
            if (isDistanceSearch && filters?.distanceFrom) {
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

        // 距離フィルタ
        if (isDistanceSearch && filters?.distanceFrom) {
            processed = processed.filter(f => (f.distance as number) <= filters.distanceFrom!.maxDistance);
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
}

/**
 * 施設詳細取得（拡張版）
 */
export async function getSystemFacilityDetailExtended(id: number) {
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

/**
 * お知らせ作成
 */
export async function createAnnouncement(data: {
    title: string;
    content: string;
    category: string;
    target_type: string;
    published: boolean;
}) {
    try {
        const announcement = await prisma.announcement.create({
            data: {
                ...data,
                published_at: data.published ? new Date() : null,
            },
        });
        return { success: true, announcement };
    } catch (error) {
        console.error('Create Announcement Error:', error);
        return { success: false, error: 'お知らせの作成に失敗しました' };
    }
}

/**
 * お知らせ更新
 */
export async function updateAnnouncement(id: number, data: {
    title: string;
    content: string;
    category: string;
    target_type: string;
    published: boolean;
}) {
    try {
        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                ...data,
                published_at: data.published ? new Date() : null,
            }
        });
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
 * お知らせ詳細取得
 */
export async function getAnnouncementDetail(id: number) {
    return await prisma.announcement.findUnique({
        where: { id },
    });
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

    // 施設種別フィルター
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
 */
export async function activateFacility(facilityId: number) {
    try {
        await prisma.facility.update({
            where: { id: facilityId },
            data: { is_pending: false }
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
