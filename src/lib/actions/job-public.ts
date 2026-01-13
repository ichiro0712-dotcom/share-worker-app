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
                    prefecture: true,
                    city: true,
                    address: true,
                    address_line: true,
                    description: true,
                    images: true,
                    lat: true,
                    lng: true,
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

    return {
        id: job.id,
        title: job.title,
        description: job.overview,
        qualifications: job.required_qualifications,
        work_content: job.work_content,
        hourly_wage: job.hourly_wage,
        transportation_fee: job.transportation_fee,
        start_time: job.start_time,
        end_time: job.end_time,
        break_time: job.break_time,
        images: job.images,
        requires_interview: job.requires_interview,

        // 日程関連
        work_date: nearestWorkDate.work_date.toISOString(),
        deadline: nearestWorkDate.deadline.toISOString(),
        recruitment_count: totalRecruitmentCount,
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
            prefecture: job.facility.prefecture,
            city: job.facility.city,
            address: job.facility.address,
            address_line: job.facility.address_line,
            description: job.facility.description,
            images: job.facility.images,
            lat: job.facility.lat,
            lng: job.facility.lng,
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
