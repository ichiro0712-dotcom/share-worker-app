'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentTime } from '@/utils/debugTime';
import { sendNearbyJobNotifications } from '../notification-service';
import { CreateJobInput } from './helpers';

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
export async function getFacilityJobs(
    facilityId: number,
    options: {
        page?: number;
        limit?: number;
        status?: string;
        query?: string;
    } = {}
) {
    const { page = 1, limit = 20, status, query } = options;
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
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
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
        };
    });

    return {
        data: formattedJobs,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasMore: skip + formattedJobs.length < totalCount,
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

    const job = await prisma.job.create({
        data: {
            facility: { connect: { id: input.facilityId } },
            ...(input.templateId ? { template: { connect: { id: input.templateId } } } : {}),
            status: 'PUBLISHED',
            title: input.title,
            start_time: input.startTime,
            end_time: input.endTime,
            break_time: breakTimeStr,
            wage: wage,
            hourly_wage: input.hourlyWage,
            transportation_fee: input.transportationFee,
            deadline_days_before: input.recruitmentEndDay || 1,
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
            requires_interview: input.requiresInterview || false,
        },
    });

    const workDates = input.workDates.map(dateStr => {
        const workDate = new Date(dateStr);
        const deadline = new Date(workDate);

        if (input.recruitmentEndDay === 0) {
            if (input.recruitmentEndTime) {
                const [h, m] = input.recruitmentEndTime.split(':').map(Number);
                deadline.setHours(h, m, 0, 0);
            } else {
                deadline.setHours(5, 0, 0, 0);
            }
        } else {
            deadline.setDate(deadline.getDate() - (input.recruitmentEndDay || 1));
            deadline.setHours(23, 59, 59, 999);
        }

        const visibleUntil = new Date(workDate);
        const [startHour, startMin] = input.startTime.split(':').map(Number);
        visibleUntil.setHours(startHour - 2, startMin, 0, 0);

        return {
            job_id: job.id,
            work_date: workDate,
            deadline: deadline,
            recruitment_count: input.recruitmentCount,
            applied_count: 0,
            visible_until: visibleUntil,
        };
    });

    await prisma.jobWorkDate.createMany({
        data: workDates,
    });

    sendNearbyJobNotifications(job.id, 'WORKER_NEARBY_NEW_JOB')
        .catch(e => console.error('[createJobs] Nearby notification error:', e));

    return { success: true, jobId: job.id };
}

/**
 * 求人を削除
 */
export async function deleteJobs(jobIds: number[], facilityId: number): Promise<{ success: boolean; message: string; deletedCount?: number }> {
    try {
        const jobsToDelete = await prisma.job.findMany({
            where: {
                id: { in: jobIds },
                facility_id: facilityId,
            },
            select: { id: true },
        });

        if (jobsToDelete.length === 0) {
            return { success: false, message: '削除対象の求人が見つかりません' };
        }

        const validJobIds = jobsToDelete.map(j => j.id);

        const result = await prisma.job.deleteMany({
            where: { id: { in: validJobIds } },
        });

        revalidatePath('/admin/jobs');

        return {
            success: true,
            message: `${result.count}件の求人を削除しました`,
            deletedCount: result.count,
        };
    } catch (error) {
        console.error('[deleteJobs] Error:', error);
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
        const jobsToUpdate = await prisma.job.findMany({
            where: {
                id: { in: jobIds },
                facility_id: facilityId,
            },
            select: { id: true },
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
        }

        const statusLabel = status === 'PUBLISHED' ? '公開' : '停止';
        return {
            success: true,
            message: `${result.count}件の求人を${statusLabel}しました`,
            updatedCount: result.count,
        };
    } catch (error) {
        console.error('[updateJobsStatus] Error:', error);
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
                const deadline = new Date(workDate);
                deadline.setDate(deadline.getDate() - 1);
                deadline.setHours(23, 59, 59, 999);

                const visibleUntil = new Date(workDate);
                const [startHour, startMin] = data.startTime.split(':').map(Number);
                visibleUntil.setHours(startHour - 2, startMin, 0, 0);

                return {
                    job_id: jobId,
                    work_date: workDate,
                    deadline: deadline,
                    recruitment_count: data.recruitmentCount,
                    applied_count: 0,
                    visible_until: visibleUntil,
                };
            });

            await prisma.jobWorkDate.createMany({
                data: newWorkDates,
                skipDuplicates: true,
            });
        }

        if (existingJob.start_time !== data.startTime) {
            const workDatesToUpdate = existingJob.workDates;

            await Promise.all(workDatesToUpdate.map(async (wd) => {
                const visibleUntil = new Date(wd.work_date);
                const [startHour, startMin] = data.startTime.split(':').map(Number);
                visibleUntil.setHours(startHour - 2, startMin, 0, 0);

                return prisma.jobWorkDate.update({
                    where: { id: wd.id },
                    data: { visible_until: visibleUntil }
                });
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
        return { success: true };
    } catch (error) {
        console.error('[updateJob] Error:', error);
        return { success: false, error: '求人の更新に失敗しました' };
    }
}
