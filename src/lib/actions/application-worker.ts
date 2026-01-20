'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentTime } from '@/utils/debugTime';
import { getAuthenticatedUser } from './helpers';
import { checkProfileComplete } from './user-profile';
import {
    sendApplicationNotification,
    sendApplicationNotificationMultiple,
    sendAdminHighCancelRateNotification,
    sendMatchingNotification,
    sendApplicationConfirmNotification,
    sendWorkerCancelNotification,
    sendApplicationWithdrawalNotification,
    sendInitialGreetingNotification,
} from './notification';
import { sendNearbyJobNotifications, sendNotification } from '../notification-service';
import { updateApplicationStatuses } from '../status-updater';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';

/**
 * ユーザーが応募した仕事の一覧を取得
 */
export async function getMyApplications(options?: { limit?: number; offset?: number }) {
    try {
        const user = await getAuthenticatedUser();
        console.log('[getMyApplications] Fetching applications for user:', user.id);

        // アクセス時にステータスをリアルタイム更新
        await updateApplicationStatuses({ userId: user.id });

        const limit = options?.limit ?? 50; // デフォルト50件
        const offset = options?.offset ?? 0;

        const applications = await prisma.application.findMany({
            where: {
                user_id: user.id,
            },
            include: {
                workDate: {
                    include: {
                        job: {
                            include: {
                                facility: {
                                    select: {
                                        id: true,
                                        corporation_name: true,
                                        facility_name: true,
                                        facility_type: true,
                                        address: true,
                                        lat: true,
                                        lng: true,
                                        phone_number: true,
                                        description: true,
                                        images: true,
                                        rating: true,
                                        review_count: true,
                                        initial_message: true,
                                        created_at: true,
                                        updated_at: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
            take: limit,
            skip: offset,
        });

        console.log('[getMyApplications] Found applications:', applications.length);

        return applications.map((app) => {
            const job = app.workDate.job;
            const workDate = app.workDate;

            return {
                id: app.id,
                work_date_id: app.work_date_id,
                user_id: app.user_id,
                status: app.status,
                worker_review_status: app.worker_review_status,
                facility_review_status: app.facility_review_status,
                message: app.message,
                created_at: app.created_at.toISOString(),
                updated_at: app.updated_at.toISOString(),
                workDate: {
                    id: workDate.id,
                    work_date: workDate.work_date.toISOString(),
                    deadline: workDate.deadline.toISOString(),
                    recruitment_count: workDate.recruitment_count,
                    applied_count: workDate.applied_count,
                },
                job_id: job.id,
                job: {
                    id: job.id,
                    facility_id: job.facility_id,
                    template_id: job.template_id,
                    status: job.status,
                    job_type: job.job_type,
                    requires_interview: job.requires_interview,
                    title: job.title,
                    work_date: workDate.work_date.toISOString(),
                    start_time: job.start_time,
                    end_time: job.end_time,
                    break_time: job.break_time,
                    wage: job.wage,
                    hourly_wage: job.hourly_wage,
                    transportation_fee: job.transportation_fee,
                    deadline: workDate.deadline.toISOString(),
                    tags: job.tags,
                    address: job.address,
                    access: job.access,
                    recruitment_count: workDate.recruitment_count,
                    applied_count: workDate.applied_count,
                    overview: job.overview,
                    work_content: job.work_content,
                    required_qualifications: job.required_qualifications,
                    required_experience: job.required_experience,
                    dresscode: job.dresscode,
                    belongings: job.belongings,
                    manager_name: job.manager_name,
                    manager_message: job.manager_message,
                    manager_avatar: job.manager_avatar,
                    images: job.images,
                    created_at: job.created_at.toISOString(),
                    updated_at: job.updated_at.toISOString(),
                    facility: {
                        id: job.facility.id,
                        corporation_name: job.facility.corporation_name,
                        facility_name: job.facility.facility_name,
                        facility_type: job.facility.facility_type,
                        address: job.facility.address,
                        lat: job.facility.lat,
                        lng: job.facility.lng,
                        phone_number: job.facility.phone_number,
                        description: job.facility.description,
                        images: job.facility.images,
                        rating: job.facility.rating,
                        review_count: job.facility.review_count,
                        initial_message: job.facility.initial_message,
                        created_at: job.facility.created_at.toISOString(),
                        updated_at: job.facility.updated_at.toISOString(),
                    },
                },
            };
        });
    } catch (error) {
        console.error('[getMyApplications] Error:', error);
        return [];
    }
}

/**
 * 求人に応募（単一日時）
 */
export async function applyForJob(jobId: string, workDateId?: number) {
    try {
        const jobIdNum = parseInt(jobId, 10);
        if (isNaN(jobIdNum)) {
            console.error('[applyForJob] Invalid job ID:', jobId);
            return { success: false, error: '無効な求人IDです' };
        }

        console.log('[applyForJob] Applying for job:', jobIdNum);

        const job = await prisma.job.findUnique({
            where: { id: jobIdNum },
            include: {
                workDates: { orderBy: { work_date: 'asc' } },
                facility: true,
            },
        });

        if (!job) {
            console.error('[applyForJob] Job not found:', jobIdNum);
            return { success: false, error: '求人が見つかりません' };
        }

        if (job.workDates.length === 0) {
            console.error('[applyForJob] No work dates found for job:', jobIdNum);
            return { success: false, error: '勤務日が設定されていません' };
        }

        const user = await getAuthenticatedUser();
        console.log('[applyForJob] Using user:', user.id);

        if (user.is_suspended) {
            console.log('[applyForJob] User is suspended:', user.id);
            return { success: false, error: 'アカウントが停止されているため、応募できません' };
        }

        const profileCheck = await checkProfileComplete(user.id);
        if (!profileCheck.isComplete) {
            console.log('[applyForJob] Profile incomplete:', profileCheck.missingFields);
            return {
                success: false,
                error: `プロフィールを完成させてください。未入力項目: ${profileCheck.missingFields.join('、')}`,
                missingFields: profileCheck.missingFields,
            };
        }

        const targetWorkDateId = workDateId || job.workDates[0].id;
        const targetWorkDate = job.workDates.find(wd => wd.id === targetWorkDateId);

        if (!targetWorkDate) {
            console.error('[applyForJob] Target work date not found:', targetWorkDateId);
            return { success: false, error: '勤務日が見つかりません' };
        }

        if (!job.requires_interview && targetWorkDate.matched_count >= targetWorkDate.recruitment_count) {
            return { success: false, error: 'この勤務日は既に募集人数に達しています' };
        }

        const existingApplication = await prisma.application.findFirst({
            where: {
                work_date_id: targetWorkDateId,
                user_id: user.id,
            },
        });

        if (existingApplication && existingApplication.status !== 'CANCELLED') {
            console.log('[applyForJob] Already applied:', { workDateId: targetWorkDateId, userId: user.id });
            return { success: false, error: 'この勤務日には既に応募済みです' };
        }

        const initialStatus = job.requires_interview ? 'APPLIED' : 'SCHEDULED';
        const isImmediateMatch = !job.requires_interview;

        console.log('[applyForJob] Creating/Updating application...', {
            workDateId: targetWorkDateId,
            userId: user.id,
            requiresInterview: job.requires_interview,
            initialStatus,
            isReapply: !!existingApplication,
        });

        const application = await prisma.$transaction(async (tx) => {
            let app;

            if (existingApplication && existingApplication.status === 'CANCELLED') {
                app = await tx.application.update({
                    where: { id: existingApplication.id },
                    data: { status: initialStatus, updated_at: new Date() },
                });
                console.log('[applyForJob] Reactivated cancelled application:', app.id);
            } else {
                app = await tx.application.create({
                    data: { work_date_id: targetWorkDateId, user_id: user.id, status: initialStatus },
                });
            }

            await tx.jobWorkDate.update({
                where: { id: targetWorkDateId },
                data: {
                    applied_count: { increment: 1 },
                    ...(isImmediateMatch && { matched_count: { increment: 1 } }),
                },
            });

            return app;
        });

        console.log('[applyForJob] Application created successfully:', application.id);

        sendApplicationNotification(
            job.facility_id,
            user.name,
            job.title,
            application.id
        ).catch(err => console.error('[applyForJob] Background notification error:', err));

        if (isImmediateMatch) {
            const workerLastName = user.name?.split(' ')[0] || user.name || '';

            // マッチング通知を送信（通知設定に基づく）
            sendMatchingNotification(
                user.id,
                job.title,
                job.facility.facility_name,
                jobIdNum,
                application.id,
                {
                    workDate: targetWorkDate.work_date,
                    startTime: job.start_time,
                    endTime: job.end_time,
                },
                job.requires_interview,
                job.facility_id
            ).catch(err => console.error('[applyForJob] Matching notification error:', err));

            // 初回挨拶通知を送信（通知設定に基づく）
            sendInitialGreetingNotification(
                user.id,
                job.facility_id,
                jobIdNum,
                application.id,
                workerLastName
            ).catch(err => console.error('[applyForJob] Initial greeting error:', err));
        }

        const message = isImmediateMatch
            ? 'マッチングが成立しました！勤務日をお待ちください。'
            : '応募が完了しました。施設からの連絡をお待ちください。';

        revalidatePath(`/jobs/${jobIdNum}`);
        revalidatePath('/my-jobs');

        // 応募成功をログ記録
        logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: user.email,
            action: 'JOB_APPLY',
            targetType: 'Application',
            targetId: application.id,
            requestData: {
                jobId: jobIdNum,
                jobTitle: job.title,
                workDateId: targetWorkDateId,
                workDate: targetWorkDate.work_date.toISOString(),
                facilityId: job.facility_id,
                facilityName: job.facility.facility_name,
                isImmediateMatch,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            message,
            isMatched: isImmediateMatch,
            applicationId: application.id,
        };
    } catch (error) {
        console.error('[applyForJob] Error details:', error);

        // 応募失敗をログ記録（ユーザー情報取得を試みる）
        getAuthenticatedUser().then(user => {
            logActivity({
                userType: 'WORKER',
                userId: user.id,
                userEmail: user.email,
                action: 'JOB_APPLY_FAILED',
                requestData: { jobId },
                result: 'ERROR',
                errorMessage: getErrorMessage(error),
                errorStack: getErrorStack(error),
            }).catch(() => {});
        }).catch(() => {
            // ユーザー情報が取得できない場合はユーザー情報なしでログ
            logActivity({
                userType: 'WORKER',
                action: 'JOB_APPLY_FAILED',
                requestData: { jobId },
                result: 'ERROR',
                errorMessage: getErrorMessage(error),
                errorStack: getErrorStack(error),
            }).catch(() => {});
        });

        return { success: false, error: '応募に失敗しました。もう一度お試しください。' };
    }
}

/**
 * 求人に一括応募
 */
export async function applyForJobMultipleDates(jobId: string, workDateIds: number[]) {
    try {
        const jobIdNum = parseInt(jobId, 10);
        if (isNaN(jobIdNum)) return { success: false, error: '無効な求人IDです' };
        if (!workDateIds || workDateIds.length === 0) return { success: false, error: '勤務日を選択してください' };

        console.log('[applyForJobMultipleDates] Applying for job:', jobIdNum, 'dates:', workDateIds);

        const job = await prisma.job.findUnique({
            where: { id: jobIdNum },
            include: {
                workDates: { orderBy: { work_date: 'asc' } },
                facility: true,
            },
        });

        if (!job) return { success: false, error: '求人が見つかりません' };

        const user = await getAuthenticatedUser();
        if (user.is_suspended) return { success: false, error: 'アカウントが停止されているため、応募できません' };

        const profileCheck = await checkProfileComplete(user.id);
        if (!profileCheck.isComplete) {
            return {
                success: false,
                error: `プロフィールを完成させてください。未入力項目: ${profileCheck.missingFields.join('、')}`,
                missingFields: profileCheck.missingFields,
            };
        }

        const targetWorkDates = job.workDates.filter(wd => workDateIds.includes(wd.id));
        if (targetWorkDates.length === 0) return { success: false, error: '指定された勤務日が見つかりません' };

        const existingApplications = await prisma.application.findMany({
            where: {
                work_date_id: { in: workDateIds },
                user_id: user.id,
                status: { not: 'CANCELLED' },
            },
        });
        const alreadyAppliedIds = existingApplications.map(a => a.work_date_id);
        const newWorkDateIds = workDateIds.filter(id => !alreadyAppliedIds.includes(id));

        if (newWorkDateIds.length === 0) return { success: false, error: '選択された勤務日にはすべて応募済みです' };

        const initialStatus = job.requires_interview ? 'APPLIED' : 'SCHEDULED';
        const isImmediateMatch = !job.requires_interview;

        if (!job.requires_interview) {
            for (const workDateId of newWorkDateIds) {
                const wd = targetWorkDates.find(w => w.id === workDateId);
                if (wd && wd.matched_count >= wd.recruitment_count) {
                    return { success: false, error: `勤務日（${new Date(wd.work_date).toLocaleDateString('ja-JP')}）は既に募集人数に達しています` };
                }
            }
        }

        const createdApplications = await prisma.$transaction(async (tx) => {
            const apps = [];
            for (const workDateId of newWorkDateIds) {
                const cancelledApp = await tx.application.findFirst({
                    where: { work_date_id: workDateId, user_id: user.id, status: 'CANCELLED' },
                });

                let app;
                if (cancelledApp) {
                    app = await tx.application.update({
                        where: { id: cancelledApp.id },
                        data: { status: initialStatus, updated_at: new Date() },
                    });
                } else {
                    app = await tx.application.create({
                        data: { work_date_id: workDateId, user_id: user.id, status: initialStatus },
                    });
                }
                apps.push(app);

                await tx.jobWorkDate.update({
                    where: { id: workDateId },
                    data: {
                        applied_count: { increment: 1 },
                        ...(isImmediateMatch && { matched_count: { increment: 1 } }),
                    },
                });
            }
            return apps;
        });

        console.log('[applyForJobMultipleDates] Created applications:', createdApplications.map(a => a.id));

        const appliedWorkDatesFormatted = targetWorkDates
            .filter(wd => newWorkDateIds.includes(wd.id))
            .sort((a, b) => new Date(a.work_date).getTime() - new Date(b.work_date).getTime())
            .map(wd => {
                const date = new Date(wd.work_date);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                return `${dateStr} ${job.start_time}〜${job.end_time}`;
            });

        const appliedWorkDates = targetWorkDates
            .filter(wd => newWorkDateIds.includes(wd.id))
            .map(wd => new Date(wd.work_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }));

        sendApplicationNotificationMultiple(
            job.facility_id,
            user.name,
            job.title,
            createdApplications[0].id,
            appliedWorkDates
        ).catch(err => console.error('[applyForJobMultipleDates] Background notification error:', err));

        const baseUrl = process.env.NEXTAUTH_URL || 'https://tastas.jp';
        const jobDetailUrl = `${baseUrl}/jobs/${jobIdNum}`;

        const appliedDatesListStr = appliedWorkDatesFormatted.join('\n');
        const applicationConfirmSetting = await prisma.notificationSetting.findUnique({
            where: { notification_key: 'WORKER_APPLICATION_CONFIRMED' },
        });

        const workerLastName = user.name?.split(' ')[0] || user.name || '';
        let applicationConfirmMessage: string;
        if (applicationConfirmSetting?.chat_enabled && applicationConfirmSetting?.chat_message) {
            const statusMessage = isImmediateMatch ? 'マッチングが成立しました。勤務日をお待ちください。' : '施設からの返答をお待ちください。';
            applicationConfirmMessage = applicationConfirmSetting.chat_message
                .replace(/\{\{applied_dates\}\}/g, appliedDatesListStr)
                .replace(/\{\{job_title\}\}/g, job.title)
                .replace(/\{\{job_url\}\}/g, jobDetailUrl)
                .replace(/\{\{facility_name\}\}/g, job.facility.facility_name)
                .replace(/\{\{worker_name\}\}/g, user.name || '')
                .replace(/\{\{worker_last_name\}\}/g, workerLastName)
                .replace(/\{\{wage\}\}/g, job.wage?.toString() || '')
                .replace(/\{\{hourly_wage\}\}/g, job.hourly_wage?.toString() || '')
                .replace(/\{\{start_time\}\}/g, job.start_time.substring(0, 5))
                .replace(/\{\{end_time\}\}/g, job.end_time.substring(0, 5))
                .replace(/\{\{status_message\}\}/g, statusMessage);
        } else {
            applicationConfirmMessage = `【応募を受け付けました】\n\n以下の日程に応募しました：\n${appliedDatesListStr}\n\n▼ 求人詳細\n${job.title}\n${jobDetailUrl}\n\n${isImmediateMatch ? 'マッチングが成立しました。勤務日をお待ちください。' : '施設からの返答をお待ちください。'}`;
        }

        // 応募確認通知を送信（通知設定に基づく）
        sendApplicationConfirmNotification(
            user.id,
            job.title,
            job.facility.facility_name,
            jobIdNum,
            appliedDatesListStr,
            isImmediateMatch,
            createdApplications[0].id,
            job.facility_id
        ).catch(err => console.error('[applyForJobMultipleDates] Application confirm notification error:', err));

        if (isImmediateMatch) {
            const firstCreatedApp = createdApplications[0];
            const firstWorkDate = targetWorkDates.find(wd => wd.id === firstCreatedApp.work_date_id)
                || job.workDates.find(wd => wd.id === firstCreatedApp.work_date_id);

            if (firstWorkDate) {
                // マッチング通知を送信（通知設定に基づく）
                sendMatchingNotification(
                    user.id,
                    job.title,
                    job.facility.facility_name,
                    jobIdNum,
                    createdApplications[0].id,
                    {
                        workDate: firstWorkDate.work_date,
                        startTime: job.start_time,
                        endTime: job.end_time,
                    },
                    job.requires_interview,
                    job.facility_id
                ).catch(err => console.error('[applyForJobMultipleDates] Matching notification error:', err));
            }

            // 初回挨拶通知を送信（通知設定に基づく）
            sendInitialGreetingNotification(
                user.id,
                job.facility_id,
                jobIdNum,
                createdApplications[0].id,
                workerLastName
            ).catch(err => console.error('[applyForJobMultipleDates] Initial greeting error:', err));
        }

        const message = isImmediateMatch
            ? 'マッチングが成立しました！勤務日をお待ちください。'
            : '応募が完了しました。施設からの連絡をお待ちください。';

        revalidatePath(`/jobs/${jobIdNum}`);
        revalidatePath('/my-jobs');

        return { success: true, message, isMatched: isImmediateMatch, applicationIds: createdApplications.map(a => a.id) };
    } catch (error) {
        console.error('[applyForJobMultipleDates] Error:', error);
        return { success: false, error: '応募に失敗しました。もう一度お試しください。' };
    }
}

/**
 * ユーザーが求人のどの勤務日に応募済みかを取得
 */
export async function getUserApplicationStatuses(jobId: string): Promise<number[]> {
    try {
        const jobIdNum = parseInt(jobId, 10);
        if (isNaN(jobIdNum)) return [];
        const user = await getAuthenticatedUser();
        const applications = await prisma.application.findMany({
            where: {
                user_id: user.id,
                workDate: { job_id: jobIdNum },
                status: { not: 'CANCELLED' },
            },
            select: { work_date_id: true },
        });
        return applications.map((app) => app.work_date_id);
    } catch (error) {
        console.error('[getUserApplicationStatuses] Error:', error);
        return [];
    }
}

/**
 * ユーザーのスケジュール済み仕事を取得（時間重複判定用）
 */
export async function getUserScheduledJobs(): Promise<{
    date: string;
    startTime: string;
    endTime: string;
    jobId: number;
    workDateId: number;
}[]> {
    try {
        const user = await getAuthenticatedUser();
        const applications = await prisma.application.findMany({
            where: {
                user_id: user.id,
                status: { in: ['SCHEDULED', 'WORKING'] },
            },
            include: {
                workDate: {
                    include: {
                        job: { select: { id: true, start_time: true, end_time: true } },
                    },
                },
            },
        });

        return applications
            .filter(app => app.workDate !== null)
            .map(app => ({
                date: app.workDate!.work_date.toISOString().split('T')[0],
                startTime: app.workDate!.job.start_time,
                endTime: app.workDate!.job.end_time,
                jobId: app.workDate!.job.id,
                workDateId: app.work_date_id,
            }));
    } catch (error) {
        console.error('[getUserScheduledJobs] Error:', error);
        return [];
    }
}

/**
 * 応募詳細を取得
 */
export async function getApplicationDetail(applicationId: number) {
    try {
        const user = await getAuthenticatedUser();
        console.log('[getApplicationDetail] Fetching application:', applicationId, 'for user:', user.id);

        const application = await prisma.application.findFirst({
            where: { id: applicationId, user_id: user.id },
            include: {
                workDate: {
                    include: {
                        job: { include: { facility: true, template: true } },
                    },
                },
                laborDocument: true,
            },
        });

        if (!application) return null;

        const job = application.workDate.job;
        const workDate = application.workDate;

        return {
            id: application.id,
            work_date_id: application.work_date_id,
            user_id: application.user_id,
            status: application.status,
            worker_review_status: application.worker_review_status,
            facility_review_status: application.facility_review_status,
            message: application.message,
            created_at: application.created_at.toISOString(),
            updated_at: application.updated_at.toISOString(),
            work_date: workDate.work_date.toISOString(),
            laborDocument: application.laborDocument ? {
                id: application.laborDocument.id,
                pdf_generated: application.laborDocument.pdf_generated,
                pdf_path: application.laborDocument.pdf_path,
                sent_to_chat: application.laborDocument.sent_to_chat,
                sent_at: application.laborDocument.sent_at?.toISOString() || null,
            } : null,
            job: {
                id: job.id,
                facility_id: job.facility_id,
                template_id: job.template_id,
                status: job.status,
                title: job.title,
                start_time: job.start_time,
                end_time: job.end_time,
                break_time: job.break_time,
                wage: job.wage,
                hourly_wage: job.hourly_wage,
                transportation_fee: job.transportation_fee,
                address: job.address,
                prefecture: job.prefecture,
                city: job.city,
                address_line: job.address_line,
                access: job.access,
                overview: job.overview,
                work_content: job.work_content,
                required_qualifications: job.required_qualifications,
                required_experience: job.required_experience,
                dresscode: job.dresscode,
                belongings: job.belongings,
                requires_interview: job.requires_interview,
                facility: {
                    id: job.facility.id,
                    corporation_name: job.facility.corporation_name,
                    facility_name: job.facility.facility_name,
                    facility_type: job.facility.facility_type,
                    address: job.facility.address,
                    prefecture: job.facility.prefecture,
                    city: job.facility.city,
                    address_line: job.facility.address_line,
                    phone_number: job.facility.phone_number,
                    smoking_measure: job.facility.smoking_measure,
                },
                template: job.template ? {
                    id: job.template.id,
                    dismissal_reasons: job.template.dismissal_reasons,
                } : null,
            },
        };
    } catch (error) {
        console.error('[getApplicationDetail] Error:', error);
        return null;
    }
}

/**
 * ワーカー自身が応募をキャンセル（マッチング済み）
 */
export async function cancelApplicationByWorker(applicationId: number) {
    try {
        const user = await getAuthenticatedUser();
        console.log('[cancelApplicationByWorker] User:', user.id, 'Application:', applicationId);

        const application = await prisma.application.findFirst({
            where: { id: applicationId, user_id: user.id },
            include: {
                workDate: { include: { job: { include: { facility: true } } } },
            },
        });

        if (!application) return { success: false, error: '応募が見つかりません' };
        if (application.status !== 'SCHEDULED') return { success: false, error: 'この応募はキャンセルできません' };

        const workDate = application.workDate.work_date;
        const startTime = application.workDate.job.start_time;
        const [hours, minutes] = startTime.split(':').map(Number);
        const workStartDateTime = new Date(workDate);
        workStartDateTime.setHours(hours, minutes, 0, 0);

        const now = getCurrentTime();
        if (now >= workStartDateTime) return { success: false, error: '勤務開始時刻を過ぎているためキャンセルできません' };

        await prisma.$transaction(async (tx) => {
            await tx.jobWorkDate.update({
                where: { id: application.work_date_id },
                data: { matched_count: { decrement: 1 }, applied_count: { decrement: 1 } },
            });

            await tx.application.update({
                where: { id: applicationId },
                data: { status: 'CANCELLED', cancelled_by: 'WORKER' },
            });

            if (application.workDate && application.workDate.job) {
                sendNearbyJobNotifications(application.workDate.job.id, 'WORKER_NEARBY_CANCEL_AVAILABLE')
                    .catch(e => console.error('[cancelApplication] Nearby notification error:', e));
            }
        });

        const workDateStr = application.workDate.work_date.toISOString().split('T')[0];

        // ワーカーからのキャンセル通知（通知設定に基づく - チャット・メール・プッシュ）
        const workerUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true },
        });

        await sendWorkerCancelNotification(
            application.workDate.job.facility_id,
            workerUser?.name || '',
            application.workDate.job.title,
            workDateStr,
            applicationId,
            application.workDate.job_id,
            user.id
        );

        // キャンセル率チェック（高いキャンセル率の場合は管理者に通知）
        const CANCEL_RATE_THRESHOLD = 0.2; // 20%以上でアラート
        const MIN_APPLICATIONS_FOR_ALERT = 5; // 最低5件以上の応募がある場合のみ

        const [cancelledCount, totalCount] = await Promise.all([
            prisma.application.count({
                where: { user_id: user.id, status: 'CANCELLED', cancelled_by: 'WORKER' },
            }),
            prisma.application.count({
                where: { user_id: user.id, status: { in: ['COMPLETED_RATED', 'CANCELLED'] } },
            }),
        ]);

        if (totalCount >= MIN_APPLICATIONS_FOR_ALERT) {
            const cancelRate = cancelledCount / totalCount;
            if (cancelRate >= CANCEL_RATE_THRESHOLD) {
                const workerName = (await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { name: true },
                }))?.name || 'ワーカー';

                await sendAdminHighCancelRateNotification(
                    'WORKER',
                    user.id,
                    workerName,
                    Math.round(cancelRate * 100)
                );
            }
        }

        revalidatePath('/my-jobs');
        revalidatePath('/admin/applications');

        // キャンセル成功をログ記録
        logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: user.email,
            action: 'JOB_CANCEL',
            targetType: 'Application',
            targetId: applicationId,
            requestData: {
                jobId: application.workDate.job_id,
                jobTitle: application.workDate.job.title,
                workDate: application.workDate.work_date.toISOString(),
                facilityId: application.workDate.job.facility_id,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, message: 'キャンセルしました' };
    } catch (error) {
        console.error('[cancelApplicationByWorker] Error:', error);

        // キャンセル失敗をログ記録（ユーザー情報取得を試みる）
        getAuthenticatedUser().then(user => {
            logActivity({
                userType: 'WORKER',
                userId: user.id,
                userEmail: user.email,
                action: 'JOB_CANCEL_FAILED',
                requestData: { applicationId },
                result: 'ERROR',
                errorMessage: getErrorMessage(error),
                errorStack: getErrorStack(error),
            }).catch(() => {});
        }).catch(() => {
            // ユーザー情報が取得できない場合はユーザー情報なしでログ
            logActivity({
                userType: 'WORKER',
                action: 'JOB_CANCEL_FAILED',
                requestData: { applicationId },
                result: 'ERROR',
                errorMessage: getErrorMessage(error),
                errorStack: getErrorStack(error),
            }).catch(() => {});
        });

        return { success: false, error: 'キャンセルに失敗しました' };
    }
}

/**
 * オファー求人を受諾（即マッチング）
 */
export async function acceptOffer(jobId: string, workDateId: number) {
    try {
        const jobIdNum = parseInt(jobId, 10);
        if (isNaN(jobIdNum)) {
            console.error('[acceptOffer] Invalid job ID:', jobId);
            return { success: false, error: '無効な求人IDです' };
        }

        console.log('[acceptOffer] Accepting offer for job:', jobIdNum, 'workDate:', workDateId);

        const job = await prisma.job.findUnique({
            where: { id: jobIdNum },
            include: {
                workDates: { orderBy: { work_date: 'asc' } },
                facility: true,
            },
        });

        if (!job) {
            console.error('[acceptOffer] Job not found:', jobIdNum);
            return { success: false, error: '求人が見つかりません' };
        }

        // オファー求人かどうか確認
        if (job.job_type !== 'OFFER') {
            console.error('[acceptOffer] Job is not an offer:', job.job_type);
            return { success: false, error: 'この求人はオファーではありません' };
        }

        const user = await getAuthenticatedUser();
        console.log('[acceptOffer] Using user:', user.id);

        // ターゲットユーザー確認
        if (job.target_worker_id !== user.id) {
            console.error('[acceptOffer] User is not target worker:', user.id, 'target:', job.target_worker_id);
            return { success: false, error: 'このオファーはあなた宛てではありません' };
        }

        if (user.is_suspended) {
            console.log('[acceptOffer] User is suspended:', user.id);
            return { success: false, error: 'アカウントが停止されているため、オファーを受けられません' };
        }

        const profileCheck = await checkProfileComplete(user.id);
        if (!profileCheck.isComplete) {
            console.log('[acceptOffer] Profile incomplete:', profileCheck.missingFields);
            return {
                success: false,
                error: `プロフィールを完成させてください。未入力項目: ${profileCheck.missingFields.join('、')}`,
                missingFields: profileCheck.missingFields,
            };
        }

        const targetWorkDate = job.workDates.find(wd => wd.id === workDateId);
        if (!targetWorkDate) {
            console.error('[acceptOffer] Target work date not found:', workDateId);
            return { success: false, error: '勤務日が見つかりません' };
        }

        // 既に募集人数に達していないか確認
        if (targetWorkDate.matched_count >= targetWorkDate.recruitment_count) {
            return { success: false, error: 'このオファーは既に受諾済みです' };
        }

        // 既存の応募がないか確認
        const existingApplication = await prisma.application.findFirst({
            where: {
                work_date_id: workDateId,
                user_id: user.id,
                status: { not: 'CANCELLED' },
            },
        });

        if (existingApplication) {
            console.log('[acceptOffer] Already accepted:', { workDateId, userId: user.id });
            return { success: false, error: 'このオファーは既に受諾済みです' };
        }

        // オファーは即マッチング（SCHEDULED）
        const application = await prisma.$transaction(async (tx) => {
            const app = await tx.application.create({
                data: {
                    work_date_id: workDateId,
                    user_id: user.id,
                    status: 'SCHEDULED',
                },
            });

            await tx.jobWorkDate.update({
                where: { id: workDateId },
                data: {
                    applied_count: { increment: 1 },
                    matched_count: { increment: 1 },
                },
            });

            return app;
        });

        console.log('[acceptOffer] Application created successfully:', application.id);

        // 施設への通知
        sendApplicationNotification(
            job.facility_id,
            user.name,
            job.title,
            application.id,
            'FACILITY_OFFER_ACCEPTED'
        ).catch(err => console.error('[acceptOffer] Background notification error:', err));

        // マッチングメッセージの送信
        const baseUrl = process.env.NEXTAUTH_URL || 'https://tastas.jp';
        const jobDetailUrl = `${baseUrl}/my-jobs/${application.id}`;

        const workerLastName = user.name?.split(' ')[0] || user.name || '';

        // マッチング通知を送信（通知設定に基づく）
        sendMatchingNotification(
            user.id,
            job.title,
            job.facility.facility_name,
            jobIdNum,
            application.id,
            {
                workDate: targetWorkDate.work_date,
                startTime: job.start_time,
                endTime: job.end_time,
            },
            job.requires_interview,
            job.facility_id
        ).catch(err => console.error('[acceptOffer] Matching notification error:', err));

        // 初回挨拶通知を送信（通知設定に基づく）
        sendInitialGreetingNotification(
            user.id,
            job.facility_id,
            jobIdNum,
            application.id,
            workerLastName
        ).catch(err => console.error('[acceptOffer] Initial greeting error:', err));

        revalidatePath(`/jobs/${jobIdNum}`);
        revalidatePath('/my-jobs');

        return {
            success: true,
            message: 'オファーを受諾しました！勤務日をお待ちください。',
            isMatched: true,
            applicationId: application.id,
        };
    } catch (error) {
        console.error('[acceptOffer] Error details:', error);
        return { success: false, error: 'オファーの受諾に失敗しました。もう一度お試しください。' };
    }
}

/**
 * ワーカーが審査中（APPLIED）の応募を取り消し
 */
export async function cancelAppliedApplication(applicationId: number) {
    try {
        const user = await getAuthenticatedUser();
        console.log('[cancelAppliedApplication] User:', user.id, 'Application:', applicationId);

        const application = await prisma.application.findFirst({
            where: { id: applicationId, user_id: user.id },
            include: {
                workDate: { include: { job: { include: { facility: true } } } },
            },
        });

        if (!application) return { success: false, error: '応募が見つかりません' };
        if (application.status !== 'APPLIED') return { success: false, error: 'この応募はキャンセルできません' };

        await prisma.$transaction(async (tx) => {
            await tx.jobWorkDate.update({
                where: { id: application.work_date_id },
                data: { applied_count: { decrement: 1 } },
            });

            await tx.application.update({
                where: { id: applicationId },
                data: { status: 'CANCELLED' },
            });
        });

        const workDateStr = application.workDate.work_date.toISOString().split('T')[0];

        // 応募取り消し通知を送信（通知設定に基づく）
        await sendApplicationWithdrawalNotification(
            application.workDate.job.facility_id,
            application.workDate.job.title,
            workDateStr,
            applicationId,
            application.workDate.job_id,
            user.id
        );

        revalidatePath('/my-jobs');
        revalidatePath('/admin/applications');
        return { success: true, message: '応募を取り消しました' };
    } catch (error) {
        console.error('[cancelAppliedApplication] Error:', error);
        return { success: false, error: '取り消しに失敗しました' };
    }
}
