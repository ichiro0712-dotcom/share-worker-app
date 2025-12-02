import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const now = new Date();
        // JSTで時間を取得するために、UTC時間に9時間を足す
        // ただし、サーバーのタイムゾーン設定に依存するため、Dateオブジェクトをそのまま使うのが安全
        // ここでは単純に現在時刻を使用

        const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        console.log('Current time for status update:', currentTime);

        // 1. SCHEDULED → WORKING（開始時刻を過ぎた）
        // 勤務日が今日以前、かつ開始時刻が現在時刻以前
        const scheduledToWorking = await prisma.application.updateMany({
            where: {
                status: 'SCHEDULED',
                workDate: {
                    work_date: {
                        lte: now, // 勤務日が今日以前（時間部分は00:00:00想定だが、念のためlte now）
                    },
                    job: {
                        start_time: {
                            lte: currentTime, // 開始時刻が現在時刻以前
                        },
                    },
                },
            },
            data: {
                status: 'WORKING',
            },
        });

        // 2. WORKING → COMPLETED_RATED（終了時刻を過ぎた + 双方のレビュー完了）
        // 条件: 勤務日が今日以前、かつ終了時刻が現在時刻以前、かつ双方のレビューが完了
        const workingToCompleted = await prisma.application.updateMany({
            where: {
                status: 'WORKING',
                worker_review_status: 'COMPLETED',
                facility_review_status: 'COMPLETED',
                workDate: {
                    work_date: {
                        lte: now,
                    },
                    job: {
                        end_time: {
                            lte: currentTime,
                        },
                    },
                },
            },
            data: {
                status: 'COMPLETED_RATED',
            },
        });

        // 3. Job ステータスも更新（PUBLISHED → WORKING）
        // 勤務中の求人: 少なくとも1つのApplicationがWORKINGになっている求人
        // または、勤務日時が現在進行中の求人
        // 簡易的に、ApplicationがWORKINGになった求人をWORKINGにする
        // ※ 正確には、求人のステータス管理はもう少し複雑かもしれないが、要望に従い実装

        // WORKINGのApplicationを持つ求人を更新
        // updateManyではrelationを使ったフィルタリングが制限されることがあるため、
        // 一度IDを取得してから更新するのが確実

        const workingApplicationJobIds = await prisma.application.findMany({
            where: { status: 'WORKING' },
            select: {
                workDate: {
                    select: { job_id: true }
                }
            },
            distinct: ['work_date_id'] // workDateId単位でユニークにすれば十分（job_idはworkDate経由）
        });

        // @ts-ignore: workDate is selected but TS might be confused
        const jobIdsToWorking = workingApplicationJobIds.map(app => app.workDate?.job_id).filter(id => id !== undefined);

        if (jobIdsToWorking.length > 0) {
            await prisma.job.updateMany({
                where: {
                    id: { in: jobIdsToWorking },
                    status: 'PUBLISHED',
                },
                data: {
                    status: 'WORKING',
                },
            });
        }

        // 4. Job ステータス更新（WORKING → COMPLETED）
        // 全ての勤務日が終了した求人など、条件が複雑なため今回はスキップ（要望通り）

        return NextResponse.json({
            success: true,
            updated: {
                scheduledToWorking: scheduledToWorking.count,
                workingToCompleted: workingToCompleted.count,
            },
        });
    } catch (error) {
        console.error('Status update error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
