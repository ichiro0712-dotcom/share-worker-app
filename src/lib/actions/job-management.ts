'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentTime } from '@/utils/debugTime';
import { setJSTHours } from '@/utils/debugTime.server';
import { sendNearbyJobNotifications } from '../notification-service';
import { CreateJobInput } from './helpers';
import { sendFavoriteNewJobNotification } from './notification';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';

/**
 * ローカル用の日付フォーマット関数 (M/D形式)
 */
function formatDate(date: Date): string {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 施設の求人一覧を取得する（ページネーション・フィルタリング対応）
 */
// ソートオプションの型定義
type JobSortOption =
    | 'created_desc'
    | 'created_asc'
    | 'applied_desc'
    | 'applied_asc'
    | 'wage_desc'
    | 'wage_asc'
    | 'workDate_asc';

export async function getFacilityJobs(
    facilityId: number,
    options: {
        page?: number;
        limit?: number;
        status?: string;
        query?: string;
        sort?: string;
    } = {}
) {
    const { page = 1, limit = 20, status, query, sort = 'created_desc' } = options;
    const skip = (page - 1) * limit;

    const whereConditions: any = {
        facility_id: facilityId,
    };

    // ステータスフィルタ
    if (status && status !== 'all') {
        if (status === 'recruiting') {
            whereConditions.status = 'PUBLISHED';
        } else if (status === 'paused') {
            whereConditions.status = 'STOPPED';
        } else {
            whereConditions.status = status;
        }
    }

    // 検索クエリ
    if (query) {
        whereConditions.title = {
            contains: query,
            mode: 'insensitive',
        };
    }

    // ソートの設定（applied_desc/applied_asc/workDate_ascは後処理が必要）
    const needsPostSort = sort === 'applied_desc' || sort === 'applied_asc' || sort === 'workDate_asc';

    // Prismaで直接ソートできるオプション
    let orderBy: any = { created_at: 'desc' }; // デフォルト
    switch (sort) {
        case 'created_asc':
            orderBy = { created_at: 'asc' };
            break;
        case 'wage_desc':
            orderBy = { hourly_wage: 'desc' };
            break;
        case 'wage_asc':
            orderBy = { hourly_wage: 'asc' };
            break;
        // applied_desc, applied_asc, workDate_ascは後処理
        default:
            orderBy = { created_at: 'desc' };
    }

    // applied系は全件取得して後処理、それ以外はページネーション適用
    const [totalCount, jobs] = await Promise.all([
        prisma.job.count({ where: whereConditions }),
        prisma.job.findMany({
            where: whereConditions,
            include: {
                workDates: {
                    orderBy: { work_date: 'asc' },
                },
                facility: true,
                template: true,
                targetWorker: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: needsPostSort ? { created_at: 'desc' } : orderBy,
            // 後処理が必要な場合は全件取得、それ以外はページネーション
            ...(needsPostSort ? {} : { skip, take: limit }),
        }),
    ]);

    const formattedJobs = jobs.map(job => {
        const totalApplied = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
        const totalMatched = job.workDates.reduce((sum, wd) => sum + wd.matched_count, 0);
        const totalRecruitment = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

        const today = getCurrentTime();
        const upcomingDates = job.workDates.filter(wd => new Date(wd.work_date) >= today);
        const nearestDate = upcomingDates[0] || job.workDates[0];

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
            workDates: job.workDates.map(wd => ({
                id: wd.id,
                date: wd.work_date.toISOString().split('T')[0],
                formattedDate: formatDate(wd.work_date),
                recruitmentCount: wd.recruitment_count,
                appliedCount: wd.applied_count,
                matchedCount: wd.matched_count,
                deadline: wd.deadline.toISOString(),
            })),
            totalWorkDates: job.workDates.length,
            totalApplied,
            totalMatched,
            totalRecruitment,
            nearestWorkDate: nearestDate ? formatDate(nearestDate.work_date) : null,
            dateRange: job.workDates.length > 1
                ? `${formatDate(job.workDates[0].work_date)} 〜 ${formatDate(job.workDates[job.workDates.length - 1].work_date)}`
                : nearestDate ? formatDate(nearestDate.work_date) : '',
            overview: job.overview,
            images: job.images,
            address: job.address,
            access: job.access,
            tags: job.tags,
            managerName: job.manager_name,
            managerMessage: job.manager_message,
            managerAvatar: job.manager_avatar,
            facilityName: job.facility.facility_name,
            dresscode: job.dresscode,
            dresscodeImages: job.dresscode_images,
            belongings: job.belongings,
            attachments: job.attachments,
            requiredExperience: job.required_experience,
            inexperiencedOk: job.inexperienced_ok,
            blankOk: job.blank_ok,
            hairStyleFree: job.hair_style_free,
            nailOk: job.nail_ok,
            uniformProvided: job.uniform_provided,
            allowCar: job.allow_car,
            mealSupport: job.meal_support,
            weeklyFrequency: job.weekly_frequency,
            wage: job.wage,
            transportationFee: job.transportation_fee,
            breakTime: job.break_time,
            templateId: job.template_id,
            templateName: job.template?.name || null,
            requiresInterview: job.requires_interview,
            targetWorkerId: job.target_worker_id,
            targetWorkerName: job.targetWorker?.name || null,
        };
    });

    // 後処理ソートが必要な場合
    let sortedJobs = formattedJobs;
    if (sort === 'applied_desc') {
        sortedJobs = [...formattedJobs].sort((a, b) => b.totalApplied - a.totalApplied);
    } else if (sort === 'applied_asc') {
        sortedJobs = [...formattedJobs].sort((a, b) => a.totalApplied - b.totalApplied);
    } else if (sort === 'workDate_asc') {
        // nearestWorkDateでソート（nullは最後に）
        sortedJobs = [...formattedJobs].sort((a, b) => {
            if (!a.nearestWorkDate && !b.nearestWorkDate) return 0;
            if (!a.nearestWorkDate) return 1;
            if (!b.nearestWorkDate) return -1;
            // M/D形式なので日付として比較するためにworkDatesを使用
            const aDate = a.workDates[0]?.date || '';
            const bDate = b.workDates[0]?.date || '';
            return aDate.localeCompare(bDate);
        });
    }

    // 後処理ソートの場合は手動でページネーション適用
    const paginatedJobs = needsPostSort
        ? sortedJobs.slice(skip, skip + limit)
        : sortedJobs;

    return {
        data: paginatedJobs,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasMore: skip + paginatedJobs.length < totalCount,
        },
    };
}

/**
 * 管理用: 全ての求人一覧を取得
 */
export async function getAdminJobsList(facilityId: number) {
    const jobs = await prisma.job.findMany({
        where: { facility_id: facilityId },
        include: {
            workDates: {
                orderBy: { work_date: 'asc' },
            },
            facility: true,
            template: true,
        },
        orderBy: { created_at: 'desc' },
    });

    return jobs.map(job => {
        const totalApplied = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
        const totalMatched = job.workDates.reduce((sum, wd) => sum + wd.matched_count, 0);
        const totalRecruitment = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

        const today = getCurrentTime();
        const upcomingDates = job.workDates.filter(wd => new Date(wd.work_date) >= today);
        const nearestDate = upcomingDates[0] || job.workDates[0];

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
            workDates: job.workDates.map(wd => ({
                id: wd.id,
                date: wd.work_date.toISOString().split('T')[0],
                formattedDate: formatDate(wd.work_date),
                recruitmentCount: wd.recruitment_count,
                appliedCount: wd.applied_count,
                matchedCount: wd.matched_count,
                deadline: wd.deadline.toISOString(),
            })),
            totalWorkDates: job.workDates.length,
            totalApplied: totalApplied,
            totalMatched: totalMatched,
            totalRecruitment: totalRecruitment,
            nearestWorkDate: nearestDate ? formatDate(nearestDate.work_date) : null,
            dateRange: job.workDates.length > 1
                ? `${formatDate(job.workDates[0].work_date)} 〜 ${formatDate(job.workDates[job.workDates.length - 1].work_date)}`
                : nearestDate ? formatDate(nearestDate.work_date) : '',
            overview: job.overview,
            images: job.images,
            address: job.address,
            access: job.access,
            tags: job.tags,
            managerName: job.manager_name,
            managerMessage: job.manager_message,
            managerAvatar: job.manager_avatar,
            facilityName: job.facility.facility_name,
            dresscode: job.dresscode,
            dresscodeImages: job.dresscode_images,
            belongings: job.belongings,
            attachments: job.attachments,
            requiredExperience: job.required_experience,
            inexperiencedOk: job.inexperienced_ok,
            blankOk: job.blank_ok,
            hairStyleFree: job.hair_style_free,
            nailOk: job.nail_ok,
            uniformProvided: job.uniform_provided,
            allowCar: job.allow_car,
            mealSupport: job.meal_support,
            weeklyFrequency: job.weekly_frequency,
            wage: job.wage,
            transportationFee: job.transportation_fee,
            breakTime: job.break_time,
            templateId: job.template_id,
            templateName: job.template?.name || null,
            requiresInterview: job.requires_interview,
        };
    });
}

/**
 * 求人を作成
 */
export async function createJobs(input: CreateJobInput) {
    console.log('[createJobs] Input:', JSON.stringify(input, null, 2));

    const facility = await prisma.facility.findUnique({
        where: { id: input.facilityId },
    });

    if (!facility) {
        return { success: false, error: '施設が見つかりません' };
    }

    const calculateWage = (startTime: string, endTime: string, breakMinutes: number, hourlyWage: number, transportFee: number) => {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const isNextDay = endTime.startsWith('翌');
        const endTimePart = isNextDay ? endTime.slice(1) : endTime;
        const [endHour, endMin] = endTimePart.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;

        if (isNextDay) {
            endMinutes += 24 * 60;
        }

        let totalMinutes = endMinutes - startMinutes;
        if (totalMinutes < 0) totalMinutes += 24 * 60;

        const workMinutes = totalMinutes - breakMinutes;
        const workHours = workMinutes / 60;

        return Math.floor(hourlyWage * workHours) + transportFee;
    };

    const wage = calculateWage(
        input.startTime,
        input.endTime,
        input.breakTime,
        input.hourlyWage,
        input.transportationFee
    );

    const breakTimeStr = `${input.breakTime}分`;

    const conditionFlags = {
        inexperienced_ok: input.icons.includes('未経験者歓迎'),
        blank_ok: input.icons.includes('ブランク歓迎'),
        hair_style_free: input.icons.includes('髪型・髪色自由'),
        nail_ok: input.icons.includes('ネイルOK'),
        uniform_provided: input.icons.includes('制服貸与'),
        allow_car: input.icons.includes('車通勤OK'),
        meal_support: input.icons.includes('食事補助'),
    };

    // 求人種別のマッピング（UIの値→DB enum）
    const jobTypeMap: Record<string, 'NORMAL' | 'ORIENTATION' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'OFFER'> = {
        'NORMAL': 'NORMAL',
        'ORIENTATION': 'ORIENTATION',
        'LIMITED_WORKED': 'LIMITED_WORKED',
        'LIMITED_FAVORITE': 'LIMITED_FAVORITE',
        'OFFER': 'OFFER',
    };
    const dbJobType = jobTypeMap[input.jobType || 'NORMAL'] || 'NORMAL';

    // オファー重複チェック（同一ワーカー × 同一勤務日 × 同一施設 × アクティブなオファー）
    if (dbJobType === 'OFFER' && input.targetWorkerId && input.workDates.length > 0) {
        // 指定された勤務日でアクティブなオファーが既にあるかチェック
        const existingOffers = await prisma.job.findMany({
            where: {
                facility_id: input.facilityId,
                target_worker_id: input.targetWorkerId,
                job_type: 'OFFER',
                status: { in: ['DRAFT', 'PUBLISHED'] }, // アクティブなオファーのみ
            },
            include: {
                workDates: {
                    select: { work_date: true },
                },
            },
        });

        // 既存オファーの勤務日を収集
        const existingWorkDates = new Set<string>();
        for (const offer of existingOffers) {
            for (const wd of offer.workDates) {
                // 日付を YYYY-MM-DD 形式で保存
                existingWorkDates.add(wd.work_date.toISOString().split('T')[0]);
            }
        }

        // 新規オファーの勤務日と重複チェック
        const duplicateDates: string[] = [];
        for (const dateStr of input.workDates) {
            const normalizedDate = new Date(dateStr).toISOString().split('T')[0];
            if (existingWorkDates.has(normalizedDate)) {
                duplicateDates.push(dateStr);
            }
        }

        if (duplicateDates.length > 0) {
            const formattedDates = duplicateDates.map(d => {
                const date = new Date(d);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            }).join(', ');
            return {
                success: false,
                error: `このワーカーには既に ${formattedDates} のオファーが送信済みです。同じ日程のオファーを重複して送ることはできません。`,
            };
        }
    }

    // オファー・説明会の場合は審査なしに固定
    const requiresInterview = (dbJobType === 'OFFER' || dbJobType === 'ORIENTATION')
        ? false
        : (input.requiresInterview || false);

    const job = await prisma.job.create({
        data: {
            facility_id: input.facilityId,
            template_id: input.templateId ?? null,
            status: 'PUBLISHED',
            job_type: dbJobType,
            title: input.title,
            start_time: input.startTime,
            end_time: input.endTime,
            break_time: breakTimeStr,
            wage: wage,
            hourly_wage: input.hourlyWage,
            transportation_fee: input.transportationFee,
            deadline_days_before: input.recruitmentEndDay || 1,
            recruitment_start_day: input.recruitmentStartDay,
            recruitment_start_time: input.recruitmentStartTime || null,
            tags: input.icons,
            address: (input.prefecture && input.city && input.addressLine)
                ? `${input.prefecture}${input.city}${input.addressLine}`
                : (input.address || facility.address || ''),
            // @ts-ignore
            prefecture: input.prefecture || (facility as any).prefecture,
            city: input.city || (facility as any).city,
            address_line: input.addressLine || (facility as any).address_line,
            access: '施設へのアクセス情報',
            recruitment_count: input.recruitmentCount,
            overview: input.jobDescription,
            work_content: input.workContent,
            required_qualifications: input.qualifications,
            required_experience: input.skills,
            dresscode: input.dresscode,
            belongings: input.belongings,
            manager_name: facility.staff_last_name && facility.staff_first_name
                ? `${facility.staff_last_name} ${facility.staff_first_name}`
                : '担当者',
            manager_avatar: facility.staff_photo || null,
            manager_message: facility.staff_greeting || null,
            images: input.images && input.images.length > 0 ? input.images : (facility.images || []),
            dresscode_images: input.dresscodeImages || [],
            attachments: input.attachments || [],
            ...conditionFlags,
            weekly_frequency: input.weeklyFrequency || null,
            requires_interview: requiresInterview,
            // 限定求人用
            switch_to_normal_days_before: input.switchToNormalDaysBefore ?? null,
            // オファー用
            target_worker_id: input.targetWorkerId ?? null,
            offer_message: input.offerMessage ?? null,
        },
    });

    const workDates = input.workDates.map(dateStr => {
        const workDate = new Date(dateStr);

        // 締切日時を計算（JST）
        let deadline: Date;
        if (input.recruitmentEndDay === 0) {
            if (input.recruitmentEndTime) {
                const [h, m] = input.recruitmentEndTime.split(':').map(Number);
                deadline = setJSTHours(new Date(workDate), h, m);
            } else {
                deadline = setJSTHours(new Date(workDate), 5);
            }
        } else {
            const deadlineBase = new Date(workDate);
            deadlineBase.setDate(deadlineBase.getDate() - (input.recruitmentEndDay || 1));
            deadline = setJSTHours(deadlineBase, 23, 59, 59);
        }

        // 表示終了日時を計算（JST）：勤務開始時刻の2時間前
        const [startHour, startMin] = input.startTime.split(':').map(Number);
        const visibleUntil = setJSTHours(new Date(workDate), startHour - 2, startMin);

        // 募集開始日時を計算
        let visibleFrom: Date | null = null;
        if (input.recruitmentStartDay === 0) {
            // 「公開時」= 即公開（visible_from = null または 現在時刻）
            visibleFrom = null;
        } else if (input.recruitmentStartDay === -1) {
            // 「勤務当日」= 勤務日の0時（JST）
            visibleFrom = setJSTHours(new Date(workDate), 0);
        } else {
            // 「勤務N日前」= 勤務日 - N日 + 指定時刻（JST）
            const baseDate = new Date(workDate);
            baseDate.setDate(baseDate.getDate() + input.recruitmentStartDay); // recruitmentStartDayは負の値
            if (input.recruitmentStartTime) {
                const [h, m] = input.recruitmentStartTime.split(':').map(Number);
                visibleFrom = setJSTHours(baseDate, h, m);
            } else {
                visibleFrom = setJSTHours(baseDate, 0);
            }
        }

        return {
            job_id: job.id,
            work_date: workDate,
            deadline: deadline,
            recruitment_count: input.recruitmentCount,
            applied_count: 0,
            visible_from: visibleFrom,
            visible_until: visibleUntil,
        };
    });

    await prisma.jobWorkDate.createMany({
        data: workDates,
    });

    // オファータイプの場合は対象ワーカーへメッセージを送信
    if (dbJobType === 'OFFER' && input.targetWorkerId) {
        try {
            // メッセージスレッドを取得または作成
            let thread = await prisma.messageThread.findUnique({
                where: {
                    worker_id_facility_id: {
                        worker_id: input.targetWorkerId,
                        facility_id: input.facilityId,
                    },
                },
            });

            if (!thread) {
                thread = await prisma.messageThread.create({
                    data: {
                        worker_id: input.targetWorkerId,
                        facility_id: input.facilityId,
                        last_message_at: new Date(),
                    },
                });
            }

            // 勤務日情報を取得してメッセージを作成
            const workDateStr = input.workDates.map(d => {
                const date = new Date(d);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            }).join(', ');

            // オファーメッセージを作成
            const jobDetailUrl = `/jobs/${job.id}`;
            const offerMessageContent = input.offerMessage
                ? `【オファーのお知らせ】\n\n${input.offerMessage}\n\n【求人情報】\n・タイトル: ${input.title}\n・勤務日: ${workDateStr}\n・勤務時間: ${input.startTime}〜${input.endTime}\n・日給: ${wage.toLocaleString()}円\n\n▼ 求人詳細を見る\n${jobDetailUrl}\n\n※この求人はあなただけに送られた特別なオファーです。`
                : `【オファーのお知らせ】\n\nお仕事のオファーをお送りします。\n\n【求人情報】\n・タイトル: ${input.title}\n・勤務日: ${workDateStr}\n・勤務時間: ${input.startTime}〜${input.endTime}\n・日給: ${wage.toLocaleString()}円\n\n▼ 求人詳細を見る\n${jobDetailUrl}\n\n※この求人はあなただけに送られた特別なオファーです。`;

            await prisma.message.create({
                data: {
                    thread_id: thread.id,
                    from_facility_id: input.facilityId,
                    to_user_id: input.targetWorkerId,
                    job_id: job.id,
                    content: offerMessageContent,
                },
            });

            // スレッドの最終メッセージ日時を更新
            await prisma.messageThread.update({
                where: { id: thread.id },
                data: { last_message_at: new Date() },
            });

            console.log('[createJobs] Offer message sent to worker:', input.targetWorkerId);
        } catch (e) {
            console.error('[createJobs] Failed to send offer message:', e);
            // オファーメッセージの送信失敗は求人作成自体を失敗させない
        }
    } else {
        // 通常の求人の場合は近くのワーカーに通知
        sendNearbyJobNotifications(job.id, 'WORKER_NEARBY_NEW_JOB')
            .catch(e => console.error('[createJobs] Nearby notification error:', e));
    }

    // 通常求人・説明会の場合、お気に入りワーカーに通知
    if (dbJobType === 'NORMAL' || dbJobType === 'ORIENTATION') {
        sendFavoriteNewJobNotification(input.facilityId, facility.facility_name, job.id)
            .catch(e => console.error('[createJobs] Favorite notification error:', e));
    }

    // 求人作成をログ記録
    logActivity({
        userType: 'FACILITY',
        action: 'JOB_CREATE',
        targetType: 'Job',
        targetId: job.id,
        requestData: {
            facilityId: input.facilityId,
            title: input.title,
            jobType: dbJobType,
            workDatesCount: input.workDates.length,
            recruitmentCount: input.recruitmentCount,
            hourlyWage: input.hourlyWage,
            targetWorkerId: input.targetWorkerId,
        },
        result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, jobId: job.id };
}

/**
 * 求人を削除
 */
export async function deleteJobs(jobIds: number[], facilityId: number): Promise<{ success: boolean; message: string; deletedCount?: number }> {
    try {
        // オファー求人の場合はワーカーへ通知が必要なので、詳細情報も取得
        const jobsToDelete = await prisma.job.findMany({
            where: {
                id: { in: jobIds },
                facility_id: facilityId,
            },
            select: {
                id: true,
                job_type: true,
                target_worker_id: true,
                title: true,
            },
        });

        if (jobsToDelete.length === 0) {
            return { success: false, message: '削除対象の求人が見つかりません' };
        }

        // オファー求人の場合、削除前にワーカーへ通知メッセージを送信
        for (const job of jobsToDelete) {
            if (job.job_type === 'OFFER' && job.target_worker_id) {
                try {
                    // メッセージスレッドを取得
                    const thread = await prisma.messageThread.findUnique({
                        where: {
                            worker_id_facility_id: {
                                worker_id: job.target_worker_id,
                                facility_id: facilityId,
                            },
                        },
                    });

                    if (thread) {
                        // オファー取り消しメッセージを送信
                        await prisma.message.create({
                            data: {
                                thread_id: thread.id,
                                from_facility_id: facilityId,
                                to_user_id: job.target_worker_id,
                                content: `【オファー取り消しのお知らせ】\n\n「${job.title}」のオファーは施設側の都合により取り消されました。\n\nご不明な点がございましたら、お気軽にメッセージでお問い合わせください。`,
                            },
                        });

                        // スレッドの最終メッセージ日時を更新
                        await prisma.messageThread.update({
                            where: { id: thread.id },
                            data: { last_message_at: new Date() },
                        });
                    }
                } catch (e) {
                    console.error('[deleteJobs] Failed to send offer cancellation message:', e);
                    // メッセージ送信失敗は削除処理自体を失敗させない
                }
            }
        }

        const validJobIds = jobsToDelete.map(j => j.id);

        const result = await prisma.job.deleteMany({
            where: { id: { in: validJobIds } },
        });

        revalidatePath('/admin/jobs');

        // 求人削除をログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'JOB_DELETE',
            requestData: {
                facilityId,
                jobIds: validJobIds,
                deletedCount: result.count,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            message: `${result.count}件の求人を削除しました`,
            deletedCount: result.count,
        };
    } catch (error) {
        console.error('[deleteJobs] Error:', error);

        logActivity({
            userType: 'FACILITY',
            action: 'JOB_DELETE',
            requestData: { facilityId, jobIds },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, message: '求人の削除に失敗しました' };
    }
}

/**
 * 求人のステータスを一括更新
 */
export async function updateJobsStatus(
    jobIds: number[],
    facilityId: number,
    status: 'PUBLISHED' | 'STOPPED'
): Promise<{ success: boolean; message: string; updatedCount?: number }> {
    try {
        // オファー求人の場合は詳細情報も取得（停止時に通知が必要）
        const jobsToUpdate = await prisma.job.findMany({
            where: {
                id: { in: jobIds },
                facility_id: facilityId,
            },
            select: {
                id: true,
                job_type: true,
                target_worker_id: true,
                title: true,
            },
        });

        if (jobsToUpdate.length === 0) {
            return { success: false, message: '更新対象の求人が見つかりません' };
        }

        const validJobIds = jobsToUpdate.map(j => j.id);

        const result = await prisma.job.updateMany({
            where: { id: { in: validJobIds } },
            data: { status },
        });

        revalidatePath('/admin/jobs');

        if (status === 'PUBLISHED') {
            validJobIds.forEach(jobId => {
                sendNearbyJobNotifications(jobId, 'WORKER_NEARBY_NEW_JOB')
                    .catch(e => console.error(`[updateJobsStatus] Nearby notification error (Job: ${jobId}):`, e));
            });
        } else if (status === 'STOPPED') {
            // オファー求人を停止した場合、ワーカーへ通知メッセージを送信
            for (const job of jobsToUpdate) {
                if (job.job_type === 'OFFER' && job.target_worker_id) {
                    try {
                        const thread = await prisma.messageThread.findUnique({
                            where: {
                                worker_id_facility_id: {
                                    worker_id: job.target_worker_id,
                                    facility_id: facilityId,
                                },
                            },
                        });

                        if (thread) {
                            await prisma.message.create({
                                data: {
                                    thread_id: thread.id,
                                    from_facility_id: facilityId,
                                    to_user_id: job.target_worker_id,
                                    content: `【オファー取り消しのお知らせ】\n\n「${job.title}」のオファーは施設側の都合により取り消されました。\n\nご不明な点がございましたら、お気軽にメッセージでお問い合わせください。`,
                                },
                            });

                            await prisma.messageThread.update({
                                where: { id: thread.id },
                                data: { last_message_at: new Date() },
                            });
                        }
                    } catch (e) {
                        console.error('[updateJobsStatus] Failed to send offer cancellation message:', e);
                    }
                }
            }
        }

        const statusLabel = status === 'PUBLISHED' ? '公開' : '停止';

        // 求人ステータス更新をログ記録
        const action = status === 'PUBLISHED' ? 'JOB_PUBLISH' : 'JOB_STOP';
        logActivity({
            userType: 'FACILITY',
            action,
            requestData: {
                facilityId,
                jobIds: validJobIds,
                status,
                updatedCount: result.count,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            message: `${result.count}件の求人を${statusLabel}しました`,
            updatedCount: result.count,
        };
    } catch (error) {
        console.error('[updateJobsStatus] Error:', error);

        logActivity({
            userType: 'FACILITY',
            action: status === 'PUBLISHED' ? 'JOB_PUBLISH' : 'JOB_STOP',
            requestData: { facilityId, jobIds, status },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, message: '求人のステータス更新に失敗しました' };
    }
}

/**
 * 求人を更新
 */
export async function updateJob(
    jobId: number,
    facilityId: number,
    data: {
        title: string;
        startTime: string;
        endTime: string;
        breakTime: number;
        hourlyWage: number;
        transportationFee: number;
        recruitmentCount: number;
        workContent: string[];
        jobDescription: string;
        qualifications: string[];
        skills?: string[];
        dresscode?: string[];
        belongings?: string[];
        icons?: string[];
        images?: string[];
        dresscodeImages?: string[];
        attachments?: string[];
        addWorkDates?: string[];
        removeWorkDateIds?: number[];
        requiresInterview?: boolean;
        prefecture?: string;
        city?: string;
        addressLine?: string;
        address?: string;
        weeklyFrequency?: number | null;
        recruitmentStartDay?: number;
        recruitmentStartTime?: string;
        recruitmentEndDay?: number;
        recruitmentEndTime?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const existingJob = await prisma.job.findFirst({
            where: { id: jobId, facility_id: facilityId },
            include: { workDates: true },
        });

        if (!existingJob) {
            return { success: false, error: '求人が見つかりません' };
        }

        const breakTimeMinutes = data.breakTime;

        const calculateWage = (startTime: string, endTime: string, breakMinutes: number, hourlyWage: number, transportFee: number) => {
            const [startHour, startMin] = startTime.split(':').map(Number);
            const isNextDay = endTime.startsWith('翌');
            const endTimePart = isNextDay ? endTime.slice(1) : endTime;
            const [endHour, endMin] = endTimePart.split(':').map(Number);

            let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
            if (isNextDay || totalMinutes < 0) totalMinutes += 24 * 60;

            const workMinutes = totalMinutes - breakMinutes;
            const workHours = workMinutes / 60;

            return Math.floor(hourlyWage * workHours) + transportFee;
        };

        const wage = calculateWage(
            data.startTime,
            data.endTime,
            breakTimeMinutes,
            data.hourlyWage,
            data.transportationFee
        );

        await prisma.job.update({
            where: { id: jobId },
            data: {
                title: data.title,
                start_time: data.startTime,
                end_time: data.endTime,
                break_time: `${breakTimeMinutes}分`,
                hourly_wage: data.hourlyWage,
                transportation_fee: data.transportationFee,
                wage: wage,
                recruitment_count: data.recruitmentCount,
                work_content: data.workContent,
                overview: data.jobDescription,
                required_qualifications: data.qualifications,
                required_experience: data.skills || [],
                dresscode: data.dresscode || [],
                belongings: data.belongings || [],
                tags: data.icons || [],
                images: data.images || [],
                dresscode_images: data.dresscodeImages || [],
                attachments: data.attachments || [],
                ...(data.requiresInterview !== undefined && { requires_interview: data.requiresInterview }),
                ...(data.prefecture !== undefined && { prefecture: data.prefecture }),
                ...(data.city !== undefined && { city: data.city }),
                ...(data.addressLine !== undefined && { address_line: data.addressLine }),
                ...(data.address !== undefined && { address: data.address }),
                ...(data.weeklyFrequency !== undefined && { weekly_frequency: data.weeklyFrequency }),
                ...(data.recruitmentStartDay !== undefined && { recruitment_start_day: data.recruitmentStartDay }),
                ...(data.recruitmentStartTime !== undefined && { recruitment_start_time: data.recruitmentStartTime || null }),
                ...((data.prefecture && data.city && data.addressLine) && {
                    address: `${data.prefecture}${data.city}${data.addressLine}`
                }),
                updated_at: new Date(),
            },
        });

        await prisma.jobWorkDate.updateMany({
            where: { job_id: jobId },
            data: { recruitment_count: data.recruitmentCount },
        });

        if (data.addWorkDates && data.addWorkDates.length > 0) {
            const newWorkDates = data.addWorkDates.map(dateStr => {
                const workDate = new Date(dateStr);

                // 締切日時を計算（JST）：前日の23:59:59
                const deadlineBase = new Date(workDate);
                deadlineBase.setDate(deadlineBase.getDate() - 1);
                const deadline = setJSTHours(deadlineBase, 23, 59, 59);

                // 表示終了日時を計算（JST）：勤務開始時刻の2時間前
                const [startHour, startMin] = data.startTime.split(':').map(Number);
                const visibleUntil = setJSTHours(new Date(workDate), startHour - 2, startMin);

                // 募集開始日時を計算
                let visibleFrom: Date | null = null;
                const recruitmentStartDay = data.recruitmentStartDay ?? 0;
                if (recruitmentStartDay === 0) {
                    // 「公開時」= 即公開
                    visibleFrom = null;
                } else if (recruitmentStartDay === -1) {
                    // 「勤務当日」= 勤務日の0時（JST）
                    visibleFrom = setJSTHours(new Date(workDate), 0);
                } else {
                    // 「勤務N日前」= 勤務日 - N日 + 指定時刻（JST）
                    const baseDate = new Date(workDate);
                    baseDate.setDate(baseDate.getDate() + recruitmentStartDay);
                    if (data.recruitmentStartTime) {
                        const [h, m] = data.recruitmentStartTime.split(':').map(Number);
                        visibleFrom = setJSTHours(baseDate, h, m);
                    } else {
                        visibleFrom = setJSTHours(baseDate, 0);
                    }
                }

                return {
                    job_id: jobId,
                    work_date: workDate,
                    deadline: deadline,
                    recruitment_count: data.recruitmentCount,
                    applied_count: 0,
                    visible_until: visibleUntil,
                    visible_from: visibleFrom,
                };
            });

            await prisma.jobWorkDate.createMany({
                data: newWorkDates,
                skipDuplicates: true,
            });
        }

        // 開始時刻または募集開始日時が変更された場合、既存の勤務日を更新
        const shouldUpdateVisibility =
            existingJob.start_time !== data.startTime ||
            data.recruitmentStartDay !== undefined;

        if (shouldUpdateVisibility) {
            const workDatesToUpdate = existingJob.workDates;

            await Promise.all(workDatesToUpdate.map(async (wd) => {
                const updateData: { visible_until?: Date; visible_from?: Date | null } = {};

                // 開始時刻変更時はvisible_untilを再計算（JST）
                if (existingJob.start_time !== data.startTime) {
                    const [startHour, startMin] = data.startTime.split(':').map(Number);
                    updateData.visible_until = setJSTHours(new Date(wd.work_date), startHour - 2, startMin);
                }

                // 募集開始日時が指定されている場合はvisible_fromを再計算
                if (data.recruitmentStartDay !== undefined) {
                    const recruitmentStartDay = data.recruitmentStartDay;
                    if (recruitmentStartDay === 0) {
                        // 「公開時」= 即公開
                        updateData.visible_from = null;
                    } else if (recruitmentStartDay === -1) {
                        // 「勤務当日」= 勤務日の0時（JST）
                        updateData.visible_from = setJSTHours(new Date(wd.work_date), 0);
                    } else {
                        // 「勤務N日前」= 勤務日 - N日 + 指定時刻（JST）
                        const baseDate = new Date(wd.work_date);
                        baseDate.setDate(baseDate.getDate() + recruitmentStartDay);
                        if (data.recruitmentStartTime) {
                            const [h, m] = data.recruitmentStartTime.split(':').map(Number);
                            updateData.visible_from = setJSTHours(baseDate, h, m);
                        } else {
                            updateData.visible_from = setJSTHours(baseDate, 0);
                        }
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    return prisma.jobWorkDate.update({
                        where: { id: wd.id },
                        data: updateData
                    });
                }
            }));
        }

        if (data.removeWorkDateIds && data.removeWorkDateIds.length > 0) {
            await prisma.jobWorkDate.deleteMany({
                where: {
                    id: { in: data.removeWorkDateIds },
                    job_id: jobId,
                    applied_count: 0,
                },
            });
        }

        revalidatePath('/admin/jobs');
        revalidateTag(`job-${jobId}`);

        // 求人更新をログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'JOB_UPDATE',
            targetType: 'Job',
            targetId: jobId,
            requestData: {
                facilityId,
                title: data.title,
                hourlyWage: data.hourlyWage,
                recruitmentCount: data.recruitmentCount,
                addWorkDatesCount: data.addWorkDates?.length || 0,
                removeWorkDateIdsCount: data.removeWorkDateIds?.length || 0,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true };
    } catch (error) {
        console.error('[updateJob] Error:', error);

        logActivity({
            userType: 'FACILITY',
            action: 'JOB_UPDATE',
            targetType: 'Job',
            targetId: jobId,
            requestData: { facilityId, title: data.title },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: '求人の更新に失敗しました' };
    }
}

/**
 * 限定求人の対象者数を取得
 * - 勤務済みワーカー数: この施設でCOMPLETED_RATEDステータスの応募があるワーカーのユニーク数
 * - お気に入りワーカー数: この施設がFAVORITEとしてブックマークしているワーカーのユニーク数
 */
export async function getLimitedJobTargetCounts(facilityId: number): Promise<{
    workedCount: number;
    favoriteCount: number;
}> {
    try {
        // 並列でクエリを実行
        const [workedWorkers, favoriteCount] = await Promise.all([
            // 勤務済みワーカー数: COMPLETED_RATED のアプリケーションを持つユニークなワーカー数
            prisma.application.findMany({
                where: {
                    status: 'COMPLETED_RATED',
                    workDate: {
                        job: {
                            facility_id: facilityId,
                        },
                    },
                },
                select: {
                    user_id: true,
                },
                distinct: ['user_id'],
            }),
            // お気に入りワーカー数: この施設がFAVORITEとしてブックマークしているワーカー数
            prisma.bookmark.count({
                where: {
                    facility_id: facilityId,
                    target_user_id: { not: null },
                    type: 'FAVORITE',
                },
            }),
        ]);

        return {
            workedCount: workedWorkers.length,
            favoriteCount: favoriteCount,
        };
    } catch (error) {
        console.error('[getLimitedJobTargetCounts] Error:', error);
        return {
            workedCount: 0,
            favoriteCount: 0,
        };
    }
}
