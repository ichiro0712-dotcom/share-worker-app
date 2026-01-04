'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentTime } from '@/utils/debugTime';
import {
    sendMatchingNotification,
    sendReviewRequestNotification,
    sendCancelNotification,
    sendFacilityReviewRequestNotification,
    sendSlotsFilled,
    sendAdminHighCancelRateNotification,
} from './notification';
import { sendNotification } from '../notification-service';
import { getAuthenticatedUser } from './helpers';
import { updateApplicationStatuses } from '../status-updater';

/**
 * 施設管理用: 施設に届いた応募一覧を取得
 */
export async function getFacilityApplications(facilityId: number) {
    try {
        console.log('[getFacilityApplications] Fetching applications for facility:', facilityId);

        // アクセス時にステータスをリアルタイム更新
        await updateApplicationStatuses({ facilityId });

        const applications = await prisma.application.findMany({
            where: {
                workDate: {
                    job: {
                        facility_id: facilityId,
                    },
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone_number: true,
                        profile_image: true,
                        qualifications: true,
                    },
                },
                workDate: {
                    include: {
                        job: {
                            select: {
                                id: true,
                                title: true,
                                start_time: true,
                                end_time: true,
                                hourly_wage: true,
                                work_content: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        console.log('[getFacilityApplications] Found applications:', applications.length);

        return applications.map((app) => ({
            id: app.id,
            status: app.status,
            createdAt: app.created_at.toISOString(),
            user: {
                id: app.user.id,
                name: app.user.name,
                email: app.user.email,
                phoneNumber: app.user.phone_number,
                profileImage: app.user.profile_image,
                qualifications: app.user.qualifications,
            },
            job: {
                id: app.workDate.job.id,
                title: app.workDate.job.title,
                workDate: app.workDate.work_date.toISOString().split('T')[0],
                startTime: app.workDate.job.start_time,
                endTime: app.workDate.job.end_time,
                hourlyWage: app.workDate.job.hourly_wage,
                workContent: app.workDate.job.work_content,
            },
        }));
    } catch (error) {
        console.error('[getFacilityApplications] Error:', error);
        return [];
    }
}

/**
 * 施設管理用: 応募ステータスを更新
 */
export async function updateApplicationStatus(
    applicationId: number,
    newStatus: 'APPLIED' | 'SCHEDULED' | 'WORKING' | 'CANCELLED' | 'COMPLETED_PENDING',
    facilityId: number
) {
    try {
        console.log('[updateApplicationStatus] Updating application:', applicationId, 'to:', newStatus);

        const application = await prisma.application.findFirst({
            where: {
                id: applicationId,
                workDate: {
                    job: {
                        facility_id: facilityId,
                    },
                },
            },
            include: {
                workDate: {
                    include: {
                        job: {
                            include: {
                                facility: true,
                            },
                        },
                    },
                },
                user: true,
            },
        });

        if (!application) return { success: false, error: '応募が見つかりません' };

        if (newStatus === 'CANCELLED' && application.status === 'SCHEDULED') {
            const workDate = application.workDate.work_date;
            const startTime = application.workDate.job.start_time;
            const [hours, minutes] = startTime.split(':').map(Number);
            const workStartDateTime = new Date(workDate);
            workStartDateTime.setHours(hours, minutes, 0, 0);

            const now = getCurrentTime();
            if (now >= workStartDateTime) return { success: false, error: '勤務開始時刻を過ぎているためキャンセルできません' };
        }

        await prisma.$transaction(async (tx) => {
            if (newStatus === 'SCHEDULED' && application.status === 'APPLIED') {
                const workDate = await prisma.jobWorkDate.findUnique({
                    where: { id: application.work_date_id },
                    include: { job: true },
                });

                if (workDate && !workDate.job.requires_interview && workDate.matched_count >= workDate.recruitment_count) {
                    throw new Error('この勤務日は既に募集人数に達しています');
                }

                await tx.jobWorkDate.update({
                    where: { id: application.work_date_id },
                    data: { matched_count: { increment: 1 } },
                });
            }

            if (application.status === 'SCHEDULED' && (newStatus === 'APPLIED' || newStatus === 'CANCELLED')) {
                await tx.jobWorkDate.update({
                    where: { id: application.work_date_id },
                    data: { matched_count: { decrement: 1 } },
                });
            }

            await tx.application.update({
                where: { id: applicationId },
                data: {
                    status: newStatus,
                    ...(newStatus === 'CANCELLED' && { cancelled_by: 'FACILITY' }),
                },
            });

            if (newStatus === 'CANCELLED' && application.status !== 'CANCELLED') {
                await tx.jobWorkDate.update({
                    where: { id: application.work_date_id },
                    data: { applied_count: { decrement: 1 } },
                });
            }
        });

        if (newStatus === 'SCHEDULED') {
            if (application.workDate.job.facility.initial_message) {
                const previousMatchCount = await prisma.application.count({
                    where: {
                        id: { not: applicationId },
                        user_id: application.user_id,
                        status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
                        workDate: { job: { facility_id: facilityId } },
                    },
                });

                if (previousMatchCount === 0) {
                    const workerLastName = application.user.name?.split(' ')[0] || application.user.name || '';
                    const facilityName = application.workDate.job.facility.facility_name || '';
                    const messageContent = application.workDate.job.facility.initial_message
                        .replace(/\[ワーカー名字\]/g, workerLastName)
                        .replace(/\[施設名\]/g, facilityName);

                    await prisma.message.create({
                        data: {
                            application_id: applicationId,
                            job_id: application.workDate.job_id,
                            from_facility_id: facilityId,
                            to_user_id: application.user_id,
                            content: messageContent,
                        },
                    });
                }
            }

            // マッチング通知（チャット・メール・プッシュを設定に基づいて送信）
            await sendMatchingNotification(
                application.user_id,
                application.workDate.job.title,
                application.workDate.job.facility.facility_name,
                application.workDate.job.id,
                application.id,
                {
                    workDate: application.workDate.work_date,
                    startTime: application.workDate.job.start_time,
                    endTime: application.workDate.job.end_time,
                },
                application.workDate.job.requires_interview, // 審査あり求人フラグ
                facilityId // チャットメッセージ送信用
            );

            // 枠が埋まったかチェック
            const workDateData = await prisma.jobWorkDate.findUnique({
                where: { id: application.work_date_id },
                select: { recruitment_count: true },
            });
            const scheduledCount = await prisma.application.count({
                where: {
                    work_date_id: application.work_date_id,
                    status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
                },
            });
            if (workDateData && scheduledCount >= workDateData.recruitment_count) {
                const workDateStr = application.workDate.work_date.toISOString().split('T')[0];
                await sendSlotsFilled(
                    facilityId,
                    application.workDate.job.title,
                    workDateStr
                );
            }
        }

        if (newStatus === 'COMPLETED_PENDING') {
            // ワーカーへレビュー依頼
            await sendReviewRequestNotification(
                application.user_id,
                application.workDate.job.facility.facility_name,
                application.workDate.job.title,
                applicationId
            );
            // 施設へレビュー依頼
            await sendFacilityReviewRequestNotification(
                facilityId,
                application.user.name,
                application.workDate.job.title,
                applicationId
            );
        }

        if (newStatus === 'CANCELLED' && application.status === 'SCHEDULED') {
            const workDateStr = application.workDate.work_date.toISOString().split('T')[0];

            // キャンセル通知（チャット・メール・プッシュを設定に基づいて送信）
            await sendCancelNotification(
                application.user_id,
                application.workDate.job.title,
                application.workDate.job.facility.facility_name,
                workDateStr,
                application.workDate.job.id,
                {
                    startTime: application.workDate.job.start_time,
                    endTime: application.workDate.job.end_time,
                },
                applicationId,
                facilityId
            );
        }

        // 不採用通知（APPLIED状態からCANCELLED = 審査後の不採用）
        if (newStatus === 'CANCELLED' && application.status === 'APPLIED') {
            const workDateStr = application.workDate.work_date.toISOString().split('T')[0];

            // 不採用通知（チャット・メール・プッシュを設定に基づいて送信）
            await sendNotification({
                notificationKey: 'WORKER_INTERVIEW_REJECTED',
                targetType: 'WORKER',
                recipientId: application.user_id,
                recipientName: application.user.name,
                recipientEmail: application.user.email,
                applicationId: applicationId,
                variables: {
                    worker_name: application.user.name || '',
                    facility_name: application.workDate.job.facility.facility_name,
                    job_title: application.workDate.job.title,
                    work_date: workDateStr,
                },
                // チャットメッセージ（Messageテーブル）用
                chatMessageData: {
                    jobId: application.workDate.job_id,
                    fromFacilityId: facilityId,
                    toUserId: application.user_id,
                },
            });
        }

        // 施設のキャンセル率チェック（CANCELLED状態へ変更時のみ）
        if (newStatus === 'CANCELLED') {
            const CANCEL_RATE_THRESHOLD = 0.2; // 20%以上でアラート
            const MIN_APPLICATIONS_FOR_ALERT = 5; // 最低5件以上の応募がある場合のみ

            const [cancelledCount, totalCount] = await Promise.all([
                prisma.application.count({
                    where: {
                        workDate: { job: { facility_id: facilityId } },
                        status: 'CANCELLED',
                        cancelled_by: 'FACILITY',
                    },
                }),
                prisma.application.count({
                    where: {
                        workDate: { job: { facility_id: facilityId } },
                        status: { in: ['COMPLETED_RATED', 'CANCELLED'] },
                    },
                }),
            ]);

            if (totalCount >= MIN_APPLICATIONS_FOR_ALERT) {
                const cancelRate = cancelledCount / totalCount;
                if (cancelRate >= CANCEL_RATE_THRESHOLD) {
                    const facility = await prisma.facility.findUnique({
                        where: { id: facilityId },
                        select: { facility_name: true },
                    });

                    await sendAdminHighCancelRateNotification(
                        'FACILITY',
                        facilityId,
                        facility?.facility_name || '施設',
                        Math.round(cancelRate * 100)
                    );
                }
            }
        }

        revalidatePath('/admin/applications');
        revalidatePath('/admin/workers');

        return { success: true };
    } catch (error) {
        console.error('[updateApplicationStatus] Error:', error);
        return { success: false, error: 'ステータスの更新に失敗しました' };
    }
}

// 求人別応募ソートオプションの型定義
type JobApplicationsSortOption =
    | 'created_desc'
    | 'created_asc'
    | 'applied_desc'
    | 'applied_asc'
    | 'unviewed_desc'
    | 'workDate_asc'
    | 'workDate_desc';

/**
 * 施設管理用: 求人ごとの応募状況を取得
 */
export async function getJobsWithApplications(
    facilityId: number,
    options: {
        page?: number;
        limit?: number;
        status?: 'PUBLISHED' | 'STOPPED' | 'COMPLETED' | 'all';
        query?: string;
        sort?: string;
    } = {}
) {
    try {
        const { page = 1, limit = 10, status = 'all', query = '', sort = 'created_desc' } = options;
        const skip = (page - 1) * limit;

        const whereConditions: any = { facility_id: facilityId };
        if (status !== 'all') whereConditions.status = status;
        if (query) whereConditions.title = { contains: query, mode: 'insensitive' };

        // ソートが計算フィールド（applied, unviewed, workDate）の場合は全件取得してからソート
        const needsPostSort = ['applied_desc', 'applied_asc', 'unviewed_desc', 'workDate_asc', 'workDate_desc'].includes(sort as JobApplicationsSortOption);

        // Prismaのソート設定（created_asc/created_descの場合のみ使用）
        let orderBy: any = { created_at: 'desc' };
        if (sort === 'created_asc') {
            orderBy = { created_at: 'asc' };
        }

        // 並列でcount + jobs取得（最適化）
        const [totalCount, jobs] = await Promise.all([
            prisma.job.count({ where: whereConditions }),
            prisma.job.findMany({
                where: whereConditions,
                include: {
                    workDates: {
                        include: {
                            applications: {
                                include: {
                                    user: { select: { id: true, name: true, profile_image: true, qualifications: true } },
                                },
                                orderBy: { created_at: 'desc' },
                            },
                        },
                        orderBy: { work_date: 'asc' },
                    },
                },
                orderBy,
                ...(needsPostSort ? {} : { skip, take: limit }),
            }),
        ]);

        const workerIds = new Set<number>();
        jobs.forEach(job => job.workDates.forEach(wd => wd.applications.forEach(app => workerIds.add(app.user.id))));
        const uniqueWorkerIds = Array.from(workerIds);

        // ワーカー関連データを並列で取得（最適化）
        const [workerReviews, workerAllApps] = await Promise.all([
            prisma.review.findMany({
                where: { user_id: { in: uniqueWorkerIds }, reviewer_type: 'FACILITY' },
                select: { user_id: true, rating: true },
            }),
            prisma.application.findMany({
                where: {
                    user_id: { in: uniqueWorkerIds },
                    status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'] },
                },
                select: {
                    user_id: true,
                    status: true,
                    updated_at: true,
                    cancelled_by: true,
                    workDate: { select: { work_date: true } },
                },
            }),
        ]);

        const workerRatings = new Map<number, { total: number; count: number }>();
        workerReviews.forEach(r => {
            const current = workerRatings.get(r.user_id) || { total: 0, count: 0 };
            current.total += r.rating;
            current.count += 1;
            workerRatings.set(r.user_id, current);
        });

        const workerCancelStats = new Map<number, { totalScheduled: number; lastMinuteCancels: number }>();
        workerAllApps.forEach(app => {
            const current = workerCancelStats.get(app.user_id) || { totalScheduled: 0, lastMinuteCancels: 0 };
            current.totalScheduled += 1;
            if (app.status === 'CANCELLED' && app.cancelled_by === 'WORKER') {
                const workDate = new Date(app.workDate.work_date);
                const updatedAt = new Date(app.updated_at);
                const dayBefore = new Date(workDate);
                dayBefore.setDate(dayBefore.getDate() - 1);
                dayBefore.setHours(0, 0, 0, 0);
                if (updatedAt >= dayBefore) current.lastMinuteCancels += 1;
            }
            workerCancelStats.set(app.user_id, current);
        });

        const formattedJobs = jobs.map(job => {
            const totalRecruitment = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);
            const totalApplied = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
            const totalMatched = job.workDates.reduce((sum, wd) => sum + wd.matched_count, 0);
            const unviewedCount = job.workDates.reduce((sum, wd) =>
                sum + wd.applications.filter(app =>
                    app.facility_viewed_at === null && (app.status === 'APPLIED' || app.status === 'SCHEDULED')
                ).length, 0);

            let dateRange = '';
            if (job.workDates.length > 0) {
                const firstDate = job.workDates[0].work_date;
                const lastDate = job.workDates[job.workDates.length - 1].work_date;
                const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                dateRange = job.workDates.length > 1 ? `${formatDate(firstDate)}〜${formatDate(lastDate)}` : formatDate(firstDate);
            }

            return {
                id: job.id,
                title: job.title,
                status: job.status,
                jobType: job.job_type,
                startTime: job.start_time,
                endTime: job.end_time,
                hourlyWage: job.hourly_wage,
                workContent: job.work_content,
                requiredQualifications: job.required_qualifications,
                requiresInterview: job.requires_interview,
                totalRecruitment,
                totalApplied,
                totalMatched,
                unviewedCount,
                dateRange,
                workDates: job.workDates.map(wd => ({
                    id: wd.id,
                    date: wd.work_date.toISOString(),
                    formattedDate: new Date(wd.work_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }),
                    recruitmentCount: wd.recruitment_count,
                    appliedCount: wd.applied_count,
                    matchedCount: wd.matched_count,
                    unviewedCount: wd.applications.filter(app => app.facility_viewed_at === null && (app.status === 'APPLIED' || app.status === 'SCHEDULED')).length,
                    applications: wd.applications.map(app => {
                        const ratingData = workerRatings.get(app.user.id);
                        const rating = ratingData && ratingData.count > 0 ? ratingData.total / ratingData.count : null;
                        const reviewCount = ratingData ? ratingData.count : 0;
                        const cancelData = workerCancelStats.get(app.user.id);
                        const lastMinuteCancelRate = cancelData && cancelData.totalScheduled > 0 ? (cancelData.lastMinuteCancels / cancelData.totalScheduled) * 100 : 0;
                        return {
                            id: app.id,
                            status: app.status,
                            cancelledBy: app.cancelled_by,
                            createdAt: app.created_at.toISOString(),
                            worker: { id: app.user.id, name: app.user.name, profileImage: app.user.profile_image, qualifications: app.user.qualifications },
                            rating,
                            reviewCount,
                            lastMinuteCancelRate,
                        };
                    }),
                })),
            };
        });

        // ポストソート処理（計算フィールドによるソート）
        let sortedJobs = formattedJobs;
        if (needsPostSort) {
            switch (sort) {
                case 'applied_desc':
                    sortedJobs = [...formattedJobs].sort((a, b) => b.totalApplied - a.totalApplied);
                    break;
                case 'applied_asc':
                    sortedJobs = [...formattedJobs].sort((a, b) => a.totalApplied - b.totalApplied);
                    break;
                case 'unviewed_desc':
                    sortedJobs = [...formattedJobs].sort((a, b) => b.unviewedCount - a.unviewedCount);
                    break;
                case 'workDate_asc':
                    sortedJobs = [...formattedJobs].sort((a, b) => {
                        const aDate = a.workDates[0]?.date || '';
                        const bDate = b.workDates[0]?.date || '';
                        return aDate.localeCompare(bDate);
                    });
                    break;
                case 'workDate_desc':
                    sortedJobs = [...formattedJobs].sort((a, b) => {
                        const aDate = a.workDates[0]?.date || '';
                        const bDate = b.workDates[0]?.date || '';
                        return bDate.localeCompare(aDate);
                    });
                    break;
            }
            // ポストソート後にページネーション適用
            sortedJobs = sortedJobs.slice(skip, skip + limit);
        }

        return {
            data: sortedJobs,
            pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, hasMore: skip + sortedJobs.length < totalCount },
        };
    } catch (error) {
        console.error('[getJobsWithApplications] Error:', error);
        throw error;
    }
}

/**
 * 施設管理用: ワーカーベースで応募情報を取得
 * 最適化: Promise.allで並列クエリ実行
 */
export async function getApplicationsByWorker(
    facilityId: number,
    options: {
        page?: number;
        limit?: number;
        query?: string;
    } = {}
) {
    try {
        const { page = 1, limit = 10, query = '' } = options;
        const skip = (page - 1) * limit;

        const whereConditions: any = {
            workDate: { job: { facility_id: facilityId } },
        };

        if (query) whereConditions.user = { name: { contains: query } };

        // 並列でdistinct取得（最適化）
        const [distinctWorkers, paginatedDistinctApps] = await Promise.all([
            prisma.application.findMany({
                where: whereConditions,
                distinct: ['user_id'],
                select: { user_id: true },
            }),
            prisma.application.findMany({
                where: whereConditions,
                distinct: ['user_id'],
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                select: { user_id: true },
            }),
        ]);

        const totalCount = distinctWorkers.length;
        const targetWorkerIds = paginatedDistinctApps.map(app => app.user_id);
        if (targetWorkerIds.length === 0) return { data: [], pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, hasMore: false } };

        const applications = await prisma.application.findMany({
            where: {
                user_id: { in: targetWorkerIds },
                workDate: { job: { facility_id: facilityId } },
            },
            select: {
                id: true,
                status: true,
                cancelled_by: true,
                created_at: true,
                facility_viewed_at: true,
                user: { select: { id: true, name: true, profile_image: true, qualifications: true, prefecture: true, city: true, experience_fields: true } },
                workDate: { include: { job: { select: { id: true, title: true, start_time: true, end_time: true, hourly_wage: true, requires_interview: true, job_type: true } } } },
            },
            orderBy: { created_at: 'desc' },
        });

        const workerIds = Array.from(new Set(applications.map(app => app.user.id)));

        // 全ワーカー関連データを並列で取得（最適化）
        const [workerBookmarks, workerReviews, workerAllApps, workerWorkCounts] = await Promise.all([
            prisma.bookmark.findMany({
                where: { facility_id: facilityId, target_user_id: { in: workerIds }, type: { in: ['FAVORITE', 'WATCH_LATER'] } },
                select: { target_user_id: true, type: true },
            }),
            prisma.review.findMany({
                where: { user_id: { in: workerIds }, reviewer_type: 'FACILITY' },
                select: { user_id: true, rating: true },
            }),
            prisma.application.findMany({
                where: { user_id: { in: workerIds }, status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'] } },
                select: { user_id: true, status: true, updated_at: true, cancelled_by: true, workDate: { select: { work_date: true } } },
            }),
            prisma.application.groupBy({
                by: ['user_id'],
                where: { user_id: { in: workerIds }, status: { in: ['COMPLETED_PENDING', 'COMPLETED_RATED'] } },
                _count: true,
            }),
        ]);

        const favoriteWorkerIds = new Set(workerBookmarks.filter(b => b.type === 'FAVORITE').map(b => b.target_user_id));
        const blockedWorkerIds = new Set(workerBookmarks.filter(b => b.type === 'WATCH_LATER').map(b => b.target_user_id));

        const workerRatings = new Map<number, { total: number; count: number }>();
        workerReviews.forEach(r => {
            const current = workerRatings.get(r.user_id) || { total: 0, count: 0 };
            current.total += r.rating;
            current.count += 1;
            workerRatings.set(r.user_id, current);
        });

        const workerCancelStats = new Map<number, { totalScheduled: number; lastMinuteCancels: number }>();
        workerAllApps.forEach(app => {
            const current = workerCancelStats.get(app.user_id) || { totalScheduled: 0, lastMinuteCancels: 0 };
            current.totalScheduled += 1;
            if (app.status === 'CANCELLED' && app.cancelled_by === 'WORKER') {
                const workDate = new Date(app.workDate.work_date);
                const updatedAt = new Date(app.updated_at);
                const dayBefore = new Date(workDate);
                dayBefore.setDate(dayBefore.getDate() - 1);
                dayBefore.setHours(0, 0, 0, 0);
                if (updatedAt >= dayBefore) current.lastMinuteCancels += 1;
            }
            workerCancelStats.set(app.user_id, current);
        });

        const workerWorkCountMap = new Map(workerWorkCounts.map(w => [w.user_id, w._count]));

        const workerMap = new Map<number, any>();
        applications.forEach(app => {
            const workerId = app.user.id;
            if (!workerMap.has(workerId)) {
                const ratingData = workerRatings.get(workerId);
                const rating = ratingData && ratingData.count > 0 ? ratingData.total / ratingData.count : null;
                const reviewCount = ratingData ? ratingData.count : 0;
                const cancelData = workerCancelStats.get(workerId);
                const lastMinuteCancelRate = cancelData && cancelData.totalScheduled > 0 ? (cancelData.lastMinuteCancels / cancelData.totalScheduled) * 100 : 0;
                const totalWorkDays = workerWorkCountMap.get(workerId) || 0;

                let experienceFields: any[] = [];
                const userWithExp = app.user as any;
                if (userWithExp.experience_fields) {
                    try {
                        const parsed = typeof userWithExp.experience_fields === 'string' ? JSON.parse(userWithExp.experience_fields) : userWithExp.experience_fields;
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            experienceFields = Object.entries(parsed).map(([field, years]) => ({ field, years: String(years) }));
                        } else if (Array.isArray(parsed)) experienceFields = parsed;
                    } catch { experienceFields = []; }
                }

                workerMap.set(workerId, {
                    worker: {
                        id: workerId,
                        name: app.user.name,
                        profileImage: app.user.profile_image,
                        qualifications: app.user.qualifications,
                        location: app.user.prefecture && app.user.city ? `${app.user.prefecture}${app.user.city}` : app.user.prefecture || null,
                        rating,
                        reviewCount,
                        totalWorkDays,
                        lastMinuteCancelRate,
                        experienceFields,
                        isFavorite: favoriteWorkerIds.has(workerId),
                        isBlocked: blockedWorkerIds.has(workerId),
                    },
                    applications: [],
                    unviewedCount: 0,
                });
            }
            const isUnviewed = app.facility_viewed_at === null && (app.status === 'APPLIED' || app.status === 'SCHEDULED');
            const workerData = workerMap.get(workerId)!;
            if (isUnviewed) workerData.unviewedCount += 1;
            workerData.applications.push({
                id: app.id,
                status: app.status,
                cancelledBy: app.cancelled_by,
                createdAt: app.created_at.toISOString(),
                isUnviewed,
                job: {
                    id: app.workDate.job.id,
                    title: app.workDate.job.title,
                    workDate: app.workDate.work_date.toISOString(),
                    startTime: app.workDate.job.start_time,
                    endTime: app.workDate.job.end_time,
                    hourlyWage: app.workDate.job.hourly_wage,
                    requiresInterview: app.workDate.job.requires_interview,
                    jobType: app.workDate.job.job_type,
                },
            });
        });

        const result = Array.from(workerMap.values()).sort((a, b) => b.unviewedCount !== a.unviewedCount ? b.unviewedCount - a.unviewedCount : b.applications.length - a.applications.length);

        return { data: result, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, hasMore: skip + targetWorkerIds.length < totalCount } };
    } catch (error) {
        console.error('[getApplicationsByWorker] Error:', error);
        throw error;
    }
}

/**
 * 施設管理用: ワーカーの応募を既読にする
 */
export async function markWorkerApplicationsAsViewed(facilityId: number, workerId: number): Promise<{ count: number }> {
    try {
        const result = await prisma.application.updateMany({
            where: {
                user_id: workerId,
                workDate: { job: { facility_id: facilityId } },
                status: { in: ['APPLIED', 'SCHEDULED'] },
                facility_viewed_at: null,
            },
            data: { facility_viewed_at: new Date() },
        });
        console.log('[markWorkerApplicationsAsViewed] Worker:', workerId, 'Marked as viewed:', result.count);
        return { count: result.count };
    } catch (error) {
        console.error('[markWorkerApplicationsAsViewed] Error:', error);
        return { count: 0 };
    }
}

/**
 * 施設の求人一覧を取得（応募管理用・応募数付き）
 */
export async function getFacilityJobsWithApplicationCount(facilityId: number) {
  try {
    // Query jobWorkDate instead of jobs since work_date and applications are now in job_work_dates
    const workDates = await prisma.jobWorkDate.findMany({
      where: {
        job: {
          facility_id: facilityId,
          status: {
            in: ['PUBLISHED', 'WORKING', 'COMPLETED'],
          },
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            start_time: true,
            end_time: true,
            hourly_wage: true,
            work_content: true,
            status: true,
          },
        },
        applications: {
          where: {
            status: 'APPLIED',
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        work_date: 'asc',
      },
    });

    return workDates.map((wd) => ({
      id: wd.job.id,
      workDateId: wd.id,
      title: wd.job.title,
      workDate: wd.work_date.toISOString().split('T')[0],
      startTime: wd.job.start_time,
      endTime: wd.job.end_time,
      hourlyWage: wd.job.hourly_wage,
      workContent: wd.job.work_content,
      status: wd.job.status,
      appliedCount: wd.applications.length,
      totalApplications: wd._count.applications,
    }));
  } catch (error) {
    console.error('[getFacilityJobsWithApplicationCount] Error:', error);
    return [];
  }
}

/**
 * 応募管理用: ワーカーごとにグループ化した応募一覧を取得
 * - ワーカー名、評価、直前キャンセル率、応募した求人リストを含む
 */
export async function getFacilityApplicationsByWorker(facilityId: number) {
  try {
    console.log('[getFacilityApplicationsByWorker] Fetching applications for facility:', facilityId);

    // 施設への全応募を取得
    const applications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            profile_image: true,
            qualifications: true,
          },
        },
        workDate: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                start_time: true,
                end_time: true,
                hourly_wage: true,
                requires_interview: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 全ワーカーのIDを取得
    const workerIds = Array.from(new Set(applications.map((app) => app.user.id)));

    // 各ワーカーの評価を取得（施設→ワーカーの評価）
    const workerReviews = await prisma.review.findMany({
      where: {
        user_id: { in: workerIds },
        reviewer_type: 'FACILITY',
      },
      select: {
        user_id: true,
        rating: true,
      },
    });

    // ワーカーごとの評価を集計
    const workerRatings = new Map<number, { total: number; count: number }>();
    workerReviews.forEach((review) => {
      const current = workerRatings.get(review.user_id) || { total: 0, count: 0 };
      current.total += review.rating;
      current.count += 1;
      workerRatings.set(review.user_id, current);
    });

    // 各ワーカーの全アプリケーションを取得（直前キャンセル率計算用）
    // 直前キャンセル = 勤務日の前日以降にキャンセルされた応募（ワーカー自身のキャンセルのみ）
    const workerAllApplications = await prisma.application.findMany({
      where: {
        user_id: { in: workerIds },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
        },
      },
      select: {
        user_id: true,
        status: true,
        updated_at: true,
        cancelled_by: true,
        workDate: {
          select: {
            work_date: true,
          },
        },
      },
    });

    // ワーカーごとの直前キャンセル率を計算
    const workerCancelRates = new Map<number, { lastMinuteCancels: number; totalScheduled: number }>();
    workerAllApplications.forEach((app) => {
      const current = workerCancelRates.get(app.user_id) || { lastMinuteCancels: 0, totalScheduled: 0 };

      // マッチング済み以上のステータス（キャンセル含む）をカウント
      current.totalScheduled += 1;

      // 直前キャンセルの判定：ワーカー自身のキャンセルかつ勤務日の前日以降に更新された
      // 施設からのキャンセルはカウントしない
      if (app.status === 'CANCELLED' && app.cancelled_by === 'WORKER') {
        const workDate = new Date(app.workDate.work_date);
        const updatedAt = new Date(app.updated_at);
        const dayBefore = new Date(workDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(0, 0, 0, 0);

        if (updatedAt >= dayBefore) {
          current.lastMinuteCancels += 1;
        }
      }

      workerCancelRates.set(app.user_id, current);
    });

    // ワーカーごとにグループ化
    const workerMap = new Map<
      number,
      {
        user: {
          id: number;
          name: string;
          email: string;
          phoneNumber: string;
          profileImage: string | null;
          qualifications: string[];
        };
        rating: number | null;
        reviewCount: number;
        lastMinuteCancelRate: number;
        applications: {
          id: number;
          status: string;
          createdAt: string;
          job: {
            id: number;
            title: string;
            workDate: string;
            startTime: string;
            endTime: string;
            hourlyWage: number;
            requiresInterview: boolean;
          };
        }[];
        latestApplicationAt: Date;
      }
    >();

    applications.forEach((app) => {
      const userId = app.user.id;
      const existing = workerMap.get(userId);

      const applicationData = {
        id: app.id,
        status: app.status,
        createdAt: app.created_at.toISOString(),
        job: {
          id: app.workDate.job.id,
          title: app.workDate.job.title,
          workDate: app.workDate.work_date.toISOString().split('T')[0],
          startTime: app.workDate.job.start_time,
          endTime: app.workDate.job.end_time,
          hourlyWage: app.workDate.job.hourly_wage,
          requiresInterview: app.workDate.job.requires_interview,
        },
      };

      if (existing) {
        existing.applications.push(applicationData);
        if (app.created_at > existing.latestApplicationAt) {
          existing.latestApplicationAt = app.created_at;
        }
      } else {
        const ratingData = workerRatings.get(userId);
        const cancelData = workerCancelRates.get(userId);

        workerMap.set(userId, {
          user: {
            id: app.user.id,
            name: app.user.name,
            email: app.user.email,
            phoneNumber: app.user.phone_number,
            profileImage: app.user.profile_image,
            qualifications: app.user.qualifications,
          },
          rating: ratingData ? ratingData.total / ratingData.count : null,
          reviewCount: ratingData?.count || 0,
          lastMinuteCancelRate:
            cancelData && cancelData.totalScheduled > 0
              ? (cancelData.lastMinuteCancels / cancelData.totalScheduled) * 100
              : 0,
          applications: [applicationData],
          latestApplicationAt: app.created_at,
        });
      }
    });

    // 最新応募日時順でソート
    const result = Array.from(workerMap.values())
      .sort((a, b) => b.latestApplicationAt.getTime() - a.latestApplicationAt.getTime())
      .map(({ latestApplicationAt, ...rest }) => rest);

    console.log('[getFacilityApplicationsByWorker] Found workers:', result.length);

    return result;
  } catch (error) {
    console.error('[getFacilityApplicationsByWorker] Error:', error);
    return [];
  }
}

/**
 * 施設のマッチング済みワーカー一覧を取得
 */
export async function getFacilityMatchedWorkers(facilityId: number) {
  try {
    const applications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile_image: true,
            qualifications: true,
          },
        },
        workDate: {
          select: {
            id: true,
            work_date: true,
            job: {
              select: {
                id: true,
                title: true,
                start_time: true,
                end_time: true,
              },
            },
          },
        },
      },
      orderBy: {
        workDate: {
          work_date: 'asc',
        },
      },
    });

    return applications.map((app) => ({
      applicationId: app.id,
      status: app.status,
      user: {
        id: app.user.id,
        name: app.user.name,
        profileImage: app.user.profile_image,
        qualifications: app.user.qualifications,
      },
      job: {
        id: app.workDate.job.id,
        title: app.workDate.job.title,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
      },
    }));
  } catch (error) {
    console.error('[getFacilityMatchedWorkers] Error:', error);
    return [];
  }
}

/**
 * 施設の未確認応募を確認済みにする
 * 応募管理ページを開いた時に呼び出す
 * @deprecated 個別の markJobApplicationsAsViewed / markWorkerApplicationsAsViewed を使用してください
 */
export async function markApplicationsAsViewed(facilityId: number): Promise<{ count: number }> {
  try {
    const result = await prisma.application.updateMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: { in: ['APPLIED', 'SCHEDULED'] },
        facility_viewed_at: null,
      },
      data: {
        facility_viewed_at: new Date(),
      },
    });

    console.log('[markApplicationsAsViewed] Marked as viewed:', result.count);
    return { count: result.count };
  } catch (error) {
    console.error('[markApplicationsAsViewed] Error:', error);
    return { count: 0 };
  }
}

/**
 * 特定の求人の未確認応募を確認済みにする
 * 求人カードをクリックした時に呼び出す
 */
export async function markJobApplicationsAsViewed(facilityId: number, jobId: number): Promise<{ count: number }> {
  try {
    const result = await prisma.application.updateMany({
      where: {
        workDate: {
          job: {
            id: jobId,
            facility_id: facilityId,
          },
        },
        status: { in: ['APPLIED', 'SCHEDULED'] },
        facility_viewed_at: null,
      },
      data: {
        facility_viewed_at: new Date(),
      },
    });

    console.log('[markJobApplicationsAsViewed] Job:', jobId, 'Marked as viewed:', result.count);
    return { count: result.count };
  } catch (error) {
    console.error('[markJobApplicationsAsViewed] Error:', error);
    return { count: 0 };
  }
}
