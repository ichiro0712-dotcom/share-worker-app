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

export async function applyForJob(jobId: string) {
  try {
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      console.error('[applyForJob] Invalid job ID:', jobId);
      return {
        success: false,
        error: '無効な求人IDです',
      };
    }

    console.log('[applyForJob] Applying for job:', jobIdNum);

    // 求人が存在するか確認
    const job = await prisma.job.findUnique({
      where: { id: jobIdNum },
    });

    if (!job) {
      console.error('[applyForJob] Job not found:', jobIdNum);
      return {
        success: false,
        error: '求人が見つかりません',
      };
    }

    // 仮のユーザーIDを取得（最初のユーザー）
    let user = await prisma.user.findFirst();

    // ユーザーが存在しない場合はテストユーザーを作成
    if (!user) {
      console.log('[applyForJob] No users found, creating test user...');
      user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password_hash: 'test_password',
          name: 'テストユーザー',
          phone_number: '090-0000-0000',
          qualifications: [],
        },
      });
      console.log('[applyForJob] Test user created:', user.id);
    } else {
      console.log('[applyForJob] Using existing user:', user.id);
    }

    // 既に応募済みかチェック
    const existingApplication = await prisma.application.findUnique({
      where: {
        job_id_user_id: {
          job_id: jobIdNum,
          user_id: user.id,
        },
      },
    });

    if (existingApplication) {
      console.log('[applyForJob] Already applied:', { jobId: jobIdNum, userId: user.id });
      return {
        success: false,
        error: 'この求人には既に応募済みです',
      };
    }

    // 応募を作成
    console.log('[applyForJob] Creating application...', { jobId: jobIdNum, userId: user.id });
    const application = await prisma.application.create({
      data: {
        job_id: jobIdNum,
        user_id: user.id,
        status: 'APPLIED',
      },
    });

    console.log('[applyForJob] Application created successfully:', application.id);

    return {
      success: true,
      message: '応募が完了しました',
    };
  } catch (error) {
    console.error('[applyForJob] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      error,
    });

    // Prismaエラーの詳細をログ出力
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[applyForJob] Prisma error code:', (error as any).code);
      console.error('[applyForJob] Prisma error meta:', (error as any).meta);
    }

    return {
      success: false,
      error: '応募に失敗しました。もう一度お試しください。',
    };
  }
}
