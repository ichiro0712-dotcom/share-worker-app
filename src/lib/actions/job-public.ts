'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentTime } from '@/utils/debugTime';
import { getJSTTodayStart, normalizeToJSTDayStart } from '@/utils/debugTime.server';

/**
 * 公開用求人詳細を取得
 * - 認証不要
 * - NORMAL求人のみ（限定・指名求人は除外）
 * - 公開中の求人のみ
 */
export async function getPublicJobById(id: string) {
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
        return null;
    }

    const now = getCurrentTime();
    const todayStart = getJSTTodayStart(now);

    const job = await prisma.job.findUnique({
        where: {
            id: jobId,
            // 公開中かつ通常求人のみ
            status: 'PUBLISHED',
            job_type: 'NORMAL',
        },
        include: {
            facility: {
                select: {
                    id: true,
                    facility_name: true,
                    corporation_name: true,
                    facility_type: true,
                    prefecture: true,
                    city: true,
                    address: true,
                    address_line: true,
                    description: true,
                    images: true,
                    lat: true,
                    lng: true,
                    phone_number: true,
                    rating: true,
                    review_count: true,
                    stations: true,
                    access_description: true,
                    transportation: true,
                    parking: true,
                    transportation_note: true,
                    map_image: true,
                    // 担当者情報
                    staff_same_as_manager: true,
                    manager_last_name: true,
                    manager_first_name: true,
                    staff_last_name: true,
                    staff_first_name: true,
                    staff_greeting: true,
                    staff_photo: true,
                },
            },
            workDates: {
                orderBy: { work_date: 'asc' },
                where: {
                    AND: [
                        // 募集開始日時を過ぎている
                        {
                            OR: [
                                { visible_from: { lte: now } },
                                { visible_from: null }
                            ]
                        },
                        // 表示期限内
                        {
                            OR: [
                                { visible_until: { gte: now } },
                                { visible_until: null }
                            ]
                        }
                    ]
                }
            },
        },
    });

    if (!job) {
        return null;
    }

    // 今日以降の勤務日のみフィルタリング
    const futureWorkDates = job.workDates.filter(wd => {
        const workDate = normalizeToJSTDayStart(new Date(wd.work_date));
        return workDate >= todayStart;
    });

    // 勤務日がない場合は非公開
    if (futureWorkDates.length === 0) {
        return null;
    }

    // 一番近い勤務日
    const nearestWorkDate = futureWorkDates[0];

    // 総数を計算
    const totalRecruitmentCount = futureWorkDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);
    const totalMatchedCount = futureWorkDates.reduce((sum, wd) => sum + wd.matched_count, 0);
    const remainingSlots = totalRecruitmentCount - totalMatchedCount;

    // DBのBooleanから特徴タグ配列を生成
    const featureTags = [
        job.inexperienced_ok && '未経験者歓迎',
        job.blank_ok && 'ブランク歓迎',
        job.hair_style_free && '髪型・髪色自由',
        job.nail_ok && 'ネイルOK',
        job.uniform_provided && '制服貸与',
        job.allow_car && '車通勤OK',
        job.meal_support && '食事補助',
    ].filter(Boolean) as string[];

    return {
        id: job.id,
        status: job.status.toLowerCase(),
        title: job.title,
        description: job.overview,
        overview: job.overview,
        work_content: job.work_content,
        qualifications: job.required_qualifications,
        required_qualifications: job.required_qualifications,
        required_experience: job.required_experience,
        hourly_wage: job.hourly_wage,
        wage: job.wage,
        transportation_fee: job.transportation_fee,
        start_time: job.start_time,
        end_time: job.end_time,
        break_time: job.break_time,
        images: job.images,
        requires_interview: job.requires_interview,
        job_type: job.job_type,

        // アドレス情報
        address: job.address,
        prefecture: job.prefecture,
        city: job.city,
        address_line: job.address_line,
        access: job.access,

        // ドレスコード
        dresscode: job.dresscode,
        dresscode_images: job.dresscode_images,
        belongings: job.belongings,

        // 担当者情報
        manager_name: job.manager_name,
        manager_message: job.manager_message,
        manager_avatar: job.manager_avatar,

        // 特徴タグ
        feature_tags: featureTags,
        tags: job.tags,

        // 添付ファイル
        attachments: job.attachments,

        // 募集条件
        weekly_frequency: job.weekly_frequency,
        allow_car: job.allow_car,

        // 日程関連
        work_date: nearestWorkDate.work_date.toISOString(),
        deadline: nearestWorkDate.deadline.toISOString(),
        recruitment_count: totalRecruitmentCount,
        matched_count: totalMatchedCount,
        remaining_slots: remainingSlots > 0 ? remainingSlots : 0,

        // 勤務日一覧
        workDates: futureWorkDates.map((wd) => ({
            id: wd.id,
            work_date: wd.work_date.toISOString(),
            deadline: wd.deadline.toISOString(),
            recruitment_count: wd.recruitment_count,
            matched_count: wd.matched_count,
            remaining: wd.recruitment_count - wd.matched_count,
        })),

        // 施設情報
        facility: {
            id: job.facility.id,
            name: job.facility.facility_name,
            facility_name: job.facility.facility_name,
            corporation_name: job.facility.corporation_name,
            facility_type: job.facility.facility_type,
            prefecture: job.facility.prefecture,
            city: job.facility.city,
            address: job.facility.address,
            address_line: job.facility.address_line,
            description: job.facility.description,
            images: job.facility.images,
            lat: job.facility.lat,
            lng: job.facility.lng,
            phone_number: job.facility.phone_number,
            rating: job.facility.rating,
            review_count: job.facility.review_count,
            stations: job.facility.stations,
            access_description: job.facility.access_description,
            transportation: job.facility.transportation,
            parking: job.facility.parking,
            transportation_note: job.facility.transportation_note,
            map_image: job.facility.map_image,
            // 担当者情報
            staff_same_as_manager: job.facility.staff_same_as_manager,
            manager_last_name: job.facility.manager_last_name,
            manager_first_name: job.facility.manager_first_name,
            staff_last_name: job.facility.staff_last_name,
            staff_first_name: job.facility.staff_first_name,
            staff_greeting: job.facility.staff_greeting,
            staff_photo: job.facility.staff_photo,
        },

        created_at: job.created_at.toISOString(),
        updated_at: job.updated_at.toISOString(),
    };
}

/**
 * 公開用労働条件通知書プレビューを取得
 * - 認証不要
 * - NORMAL求人のみ（限定・指名求人は除外）
 * - 公開中の求人のみ
 */
export async function getPublicLaborDocumentPreview(id: string) {
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
        return null;
    }

    const job = await prisma.job.findUnique({
        where: {
            id: jobId,
            // 公開中かつ通常求人のみ
            status: 'PUBLISHED',
            job_type: 'NORMAL',
        },
        include: {
            facility: true,
            template: true,
            workDates: {
                orderBy: { work_date: 'asc' },
                take: 1,
            },
        },
    });

    if (!job) {
        return null;
    }

    const facility = job.facility;
    const template = job.template;
    // 最初の勤務日を代表として使用（プレビュー用）
    const firstWorkDate = job.workDates[0];

    return {
        job: {
            id: job.id,
            title: job.title,
            start_time: job.start_time,
            end_time: job.end_time,
            break_time: typeof job.break_time === 'string' ? parseInt(job.break_time) : job.break_time,
            wage: job.wage,
            hourly_wage: job.hourly_wage,
            transportation_fee: job.transportation_fee,
            address: job.address,
            overview: job.overview,
            work_content: job.work_content,
            belongings: job.belongings,
        },
        facility: {
            id: facility.id,
            corporation_name: facility.corporation_name,
            facility_name: facility.facility_name,
            address: facility.address,
            prefecture: facility.prefecture,
            city: facility.city,
            address_detail: facility.address_detail,
            smoking_measure: facility.smoking_measure,
        },
        // プレビュー用の勤務日（応募時に選択される）
        sampleWorkDate: firstWorkDate ? firstWorkDate.work_date.toISOString() : null,
        dismissalReasons: template?.dismissal_reasons || null,
    };
}

/**
 * 公開用求人一覧を取得（サイトマップ用）
 */
export async function getPublicJobsForSitemap() {
    const now = getCurrentTime();
    const todayStart = getJSTTodayStart(now);

    const jobs = await prisma.job.findMany({
        where: {
            status: 'PUBLISHED',
            job_type: 'NORMAL',
            // 今日以降の有効な勤務日が少なくとも1つ存在する求人のみ
            workDates: {
                some: {
                    work_date: { gte: todayStart },
                    AND: [
                        // 募集開始日時を過ぎている
                        {
                            OR: [
                                { visible_from: { lte: now } },
                                { visible_from: null }
                            ]
                        },
                        // 表示期限内
                        {
                            OR: [
                                { visible_until: { gte: now } },
                                { visible_until: null }
                            ]
                        }
                    ]
                }
            }
        },
        select: {
            id: true,
            updated_at: true,
        },
        orderBy: {
            updated_at: 'desc',
        },
    });

    return jobs.map(job => ({
        id: job.id,
        lastModified: job.updated_at,
    }));
}

/**
 * 施設の面接通過率を取得（審査あり求人用）
 * @param facilityId 施設ID
 * @param period 期間フィルター: 'current' (当月), 'last' (先月), 'two_months_ago' (先々月)
 * @returns 面接通過率データ
 */
export async function getFacilityInterviewPassRate(
    facilityId: number,
    period: 'current' | 'last' | 'two_months_ago' = 'current'
): Promise<{
    passRate: number | null;
    appliedCount: number;
    matchedCount: number;
    period: string;
}> {
    // 期間の開始日と終了日を計算（JST基準）
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC to JST

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    const jstYear = jstNow.getUTCFullYear();
    const jstMonth = jstNow.getUTCMonth();

    switch (period) {
        case 'current':
            // 当月の1日から今日まで
            startDate = new Date(Date.UTC(jstYear, jstMonth, 1, 0, 0, 0, 0));
            startDate = new Date(startDate.getTime() - 9 * 60 * 60 * 1000); // JST to UTC
            endDate = now;
            periodLabel = `${jstMonth + 1}月`;
            break;
        case 'last':
            // 先月の1日から末日まで
            startDate = new Date(Date.UTC(jstYear, jstMonth - 1, 1, 0, 0, 0, 0));
            startDate = new Date(startDate.getTime() - 9 * 60 * 60 * 1000);
            endDate = new Date(Date.UTC(jstYear, jstMonth, 1, 0, 0, 0, 0));
            endDate = new Date(endDate.getTime() - 9 * 60 * 60 * 1000 - 1); // 1ms前
            const lastMonth = jstMonth === 0 ? 12 : jstMonth;
            periodLabel = `${lastMonth}月`;
            break;
        case 'two_months_ago':
            // 先々月の1日から末日まで
            startDate = new Date(Date.UTC(jstYear, jstMonth - 2, 1, 0, 0, 0, 0));
            startDate = new Date(startDate.getTime() - 9 * 60 * 60 * 1000);
            endDate = new Date(Date.UTC(jstYear, jstMonth - 1, 1, 0, 0, 0, 0));
            endDate = new Date(endDate.getTime() - 9 * 60 * 60 * 1000 - 1);
            const twoMonthsAgo = jstMonth <= 1 ? jstMonth + 11 : jstMonth - 1;
            periodLabel = `${twoMonthsAgo}月`;
            break;
    }

    // 施設の審査あり求人の応募データを集計
    const result = await prisma.application.aggregate({
        where: {
            workDate: {
                job: {
                    facility_id: facilityId,
                    requires_interview: true, // 審査あり求人のみ
                },
            },
            created_at: {
                gte: startDate,
                lte: endDate,
            },
            // キャンセルされていない応募のみ
            status: {
                not: 'CANCELLED',
            },
        },
        _count: {
            id: true,
        },
    });

    // マッチング成立数（SCHEDULED以上のステータス）
    const matchedResult = await prisma.application.aggregate({
        where: {
            workDate: {
                job: {
                    facility_id: facilityId,
                    requires_interview: true,
                },
            },
            created_at: {
                gte: startDate,
                lte: endDate,
            },
            status: {
                in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
            },
        },
        _count: {
            id: true,
        },
    });

    const appliedCount = result._count.id;
    const matchedCount = matchedResult._count.id;

    // 通過率を計算（応募数が0の場合はnull）
    const passRate = appliedCount > 0 ? Math.round((matchedCount / appliedCount) * 100) : null;

    return {
        passRate,
        appliedCount,
        matchedCount,
        period: periodLabel,
    };
}
