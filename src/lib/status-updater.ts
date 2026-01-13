import { prisma } from '@/lib/prisma';

/**
 * アプリケーションのステータスをリアルタイムで更新
 * - SCHEDULED → WORKING: 勤務開始時刻を過ぎた場合
 * - WORKING → COMPLETED_RATED: 勤務終了 + 双方レビュー完了
 *
 * @param options.userId - ワーカーIDで絞り込み（ワーカー側で使用）
 * @param options.facilityId - 施設IDで絞り込み（施設側で使用）
 */
export async function updateApplicationStatuses(options?: {
    userId?: number;
    facilityId?: number;
}): Promise<{ scheduledToWorking: number; workingToCompleted: number }> {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // ベースのwhere条件
    const baseWhereScheduled: Record<string, unknown> = {
        status: 'SCHEDULED',
        workDate: {
            work_date: { lte: now },
            job: {
                start_time: { lte: currentTime },
            },
        },
    };

    const baseWhereWorking: Record<string, unknown> = {
        status: 'WORKING',
        worker_review_status: 'COMPLETED',
        facility_review_status: 'COMPLETED',
        workDate: {
            work_date: { lte: now },
            job: {
                end_time: { lte: currentTime },
            },
        },
    };

    // ユーザーIDまたは施設IDで絞り込み
    if (options?.userId) {
        baseWhereScheduled.user_id = options.userId;
        baseWhereWorking.user_id = options.userId;
    }

    if (options?.facilityId) {
        baseWhereScheduled.workDate = {
            ...(baseWhereScheduled.workDate as object),
            job: {
                ...((baseWhereScheduled.workDate as { job: object }).job),
                facility_id: options.facilityId,
            },
        };
        baseWhereWorking.workDate = {
            ...(baseWhereWorking.workDate as object),
            job: {
                ...((baseWhereWorking.workDate as { job: object }).job),
                facility_id: options.facilityId,
            },
        };
    }

    // 1. SCHEDULED → WORKING
    const scheduledToWorking = await prisma.application.updateMany({
        where: baseWhereScheduled as Parameters<typeof prisma.application.updateMany>[0]['where'],
        data: { status: 'WORKING' },
    });

    // 2. WORKING → COMPLETED_RATED
    const workingToCompleted = await prisma.application.updateMany({
        where: baseWhereWorking as Parameters<typeof prisma.application.updateMany>[0]['where'],
        data: { status: 'COMPLETED_RATED' },
    });

    // ログ出力（デバッグ用）
    if (scheduledToWorking.count > 0 || workingToCompleted.count > 0) {
        console.log('[STATUS-UPDATER] Updated:', {
            userId: options?.userId,
            facilityId: options?.facilityId,
            scheduledToWorking: scheduledToWorking.count,
            workingToCompleted: workingToCompleted.count,
        });
    }

    return {
        scheduledToWorking: scheduledToWorking.count,
        workingToCompleted: workingToCompleted.count,
    };
}
