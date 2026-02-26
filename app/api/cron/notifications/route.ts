import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/src/lib/notification-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60秒タイムアウト

/**
 * Cron APIの認証を検証
 */
function verifyCronAuth(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'development' && !cronSecret) {
        console.warn('[CRON-NOTIFY] Warning: CRON_SECRET is not set. Skipping auth in development.');
        return true;
    }

    if (!cronSecret) {
        console.error('[CRON-NOTIFY] Error: CRON_SECRET environment variable is not set');
        return false;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) {
        return true;
    }

    const url = new URL(request.url);
    const querySecret = url.searchParams.get('secret');
    if (querySecret === cronSecret) {
        return true;
    }

    return false;
}

/**
 * JSTの今日・明日の日付を取得
 */
function getJSTDates() {
    const now = new Date();
    // JSTはUTC+9
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);

    // JSTの今日の0:00
    const todayStart = new Date(jstNow);
    todayStart.setUTCHours(0, 0, 0, 0);

    // JSTの明日の0:00
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    // JSTの明後日の0:00
    const dayAfterTomorrowStart = new Date(tomorrowStart);
    dayAfterTomorrowStart.setUTCDate(dayAfterTomorrowStart.getUTCDate() + 1);

    return { todayStart, tomorrowStart, dayAfterTomorrowStart };
}

/**
 * 勤務前日リマインダー（ワーカー宛）
 */
async function sendWorkerDayBeforeReminders() {
    const { tomorrowStart, dayAfterTomorrowStart } = getJSTDates();

    // 明日が勤務日のSCHEDULED状態のApplicationを取得
    const applications = await prisma.application.findMany({
        where: {
            status: 'SCHEDULED',
            workDate: {
                work_date: {
                    gte: tomorrowStart,
                    lt: dayAfterTomorrowStart,
                },
            },
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            workDate: {
                include: {
                    job: {
                        include: {
                            facility: { select: { facility_name: true } },
                        },
                    },
                },
            },
        },
    });

    let sentCount = 0;
    for (const app of applications) {
        if (!app.user) continue;

        const workDateStr = app.workDate.work_date.toISOString().split('T')[0];
        const startTime = app.workDate.job.start_time || '';

        await sendNotification({
            notificationKey: 'WORKER_REMINDER_DAY_BEFORE',
            targetType: 'WORKER',
            recipientId: app.user.id,
            recipientName: app.user.name,
            recipientEmail: app.user.email,
            variables: {
                facility_name: app.workDate.job.facility.facility_name,
                work_date: workDateStr,
                start_time: startTime,
                job_title: app.workDate.job.title,
            },
        });
        sentCount++;
    }

    return sentCount;
}

/**
 * 勤務当日リマインダー（ワーカー宛）
 */
async function sendWorkerSameDayReminders() {
    const { todayStart, tomorrowStart } = getJSTDates();

    // 今日が勤務日のSCHEDULED状態のApplicationを取得
    const applications = await prisma.application.findMany({
        where: {
            status: 'SCHEDULED',
            workDate: {
                work_date: {
                    gte: todayStart,
                    lt: tomorrowStart,
                },
            },
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            workDate: {
                include: {
                    job: {
                        include: {
                            facility: {
                                select: {
                                    facility_name: true,
                                    address: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    let sentCount = 0;
    for (const app of applications) {
        if (!app.user) continue;

        const startTime = app.workDate.job.start_time || '';

        await sendNotification({
            notificationKey: 'WORKER_REMINDER_SAME_DAY',
            targetType: 'WORKER',
            recipientId: app.user.id,
            recipientName: app.user.name,
            recipientEmail: app.user.email,
            variables: {
                facility_name: app.workDate.job.facility.facility_name,
                start_time: startTime,
                address: app.workDate.job.facility.address || '',
                job_title: app.workDate.job.title,
            },
        });
        sentCount++;
    }

    return sentCount;
}

/**
 * 勤務前日リマインダー（施設宛）
 */
async function sendFacilityDayBeforeReminders() {
    const { tomorrowStart, dayAfterTomorrowStart } = getJSTDates();

    // 明日が勤務日で、採用確定済みのワーカーがいる求人を取得
    const workDates = await prisma.jobWorkDate.findMany({
        where: {
            work_date: {
                gte: tomorrowStart,
                lt: dayAfterTomorrowStart,
            },
            applications: {
                some: {
                    status: 'SCHEDULED',
                },
            },
        },
        include: {
            job: {
                include: {
                    facility: {
                        include: {
                            admins: {
                                select: { id: true, name: true, email: true },
                            },
                        },
                    },
                },
            },
            applications: {
                where: { status: 'SCHEDULED' },
                include: {
                    user: { select: { name: true } },
                },
            },
        },
    });

    let sentCount = 0;
    for (const wd of workDates) {
        const admins = wd.job.facility.admins;
        if (admins.length === 0) continue;

        const workerNames = wd.applications
            .map(app => app.user?.name || '不明')
            .join('、');

        const workDateStr = wd.work_date.toISOString().split('T')[0];
        const facilityEmails = admins.map(a => a.email);
        const primaryAdmin = admins[0];

        await sendNotification({
            notificationKey: 'FACILITY_REMINDER_DAY_BEFORE',
            targetType: 'FACILITY',
            recipientId: primaryAdmin.id,
            recipientName: primaryAdmin.name,
            facilityEmails,
            variables: {
                job_title: wd.job.title,
                work_date: workDateStr,
                worker_count: String(wd.applications.length),
                worker_names: workerNames,
            },
        });
        sentCount++;
    }

    return sentCount;
}

/**
 * レビュー催促リマインダー（ワーカー宛）
 * 勤務完了から3日以上経過してレビュー未完了の場合
 */
async function sendWorkerReviewReminders() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // COMPLETED_PENDINGでワーカーレビュー未完了のApplication
    const applications = await prisma.application.findMany({
        where: {
            status: 'COMPLETED_PENDING',
            worker_review_status: 'PENDING',
            updated_at: {
                lte: threeDaysAgo, // 3日以上前に更新（≒勤務完了から3日経過）
            },
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            workDate: {
                include: {
                    job: {
                        include: {
                            facility: { select: { facility_name: true } },
                        },
                    },
                },
            },
        },
    });

    let sentCount = 0;
    for (const app of applications) {
        if (!app.user) continue;

        await sendNotification({
            notificationKey: 'WORKER_REVIEW_REMINDER',
            targetType: 'WORKER',
            recipientId: app.user.id,
            recipientName: app.user.name,
            recipientEmail: app.user.email,
            variables: {
                facility_name: app.workDate.job.facility.facility_name,
                job_title: app.workDate.job.title,
                review_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.work'}/worker/applications/${app.id}/review`,
            },
        });
        sentCount++;
    }

    return sentCount;
}

/**
 * お気に入り求人の締切通知（ワーカー宛）
 * 募集締切が3日以内の求人があるワーカーに通知
 */
async function sendFavoriteDeadlineReminders() {
    const now = new Date();

    // お気に入りした求人（PUBLISHED状態）を取得
    const bookmarks = await prisma.bookmark.findMany({
        where: {
            target_job_id: { not: null },
            targetJob: {
                status: 'PUBLISHED',
            },
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            targetJob: {
                select: {
                    id: true,
                    title: true,
                    deadline_days_before: true,
                    facility: { select: { facility_name: true } },
                    workDates: {
                        orderBy: { work_date: 'asc' },
                        take: 1,
                        select: { work_date: true },
                    },
                },
            },
        },
    });

    let sentCount = 0;
    for (const bookmark of bookmarks) {
        if (!bookmark.user || !bookmark.targetJob) continue;

        const job = bookmark.targetJob;
        const firstWorkDate = job.workDates[0]?.work_date;
        if (!firstWorkDate) continue;

        // 締切日を計算（勤務日 - deadline_days_before）
        const deadline = new Date(firstWorkDate);
        deadline.setDate(deadline.getDate() - job.deadline_days_before);

        // 締切が過ぎている、または3日以上先なら通知しない
        const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDeadline < 0 || daysUntilDeadline > 3) continue;

        const deadlineStr = deadline.toISOString().split('T')[0];

        await sendNotification({
            notificationKey: 'WORKER_FAVORITE_DEADLINE',
            targetType: 'WORKER',
            recipientId: bookmark.user.id,
            recipientName: bookmark.user.name,
            recipientEmail: bookmark.user.email,
            variables: {
                job_title: job.title,
                facility_name: job.facility.facility_name,
                deadline: deadlineStr,
                job_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.work'}/jobs/${job.id}`,
            },
        });
        sentCount++;
    }

    return sentCount;
}

/**
 * 求人締切警告（施設宛）
 * 締切が3日以内なのに募集枠が埋まっていない求人の施設に通知
 */
async function sendFacilityDeadlineWarnings() {
    const now = new Date();

    // 公開中の求人で、募集枠が埋まっていないものを取得
    const jobs = await prisma.job.findMany({
        where: {
            status: 'PUBLISHED',
        },
        include: {
            facility: {
                include: {
                    admins: {
                        select: { id: true, name: true, email: true },
                    },
                },
            },
            workDates: {
                orderBy: { work_date: 'asc' },
                include: {
                    applications: {
                        where: {
                            status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
                        },
                    },
                },
            },
        },
    });

    let sentCount = 0;
    for (const job of jobs) {
        const firstWorkDate = job.workDates[0]?.work_date;
        if (!firstWorkDate) continue;

        // 締切日を計算（勤務日 - deadline_days_before）
        const deadline = new Date(firstWorkDate);
        deadline.setDate(deadline.getDate() - job.deadline_days_before);

        // 締切が過ぎている、または3日以上先なら通知しない
        const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDeadline < 0 || daysUntilDeadline > 3) continue;

        // 募集枠が埋まっているかチェック
        let hasUnfilledSlots = false;
        for (const wd of job.workDates) {
            if (wd.applications.length < wd.recruitment_count) {
                hasUnfilledSlots = true;
                break;
            }
        }

        if (!hasUnfilledSlots) continue; // 全て埋まっていれば通知不要

        const admins = job.facility.admins;
        if (admins.length === 0) continue;

        const deadlineStr = deadline.toISOString().split('T')[0];
        const facilityEmails = admins.map(a => a.email);
        const primaryAdmin = admins[0];

        // 残り枠数を計算
        const totalSlots = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);
        const filledSlots = job.workDates.reduce((sum, wd) => sum + wd.applications.length, 0);
        const remainingSlots = totalSlots - filledSlots;

        await sendNotification({
            notificationKey: 'FACILITY_DEADLINE_WARNING',
            targetType: 'FACILITY',
            recipientId: primaryAdmin.id,
            recipientName: primaryAdmin.name,
            facilityEmails,
            variables: {
                job_title: job.title,
                deadline: deadlineStr,
                remaining_slots: String(remainingSlots),
                job_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.work'}/admin/jobs/${job.id}`,
            },
        });
        sentCount++;
    }

    return sentCount;
}

export async function GET(request: NextRequest) {
    if (!verifyCronAuth(request)) {
        console.warn('[CRON-NOTIFY] Unauthorized cron request attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[CRON-NOTIFY] Starting notification cron job...');

        // 各リマインダーを並列実行
        const [
            workerDayBefore,
            workerSameDay,
            facilityDayBefore,
            workerReviewReminder,
            favoriteDeadline,
            facilityDeadlineWarning,
        ] = await Promise.all([
            sendWorkerDayBeforeReminders(),
            sendWorkerSameDayReminders(),
            sendFacilityDayBeforeReminders(),
            sendWorkerReviewReminders(),
            sendFavoriteDeadlineReminders(),
            sendFacilityDeadlineWarnings(),
        ]);

        const result = {
            success: true,
            sent: {
                workerDayBefore,
                workerSameDay,
                facilityDayBefore,
                workerReviewReminder,
                favoriteDeadline,
                facilityDeadlineWarning,
            },
            total:
                workerDayBefore +
                workerSameDay +
                facilityDayBefore +
                workerReviewReminder +
                favoriteDeadline +
                facilityDeadlineWarning,
        };

        console.log('[CRON-NOTIFY] Completed:', result);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[CRON-NOTIFY] Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
