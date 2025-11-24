'use server';

import { prisma } from './prisma';

export async function getJobs() {
  const jobs = await prisma.job.findMany({
    where: {
      status: 'PUBLISHED',
    },
    include: {
      facility: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  // Date型を文字列に変換してシリアライズ可能にする
  return jobs.map((job) => ({
    ...job,
    work_date: job.work_date.toISOString(),
    deadline: job.deadline.toISOString(),
    created_at: job.created_at.toISOString(),
    updated_at: job.updated_at.toISOString(),
    facility: {
      ...job.facility,
      created_at: job.facility.created_at.toISOString(),
      updated_at: job.facility.updated_at.toISOString(),
    },
  }));
}

export async function getJobById(id: string) {
  const jobId = parseInt(id, 10);

  if (isNaN(jobId)) {
    return null;
  }

  const job = await prisma.job.findUnique({
    where: {
      id: jobId,
    },
    include: {
      facility: true,
    },
  });

  if (!job) {
    return null;
  }

  // Date型を文字列に変換してシリアライズ可能にする
  return {
    ...job,
    work_date: job.work_date.toISOString(),
    deadline: job.deadline.toISOString(),
    created_at: job.created_at.toISOString(),
    updated_at: job.updated_at.toISOString(),
    facility: {
      ...job.facility,
      created_at: job.facility.created_at.toISOString(),
      updated_at: job.facility.updated_at.toISOString(),
    },
  };
}
