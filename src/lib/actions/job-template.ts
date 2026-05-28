'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { getFacilityAdminSessionData, validateFacilityAccess } from '@/lib/admin-session-server';

/**
 * 管理者用: 施設に属する全ての求人テンプレートを取得
 */
export async function getAdminJobTemplates(facilityId: number) {
    const templates = await prisma.jobTemplate.findMany({
        where: { facility_id: facilityId },
        orderBy: { created_at: 'desc' },
    });

    // 各テンプレートを参照する求人数を1クエリで集計（N+1回避）
    const usageCounts = await prisma.job.groupBy({
        by: ['template_id'],
        where: { template_id: { in: templates.map((t) => t.id) } },
        _count: { _all: true },
    });
    const usageCountMap = new Map(
        usageCounts.map((u) => [u.template_id, u._count._all])
    );

    return templates.map((template) => ({
        id: template.id,
        usageCount: usageCountMap.get(template.id) ?? 0,
        name: template.name,
        title: template.title,
        startTime: template.start_time,
        endTime: template.end_time,
        breakTime: template.break_time,
        hourlyWage: template.hourly_wage,
        transportationFee: template.transportation_fee,
        recruitmentCount: template.recruitment_count,
        recruitmentStartDay: template.recruitment_start_day,
        recruitmentStartTime: template.recruitment_start_time,
        recruitmentEndDay: template.deadline_days_before,
        recruitmentEndTime: template.recruitment_end_time,
        qualifications: template.qualifications,
        workContent: template.work_content || [],
        description: template.description,
        skills: template.skills,
        dresscode: template.dresscode,
        belongings: template.belongings,
        images: template.images || [],
        dresscodeImages: template.dresscode_images || [],
        attachments: template.attachments || [],
        notes: template.notes,
        tags: template.tags,
        genderRequirement: (template as any).gender_requirement ?? null,
    }));
}

/**
 * 管理者用: 特定の求人テンプレートを取得
 */
export async function getJobTemplate(templateId: number, facilityId: number) {
    const template = await prisma.jobTemplate.findFirst({
        where: {
            id: templateId,
            facility_id: facilityId,
        },
        include: { facility: true },
    });

    if (!template) {
        return null;
    }

    return {
        id: template.id,
        name: template.name,
        title: template.title,
        facilityId: template.facility_id,
        facilityName: template.facility.facility_name,
        jobType: '通常業務',
        startTime: template.start_time,
        endTime: template.end_time,
        breakTime: template.break_time,
        hourlyWage: template.hourly_wage,
        transportationFee: template.transportation_fee,
        recruitmentCount: template.recruitment_count,
        recruitmentStartDay: template.recruitment_start_day,
        recruitmentStartTime: template.recruitment_start_time,
        recruitmentEndDay: template.deadline_days_before,
        recruitmentEndTime: template.recruitment_end_time,
        qualifications: template.qualifications,
        description: template.description,
        skills: template.skills,
        dresscode: template.dresscode,
        belongings: template.belongings,
        images: template.images || [],
        dresscodeImages: template.dresscode_images || [],
        attachments: template.attachments || [],
        notes: template.notes,
        tags: template.tags,
        icons: template.tags,
        workContent: template.work_content || [],
        genderRequirement: (template as any).gender_requirement ?? null,
    };
}

/**
 * 管理者用: 求人テンプレートを作成
 */
export async function createJobTemplate(
    facilityId: number,
    data: {
        name: string;
        title: string;
        startTime: string;
        endTime: string;
        breakTime: number;
        hourlyWage: number;
        transportationFee: number;
        recruitmentCount: number;
        recruitmentStartDay?: number;
        recruitmentStartTime?: string | null;
        recruitmentEndDay?: number;
        recruitmentEndTime?: string | null;
        qualifications: string[];
        description: string;
        workContent?: string[];
        skills?: string[];
        dresscode?: string[];
        belongings?: string[];
        icons?: string[];
        notes?: string;
        images?: string[];
        dresscodeImages?: string[];
        attachments?: string[];
        // 性別指定（特定業務時のみ。施設管理者の参照用）
        genderRequirement?: 'MALE_ONLY' | 'FEMALE_ONLY' | null;
    }
) {
    const session = await getFacilityAdminSessionData();

    try {
        const template = await prisma.jobTemplate.create({
            data: {
                facility_id: facilityId,
                name: data.name,
                title: data.title,
                start_time: data.startTime,
                end_time: data.endTime,
                break_time: data.breakTime,
                hourly_wage: data.hourlyWage,
                // テンプレートでは交通費は固定値0で保存（実求人作成時に勤務時間から自動計算する）
                transportation_fee: 0,
                recruitment_count: data.recruitmentCount,
                recruitment_start_day: data.recruitmentStartDay ?? 0,
                recruitment_start_time: data.recruitmentStartTime || null,
                deadline_days_before: data.recruitmentEndDay ?? -2,
                recruitment_end_time: data.recruitmentEndTime || null,
                qualifications: data.qualifications,
                work_content: data.workContent || [],
                description: data.description,
                skills: data.skills || [],
                dresscode: data.dresscode || [],
                belongings: data.belongings || [],
                tags: data.icons || [],
                notes: data.notes || null,
                images: data.images || [],
                dresscode_images: data.dresscodeImages || [],
                attachments: data.attachments || [],
                gender_requirement: data.genderRequirement ?? null,
            },
        });

        console.log('[createJobTemplate] Template created:', template.id);

        revalidatePath('/admin/jobs/templates');

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_CREATE',
            targetType: 'JobTemplate',
            targetId: template.id,
            requestData: {
                facilityId,
                name: data.name,
                title: data.title,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            templateId: template.id,
        };
    } catch (error) {
        console.error('[createJobTemplate] Error:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_CREATE',
            requestData: {
                facilityId,
                name: data.name,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return {
            success: false,
            error: 'テンプレートの作成に失敗しました',
        };
    }
}

/**
 * 管理者用: 求人テンプレートを複製
 */
export async function duplicateJobTemplate(templateId: number, facilityId: number) {
    const session = await getFacilityAdminSessionData();

    try {
        // 元のテンプレートを取得
        const original = await prisma.jobTemplate.findFirst({
            where: {
                id: templateId,
                facility_id: facilityId,
            },
        });

        if (!original) {
            return {
                success: false,
                error: 'テンプレートが見つかりません',
            };
        }

        // 新しいテンプレートを作成（名前に「(コピー)」を追加）
        const newTemplate = await prisma.jobTemplate.create({
            data: {
                facility_id: facilityId,
                name: `${original.name}（コピー）`,
                title: original.title,
                start_time: original.start_time,
                end_time: original.end_time,
                break_time: original.break_time,
                hourly_wage: original.hourly_wage,
                transportation_fee: original.transportation_fee,
                recruitment_count: original.recruitment_count,
                recruitment_start_day: original.recruitment_start_day,
                recruitment_start_time: original.recruitment_start_time,
                deadline_days_before: original.deadline_days_before,
                recruitment_end_time: original.recruitment_end_time,
                qualifications: original.qualifications,
                work_content: original.work_content || [],
                description: original.description,
                skills: original.skills,
                dresscode: original.dresscode,
                belongings: original.belongings,
                tags: original.tags,
                notes: original.notes,
                images: original.images || [],
                dresscode_images: original.dresscode_images || [],
                attachments: original.attachments || [],
                gender_requirement: (original as any).gender_requirement ?? null,
            },
        });

        console.log('[duplicateJobTemplate] Template duplicated:', templateId, '->', newTemplate.id);

        revalidatePath('/admin/jobs/templates');

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_DUPLICATE',
            targetType: 'JobTemplate',
            targetId: newTemplate.id,
            requestData: {
                originalTemplateId: templateId,
                facilityId,
                newName: newTemplate.name,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            templateId: newTemplate.id,
        };
    } catch (error) {
        console.error('[duplicateJobTemplate] Error:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_DUPLICATE',
            requestData: {
                originalTemplateId: templateId,
                facilityId,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return {
            success: false,
            error: 'テンプレートの複製に失敗しました',
        };
    }
}

/**
 * 管理者用: 求人テンプレートを更新
 */
export async function updateJobTemplate(
    templateId: number,
    facilityId: number,
    data: {
        name: string;
        title: string;
        startTime: string;
        endTime: string;
        breakTime: number;
        hourlyWage: number;
        transportationFee: number;
        recruitmentCount: number;
        recruitmentStartDay?: number;
        recruitmentStartTime?: string | null;
        recruitmentEndDay?: number;
        recruitmentEndTime?: string | null;
        qualifications: string[];
        description: string;
        workContent?: string[];
        skills?: string[];
        dresscode?: string[];
        belongings?: string[];
        icons?: string[];
        notes?: string;
        images?: string[];
        dresscodeImages?: string[];
        attachments?: string[];
        // 性別指定（特定業務時のみ。施設管理者の参照用）
        genderRequirement?: 'MALE_ONLY' | 'FEMALE_ONLY' | null;
    }
) {
    const session = await getFacilityAdminSessionData();

    try {
        // 権限確認
        const existingTemplate = await prisma.jobTemplate.findFirst({
            where: {
                id: templateId,
                facility_id: facilityId,
            },
        });

        if (!existingTemplate) {
            return {
                success: false,
                error: 'テンプレートが見つからないか、アクセス権限がありません',
            };
        }

        await prisma.jobTemplate.update({
            where: { id: templateId },
            data: {
                name: data.name,
                title: data.title,
                start_time: data.startTime,
                end_time: data.endTime,
                break_time: data.breakTime,
                hourly_wage: data.hourlyWage,
                // テンプレートでは交通費は固定値0で保存（実求人作成時に勤務時間から自動計算する）
                transportation_fee: 0,
                recruitment_count: data.recruitmentCount,
                recruitment_start_day: data.recruitmentStartDay ?? 0,
                recruitment_start_time: data.recruitmentStartTime || null,
                deadline_days_before: data.recruitmentEndDay ?? -2,
                recruitment_end_time: data.recruitmentEndTime || null,
                qualifications: data.qualifications,
                work_content: data.workContent || [],
                description: data.description,
                skills: data.skills || [],
                dresscode: data.dresscode || [],
                belongings: data.belongings || [],
                tags: data.icons || [],
                notes: data.notes || null,
                images: data.images || [],
                dresscode_images: data.dresscodeImages || [],
                attachments: data.attachments || [],
                // genderRequirement は undefined のとき更新しない、null は明示的にクリア
                ...(data.genderRequirement !== undefined && { gender_requirement: data.genderRequirement }),
            },
        });

        console.log('[updateJobTemplate] Template updated:', templateId);

        revalidatePath('/admin/jobs/templates');

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_UPDATE',
            targetType: 'JobTemplate',
            targetId: templateId,
            requestData: {
                facilityId,
                name: data.name,
                title: data.title,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
        };
    } catch (error) {
        console.error('[updateJobTemplate] Error:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_UPDATE',
            targetType: 'JobTemplate',
            targetId: templateId,
            requestData: {
                facilityId,
                name: data.name,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return {
            success: false,
            error: 'テンプレートの更新に失敗しました',
        };
    }
}

/**
 * 管理者用: 求人テンプレートを削除
 * 安全側の挙動として、このテンプレートを使用している求人(Job)が1件でも存在する場合は
 * 削除を中止する（元データ保護）。
 */
export async function deleteJobTemplate(templateId: number, facilityId: number) {
    // 入力バリデーション
    if (!Number.isInteger(templateId) || templateId <= 0) {
        return { success: false, error: '不正なテンプレートIDです' };
    }
    if (!Number.isInteger(facilityId) || facilityId <= 0) {
        return { success: false, error: '不正な施設IDです' };
    }

    // 認可: セッションのfacility_idと一致するか検証
    const access = await validateFacilityAccess(facilityId);
    if (!access.valid) {
        return {
            success: false,
            error: access.error === 'unauthorized'
                ? '認証が必要です'
                : 'この施設にアクセスする権限がありません',
        };
    }
    const session = access.session;

    try {
        // 権限確認: 同じ施設のテンプレートか
        const existingTemplate = await prisma.jobTemplate.findFirst({
            where: {
                id: templateId,
                facility_id: facilityId,
            },
        });

        if (!existingTemplate) {
            return {
                success: false,
                error: 'テンプレートが見つからないか、アクセス権限がありません',
            };
        }

        // 使用中チェック: このテンプレートを参照する求人が1件でもあれば削除拒否
        const referencingJobCount = await prisma.job.count({
            where: { template_id: templateId },
        });

        if (referencingJobCount > 0) {
            // 使用中の求人を特定して返す（UIで「どの求人が使っているか」を提示するため）
            const blockingJobs = await prisma.job.findMany({
                where: { template_id: templateId },
                select: { id: true, title: true, status: true },
                orderBy: { created_at: 'desc' },
                take: 20,
            });

            // ブロック理由を監査ログに記録（INFO相当）
            logActivity({
                userType: 'FACILITY',
                userId: session?.adminId,
                userEmail: session?.email,
                action: 'JOB_TEMPLATE_DELETE',
                targetType: 'JobTemplate',
                targetId: templateId,
                requestData: {
                    facilityId,
                    referencingJobCount,
                    reason: 'IN_USE',
                },
                result: 'ERROR',
                errorMessage: `Template in use by ${referencingJobCount} job(s)`,
            }).catch(() => {});

            return {
                success: false,
                error: 'このテンプレートは使用中の求人があるため削除できません',
                blockingJobs,
                blockingJobCount: referencingJobCount,
            };
        }

        try {
            await prisma.jobTemplate.delete({
                where: { id: templateId },
            });
        } catch (deleteError) {
            // 競合フォールバック:
            // count チェックと delete の間に Job が新規作成された場合、DBレベルの
            // FK 制約 (ON DELETE RESTRICT) で P2003 が発生する。
            // ユーザー向けには同じ「使用中」メッセージを返す。
            if (
                deleteError instanceof Prisma.PrismaClientKnownRequestError &&
                deleteError.code === 'P2003'
            ) {
                logActivity({
                    userType: 'FACILITY',
                    userId: session?.adminId,
                    userEmail: session?.email,
                    action: 'JOB_TEMPLATE_DELETE',
                    targetType: 'JobTemplate',
                    targetId: templateId,
                    requestData: {
                        facilityId,
                        reason: 'IN_USE_RACE',
                    },
                    result: 'ERROR',
                    errorMessage: 'FK constraint violated (P2003) — template became in-use during delete',
                }).catch(() => {});

                const blockingJobs = await prisma.job.findMany({
                    where: { template_id: templateId },
                    select: { id: true, title: true, status: true },
                    orderBy: { created_at: 'desc' },
                    take: 20,
                });

                return {
                    success: false,
                    error: 'このテンプレートは使用中の求人があるため削除できません',
                    blockingJobs,
                    blockingJobCount: blockingJobs.length,
                };
            }
            throw deleteError;
        }

        console.log('[deleteJobTemplate] Template deleted:', templateId);

        revalidatePath('/admin/jobs/templates');

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_DELETE',
            targetType: 'JobTemplate',
            targetId: templateId,
            requestData: {
                facilityId,
                name: existingTemplate.name,
                title: existingTemplate.title,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
        };
    } catch (error) {
        console.error('[deleteJobTemplate] Error:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'JOB_TEMPLATE_DELETE',
            targetType: 'JobTemplate',
            targetId: templateId,
            requestData: {
                facilityId,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return {
            success: false,
            error: 'テンプレートの削除に失敗しました',
        };
    }
}
