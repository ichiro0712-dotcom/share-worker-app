import { prisma } from './prisma';

/**
 * 求人の勤務期間を取得する（最初の勤務日と最後の勤務日）
 */
export async function getWorkerJobPeriod(jobId: number, userId: number) {
    const applications = await prisma.application.findMany({
        where: {
            user_id: userId,
            workDate: {
                job_id: jobId,
            },
            status: {
                in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
            },
        },
        include: {
            workDate: true,
        },
        orderBy: {
            workDate: {
                work_date: 'asc',
            },
        },
    });

    if (applications.length === 0) {
        return null;
    }

    const firstWorkDate = applications[0].workDate.work_date;
    const lastWorkDate = applications[applications.length - 1].workDate.work_date;

    return {
        start: firstWorkDate,
        end: lastWorkDate,
        workDates: applications.map(app => app.workDate.work_date),
    };
}

/**
 * レビュー可能かどうかを判定する
 * 勤務初日以降であればレビュー可能
 */
export async function canReview(jobId: number, userId: number): Promise<boolean> {
    const period = await getWorkerJobPeriod(jobId, userId);
    if (!period) return false;

    const today = new Date();
    // 勤務初日の0:00以降ならレビュー可能
    const startDate = new Date(period.start);
    startDate.setHours(0, 0, 0, 0);

    return today >= startDate;
}

/**
 * レビューが未完了かつ、最終勤務日を過ぎているかどうか（督促用）
 */
export async function isReviewPending(jobId: number, userId: number, reviewerType: 'FACILITY' | 'WORKER'): Promise<boolean> {
    // 既にレビュー済みかチェック
    const existingReview = await prisma.review.findFirst({
        where: {
            job_id: jobId,
            user_id: userId,
            reviewer_type: reviewerType,
        },
    });

    if (existingReview) return false;

    const period = await getWorkerJobPeriod(jobId, userId);
    if (!period) return false;

    const today = new Date();
    const endDate = new Date(period.end);
    // 最終勤務日の翌日以降なら督促対象
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(0, 0, 0, 0);

    return today >= endDate;
}
