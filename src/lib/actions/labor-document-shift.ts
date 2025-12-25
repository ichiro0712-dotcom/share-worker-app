'use server';

import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from './helpers';
import { sendNotification } from '../notification-service';

/**
 * 労働条件通知書データを取得
 */
export async function getLaborDocument(applicationId: number) {
    try {
        const user = await getAuthenticatedUser();
        console.log('[getLaborDocument] Fetching labor document for application:', applicationId);

        const application = await prisma.application.findFirst({
            where: {
                id: applicationId,
                user_id: user.id,
                // マッチング済みのステータスのみ
                status: {
                    in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
                },
            },
            include: {
                workDate: {
                    include: {
                        job: {
                            include: {
                                facility: true,
                                template: true, // JobTemplateにdismissal_reasonsがある
                            },
                        },
                    },
                },
                user: true,
            },
        });

        if (!application) {
            console.log('[getLaborDocument] Application not found or not matched');
            return null;
        }

        const job = application.workDate.job;
        const facility = job.facility;
        const template = job.template;
        const worker = application.user;

        return {
            application: {
                id: application.id,
                status: application.status,
                work_date: application.workDate.work_date.toISOString(),
                created_at: application.created_at.toISOString(),
            },
            user: {
                id: worker.id,
                name: worker.name,
            },
            job: {
                id: job.id,
                title: job.title,
                start_time: job.start_time,
                end_time: job.end_time,
                break_time: typeof job.break_time === 'string' ? parseInt(job.break_time) : job.break_time,
                wage: job.wage,
                hourly_wage: job.hourly_wage,
                transportation_fee: job.transportation_fee,
                address: job.address,
                overview: job.overview,
                work_content: job.work_content,
                belongings: job.belongings,
            },
            facility: {
                id: facility.id,
                corporation_name: facility.corporation_name,
                facility_name: facility.facility_name,
                address: facility.address,
                prefecture: facility.prefecture,
                city: facility.city,
                address_detail: facility.address_detail,
                smoking_measure: facility.smoking_measure,
            },
            dismissalReasons: template?.dismissal_reasons || null,
        };
    } catch (error) {
        console.error('[getLaborDocument] Error:', error);
        return null;
    }
}

/**
 * 管理画面：ワーカーの労働条件通知書一覧を取得
 */
export async function getWorkerLaborDocuments(workerId: number, facilityId: number) {
    try {
        console.log('[getWorkerLaborDocuments] Fetching for worker:', workerId, 'facility:', facilityId);

        // ワーカー情報を取得
        const worker = await prisma.user.findUnique({
            where: { id: workerId },
            select: { name: true },
        });

        if (!worker) {
            return null;
        }

        // 施設に関連するマッチング済みの応募を取得
        const applications = await prisma.application.findMany({
            where: {
                user_id: workerId,
                status: {
                    in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
                },
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
            },
            orderBy: {
                workDate: {
                    work_date: 'desc',
                },
            },
        });

        return {
            workerName: worker.name,
            documents: applications.map((app) => ({
                applicationId: app.id,
                jobTitle: app.workDate.job.title,
                workDate: app.workDate.work_date.toISOString(),
                status: app.status,
                facilityName: app.workDate.job.facility.facility_name,
            })),
        };
    } catch (error) {
        console.error('[getWorkerLaborDocuments] Error:', error);
        return null;
    }
}

/**
 * 管理画面：労働条件通知書の詳細を取得
 */
export async function getAdminLaborDocument(applicationId: number, facilityId: number) {
    try {
        console.log('[getAdminLaborDocument] Fetching application:', applicationId, 'facility:', facilityId);

        const application = await prisma.application.findFirst({
            where: {
                id: applicationId,
                status: {
                    in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
                },
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
                                template: true,
                            },
                        },
                    },
                },
                user: true,
            },
        });

        if (!application) {
            return null;
        }

        const job = application.workDate.job;
        const facility = job.facility;
        const template = job.template;
        const worker = application.user;

        return {
            application: {
                id: application.id,
                status: application.status,
                work_date: application.workDate.work_date.toISOString(),
                created_at: application.created_at.toISOString(),
            },
            user: {
                id: worker.id,
                name: worker.name,
            },
            job: {
                id: job.id,
                title: job.title,
                start_time: job.start_time,
                end_time: job.end_time,
                break_time: typeof job.break_time === 'string' ? parseInt(job.break_time) : job.break_time,
                wage: job.wage,
                hourly_wage: job.hourly_wage,
                transportation_fee: job.transportation_fee,
                address: job.address,
                overview: job.overview,
                work_content: job.work_content,
                belongings: job.belongings,
            },
            facility: {
                id: facility.id,
                corporation_name: facility.corporation_name,
                facility_name: facility.facility_name,
                address: facility.address,
                prefecture: facility.prefecture,
                city: facility.city,
                address_detail: facility.address_detail,
                smoking_measure: facility.smoking_measure,
            },
            dismissalReasons: template?.dismissal_reasons || null,
        };
    } catch (error) {
        console.error('[getAdminLaborDocument] Error:', error);
        return null;
    }
}

/**
 * 施設のシフト一覧を取得（マッチング済みの勤務予定）
 */
export async function getShiftsForFacility(
    facilityId: number,
    startDate: string,
    endDate: string
): Promise<Array<{
    applicationId: number;
    workDateId: number;
    workDate: Date;
    startTime: string;
    endTime: string;
    hourlyRate: number;
    transportationFee: number;
    workerId: number;
    workerName: string;
    workerProfileImage: string | null;
    qualifications: string[];
    status: string;
    jobId: number;
    weeklyFrequency: number | null;
    jobType: string;
}>> {
    'use server';

    try {
        const applications = await prisma.application.findMany({
            where: {
                status: { in: ['SCHEDULED', 'WORKING'] },
                workDate: {
                    job: {
                        facility_id: facilityId,
                    },
                    work_date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
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
                    include: {
                        job: {
                            select: {
                                id: true,
                                hourly_wage: true,
                                transportation_fee: true,
                                start_time: true,
                                end_time: true,
                                weekly_frequency: true,
                                job_type: true,
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
            workDateId: app.work_date_id,
            workDate: app.workDate.work_date,
            startTime: app.workDate.job.start_time,
            endTime: app.workDate.job.end_time,
            hourlyRate: app.workDate.job.hourly_wage,
            transportationFee: app.workDate.job.transportation_fee,
            workerId: app.user.id,
            workerName: app.user.name,
            workerProfileImage: app.user.profile_image,
            qualifications: app.user.qualifications || [],
            status: app.status,
            jobId: app.workDate.job.id,
            weeklyFrequency: app.workDate.job.weekly_frequency,
            jobType: app.workDate.job.job_type,
        }));
    } catch (error) {
        console.error('[getShiftsForFacility] Error:', error);
        return [];
    }
}

/**
 * シフトをキャンセル（マッチングを解除）
 */
export async function cancelShift(applicationId: number): Promise<{ success: boolean; error?: string }> {
    'use server';

    try {
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
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

        if (!application) {
            return { success: false, error: 'Application not found' };
        }

        if (application.status !== 'SCHEDULED') {
            return { success: false, error: 'Only scheduled applications can be cancelled' };
        }

        await prisma.$transaction([
            prisma.application.update({
                where: { id: applicationId },
                data: {
                    status: 'CANCELLED',
                    cancelled_at: new Date(),
                    cancelled_by: 'FACILITY',
                },
            }),
            prisma.jobWorkDate.update({
                where: { id: application.work_date_id },
                data: {
                    matched_count: {
                        decrement: 1,
                    },
                },
            }),
        ]);

        await sendNotification({
            notificationKey: 'WORKER_CANCELLED_BY_FACILITY',
            targetType: 'WORKER',
            recipientId: application.user_id,
            recipientName: application.user.name,
            recipientEmail: application.user.email,
            variables: {
                worker_name: application.user.name,
                facility_name: application.workDate.job.facility.facility_name,
                work_date: application.workDate.work_date.toLocaleDateString(),
                start_time: application.workDate.job.start_time,
                end_time: application.workDate.job.end_time,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('[cancelShift] Error:', error);
        return { success: false, error: 'Failed to cancel shift' };
    }
}
export async function getWorkerBasicInfo(workerId: number, facilityId: number) {
  try {
    // まず、このワーカーがこの施設で勤務したことがあるか確認
    const hasWorked = await prisma.application.findFirst({
      where: {
        user_id: workerId,
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
    });

    if (!hasWorked) {
      console.log('[getWorkerBasicInfo] Worker has not worked at this facility');
      return null;
    }

    // ワーカー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        name: true,
        email: true,
        qualifications: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      qualifications: user.qualifications,
    };
  } catch (error) {
    console.error('[getWorkerBasicInfo] Error:', error);
    return null;
  }
}
