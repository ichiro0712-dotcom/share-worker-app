import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { loadTestAccounts } from './test-accounts';
import { TEST_REVIEW } from './test-data';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type ReviewFixture = {
  jobId: number;
  jobTitle: string;
  applicationId: number;
  workDateId: number;
};

export type ReviewPrerequisites = {
  pending: ReviewFixture;
  completed: ReviewFixture;
};

const REVIEW_JOB_TITLES = {
  pending: 'E2E Review Fixture - Pending',
  completed: 'E2E Review Fixture - Completed',
};

function buildJobDataFromTemplate(
  template: {
    template_id: number | null;
    job_type: string;
    start_time: string;
    end_time: string;
    break_time: string;
    wage: number;
    hourly_wage: number;
    transportation_fee: number;
    deadline_days_before: number;
    recruitment_start_day: number;
    recruitment_start_time: string | null;
    tags: string[];
    address: string | null;
    prefecture: string | null;
    city: string | null;
    address_line: string | null;
    access: string;
    recruitment_count: number;
    overview: string;
    work_content: string[];
    required_qualifications: string[];
    required_experience: string[];
    dresscode: string[];
    dresscode_images: string[];
    belongings: string[];
    attachments: string[];
    manager_name: string;
    manager_message: string | null;
    manager_avatar: string | null;
    images: string[];
    inexperienced_ok: boolean;
    blank_ok: boolean;
    hair_style_free: boolean;
    nail_ok: boolean;
    uniform_provided: boolean;
    allow_car: boolean;
    meal_support: boolean;
    weekly_frequency: number | null;
    requires_interview: boolean;
    switch_to_normal_days_before: number | null;
  } | null,
  facilityId: number,
  title: string
) {
  return {
    facility_id: facilityId,
    template_id: template?.template_id ?? null,
    status: 'PUBLISHED',
    job_type: template?.job_type ?? 'NORMAL',
    title,
    start_time: template?.start_time ?? '18:00',
    end_time: template?.end_time ?? '20:00',
    break_time: template?.break_time ?? '00:00',
    wage: template?.wage ?? 3600,
    hourly_wage: template?.hourly_wage ?? 1800,
    transportation_fee: template?.transportation_fee ?? 0,
    deadline_days_before: template?.deadline_days_before ?? 1,
    recruitment_start_day: template?.recruitment_start_day ?? 0,
    recruitment_start_time: template?.recruitment_start_time ?? null,
    tags: template?.tags?.length ? template.tags : ['E2E'],
    address: template?.address ?? null,
    prefecture: template?.prefecture ?? null,
    city: template?.city ?? null,
    address_line: template?.address_line ?? null,
    access: template?.access ?? 'E2E Access',
    recruitment_count: template?.recruitment_count ?? 1,
    overview: template?.overview ?? 'E2E review fixture job.',
    work_content: template?.work_content?.length ? template.work_content : ['E2E work'],
    required_qualifications: template?.required_qualifications?.length
      ? template.required_qualifications
      : ['E2E qualification'],
    required_experience: template?.required_experience?.length
      ? template.required_experience
      : ['E2E experience'],
    dresscode: template?.dresscode?.length ? template.dresscode : ['E2E dresscode'],
    dresscode_images: template?.dresscode_images?.length ? template.dresscode_images : [],
    belongings: template?.belongings?.length ? template.belongings : ['E2E item'],
    attachments: template?.attachments?.length ? template.attachments : [],
    manager_name: template?.manager_name ?? 'E2E Manager',
    manager_message: template?.manager_message ?? null,
    manager_avatar: template?.manager_avatar ?? null,
    images: template?.images?.length ? template.images : ['/images/samples/facility_top_1.png'],
    inexperienced_ok: template?.inexperienced_ok ?? false,
    blank_ok: template?.blank_ok ?? false,
    hair_style_free: template?.hair_style_free ?? false,
    nail_ok: template?.nail_ok ?? false,
    uniform_provided: template?.uniform_provided ?? false,
    allow_car: template?.allow_car ?? false,
    meal_support: template?.meal_support ?? false,
    weekly_frequency: template?.weekly_frequency ?? null,
    requires_interview: template?.requires_interview ?? false,
    switch_to_normal_days_before: template?.switch_to_normal_days_before ?? null,
    target_worker_id: null,
    offer_message: null,
    parent_job_id: null,
  };
}

async function ensureJob(
  prisma: PrismaClient,
  facilityId: number,
  title: string
) {
  const existing = await prisma.job.findFirst({
    where: { facility_id: facilityId, title },
  });
  if (existing) {
    return existing;
  }

  const template =
    (await prisma.job.findFirst({
      where: { facility_id: facilityId },
      orderBy: { created_at: 'desc' },
      select: {
        template_id: true,
        job_type: true,
        start_time: true,
        end_time: true,
        break_time: true,
        wage: true,
        hourly_wage: true,
        transportation_fee: true,
        deadline_days_before: true,
        recruitment_start_day: true,
        recruitment_start_time: true,
        tags: true,
        address: true,
        prefecture: true,
        city: true,
        address_line: true,
        access: true,
        recruitment_count: true,
        overview: true,
        work_content: true,
        required_qualifications: true,
        required_experience: true,
        dresscode: true,
        dresscode_images: true,
        belongings: true,
        attachments: true,
        manager_name: true,
        manager_message: true,
        manager_avatar: true,
        images: true,
        inexperienced_ok: true,
        blank_ok: true,
        hair_style_free: true,
        nail_ok: true,
        uniform_provided: true,
        allow_car: true,
        meal_support: true,
        weekly_frequency: true,
        requires_interview: true,
        switch_to_normal_days_before: true,
      },
    })) ??
    (await prisma.job.findFirst({
      orderBy: { created_at: 'desc' },
      select: {
        template_id: true,
        job_type: true,
        start_time: true,
        end_time: true,
        break_time: true,
        wage: true,
        hourly_wage: true,
        transportation_fee: true,
        deadline_days_before: true,
        recruitment_start_day: true,
        recruitment_start_time: true,
        tags: true,
        address: true,
        prefecture: true,
        city: true,
        address_line: true,
        access: true,
        recruitment_count: true,
        overview: true,
        work_content: true,
        required_qualifications: true,
        required_experience: true,
        dresscode: true,
        dresscode_images: true,
        belongings: true,
        attachments: true,
        manager_name: true,
        manager_message: true,
        manager_avatar: true,
        images: true,
        inexperienced_ok: true,
        blank_ok: true,
        hair_style_free: true,
        nail_ok: true,
        uniform_provided: true,
        allow_car: true,
        meal_support: true,
        weekly_frequency: true,
        requires_interview: true,
        switch_to_normal_days_before: true,
      },
    }));

  return prisma.job.create({
    data: buildJobDataFromTemplate(template, facilityId, title),
  });
}

async function ensureWorkDate(
  prisma: PrismaClient,
  jobId: number,
  workDate: Date,
  recruitmentCount = 1
) {
  const dayStart = new Date(workDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  const existing = await prisma.jobWorkDate.findFirst({
    where: {
      job_id: jobId,
      work_date: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });
  if (existing) {
    return existing;
  }

  const deadline = new Date(dayStart);
  deadline.setDate(dayStart.getDate() - 1);

  return prisma.jobWorkDate.create({
    data: {
      job_id: jobId,
      work_date: workDate,
      deadline,
      recruitment_count: recruitmentCount,
    },
  });
}

async function ensureApplication(
  prisma: PrismaClient,
  workDateId: number,
  userId: number,
  status: 'APPLIED' | 'SCHEDULED' | 'WORKING' | 'COMPLETED_PENDING' | 'COMPLETED_RATED' | 'CANCELLED',
  workerReviewStatus: 'PENDING' | 'COMPLETED',
  facilityReviewStatus: 'PENDING' | 'COMPLETED'
) {
  const existing = await prisma.application.findUnique({
    where: { work_date_id_user_id: { work_date_id: workDateId, user_id: userId } },
  });

  if (!existing) {
    return prisma.application.create({
      data: {
        work_date_id: workDateId,
        user_id: userId,
        status,
        worker_review_status: workerReviewStatus,
        facility_review_status: facilityReviewStatus,
      },
    });
  }

  if (
    existing.status !== status ||
    existing.worker_review_status !== workerReviewStatus ||
    existing.facility_review_status !== facilityReviewStatus
  ) {
    return prisma.application.update({
      where: { id: existing.id },
      data: {
        status,
        worker_review_status: workerReviewStatus,
        facility_review_status: facilityReviewStatus,
      },
    });
  }

  return existing;
}

async function ensureWorkerReview(
  prisma: PrismaClient,
  data: {
    jobId: number;
    facilityId: number;
    userId: number;
    workDateId: number;
    applicationId: number;
  }
) {
  const existing = await prisma.review.findFirst({
    where: {
      job_id: data.jobId,
      user_id: data.userId,
      reviewer_type: 'WORKER',
    },
  });

  const reviewData = {
    facility_id: data.facilityId,
    user_id: data.userId,
    job_id: data.jobId,
    work_date_id: data.workDateId,
    application_id: data.applicationId,
    reviewer_type: 'WORKER' as const,
    rating: TEST_REVIEW.overallRating,
    good_points: TEST_REVIEW.comment,
    improvements: TEST_REVIEW.comment,
  };

  if (!existing) {
    return prisma.review.create({ data: reviewData });
  }

  return prisma.review.update({
    where: { id: existing.id },
    data: reviewData,
  });
}

async function ensureFacilityReview(
  prisma: PrismaClient,
  data: {
    jobId: number;
    facilityId: number;
    userId: number;
    workDateId: number;
    applicationId: number;
  }
) {
  const existing = await prisma.review.findFirst({
    where: {
      job_id: data.jobId,
      user_id: data.userId,
      reviewer_type: 'FACILITY',
    },
  });

  const reviewData = {
    facility_id: data.facilityId,
    user_id: data.userId,
    job_id: data.jobId,
    work_date_id: data.workDateId,
    application_id: data.applicationId,
    reviewer_type: 'FACILITY' as const,
    rating: TEST_REVIEW.overallRating,
    rating_attendance: TEST_REVIEW.detailRatings.attendance,
    rating_skill: TEST_REVIEW.detailRatings.skill,
    rating_execution: TEST_REVIEW.detailRatings.execution,
    rating_communication: TEST_REVIEW.detailRatings.communication,
    rating_attitude: TEST_REVIEW.detailRatings.attitude,
    good_points: TEST_REVIEW.comment,
    improvements: null,
  };

  if (!existing) {
    return prisma.review.create({ data: reviewData });
  }

  return prisma.review.update({
    where: { id: existing.id },
    data: reviewData,
  });
}

export async function ensureReviewPrerequisites(): Promise<ReviewPrerequisites> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to prepare review fixtures.');
  }

  const prisma = new PrismaClient();
  try {
    const accounts = loadTestAccounts();
    const worker = await prisma.user.findUnique({
      where: { email: accounts.worker.email },
      select: { id: true },
    });
    const admin = await prisma.facilityAdmin.findUnique({
      where: { email: accounts.facilityAdmin.email },
      select: { facility_id: true },
    });

    if (!worker || !admin) {
      throw new Error('Test accounts are missing for review fixtures.');
    }

    const pendingJob = await ensureJob(prisma, admin.facility_id, REVIEW_JOB_TITLES.pending);
    const completedJob = await ensureJob(prisma, admin.facility_id, REVIEW_JOB_TITLES.completed);

    const pendingDate = new Date();
    pendingDate.setDate(pendingDate.getDate() - 7);
    pendingDate.setHours(9, 0, 0, 0);

    const completedDate = new Date();
    completedDate.setDate(completedDate.getDate() - 14);
    completedDate.setHours(9, 0, 0, 0);

    const pendingWorkDate = await ensureWorkDate(prisma, pendingJob.id, pendingDate);
    const completedWorkDate = await ensureWorkDate(prisma, completedJob.id, completedDate);

    const pendingApplication = await ensureApplication(
      prisma,
      pendingWorkDate.id,
      worker.id,
      'COMPLETED_PENDING',
      'PENDING',
      'PENDING'
    );

    const completedApplication = await ensureApplication(
      prisma,
      completedWorkDate.id,
      worker.id,
      'COMPLETED_RATED',
      'COMPLETED',
      'COMPLETED'
    );

    await ensureWorkerReview(prisma, {
      jobId: completedJob.id,
      facilityId: admin.facility_id,
      userId: worker.id,
      workDateId: completedWorkDate.id,
      applicationId: completedApplication.id,
    });
    await ensureFacilityReview(prisma, {
      jobId: completedJob.id,
      facilityId: admin.facility_id,
      userId: worker.id,
      workDateId: completedWorkDate.id,
      applicationId: completedApplication.id,
    });

    return {
      pending: {
        jobId: pendingJob.id,
        jobTitle: pendingJob.title,
        applicationId: pendingApplication.id,
        workDateId: pendingWorkDate.id,
      },
      completed: {
        jobId: completedJob.id,
        jobTitle: completedJob.title,
        applicationId: completedApplication.id,
        workDateId: completedWorkDate.id,
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}
