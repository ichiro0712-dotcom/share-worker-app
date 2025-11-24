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

  return jobs;
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

  return job;
}
