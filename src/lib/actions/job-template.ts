'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * 管理者用: 施設に属する全ての求人テンプレートを取得
 */
export async function getAdminJobTemplates(facilityId: number) {
    const templates = await prisma.jobTemplate.findMany({
        where: { facility_id: facilityId },
        orderBy: { created_at: 'desc' },
    });

    return templates.map((template) => ({
        id: template.id,
        name: template.name,
        title: template.title,
        startTime: template.start_time,
        endTime: template.end_time,
        breakTime: template.break_time,
        hourlyWage: template.hourly_wage,
        transportationFee: template.transportation_fee,
        recruitmentCount: template.recruitment_count,
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
    }
) {
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
                transportation_fee: data.transportationFee,
                recruitment_count: data.recruitmentCount,
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
            },
        });

        console.log('[createJobTemplate] Template created:', template.id);

        revalidatePath('/admin/jobs/templates');

        return {
            success: true,
            templateId: template.id,
        };
    } catch (error) {
        console.error('[createJobTemplate] Error:', error);
        return {
            success: false,
            error: 'テンプレートの作成に失敗しました',
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
    }
) {
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
                transportation_fee: data.transportationFee,
                recruitment_count: data.recruitmentCount,
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
            },
        });

        console.log('[updateJobTemplate] Template updated:', templateId);

        revalidatePath('/admin/jobs/templates');

        return {
            success: true,
        };
    } catch (error) {
        console.error('[updateJobTemplate] Error:', error);
        return {
            success: false,
            error: 'テンプレートの更新に失敗しました',
        };
    }
}
