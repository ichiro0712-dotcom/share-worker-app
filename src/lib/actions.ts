'use server';

import { prisma } from './prisma';
import { revalidatePath } from 'next/cache';

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

export async function getMyApplications() {
  try {
    // 仮のユーザーIDを取得（最初のユーザー）
    const user = await prisma.user.findFirst();

    if (!user) {
      console.log('[getMyApplications] No users found');
      return [];
    }

    console.log('[getMyApplications] Fetching applications for user:', user.id);

    // ユーザーの応募履歴を取得
    const applications = await prisma.application.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        job: {
          include: {
            facility: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log('[getMyApplications] Found applications:', applications.length);

    // Date型を文字列に変換してシリアライズ可能にする
    return applications.map((app) => ({
      id: app.id,
      job_id: app.job_id,
      user_id: app.user_id,
      status: app.status,
      worker_review_status: app.worker_review_status,
      facility_review_status: app.facility_review_status,
      message: app.message,
      created_at: app.created_at.toISOString(),
      updated_at: app.updated_at.toISOString(),
      job: {
        id: app.job.id,
        facility_id: app.job.facility_id,
        template_id: app.job.template_id,
        status: app.job.status,
        title: app.job.title,
        work_date: app.job.work_date.toISOString(),
        start_time: app.job.start_time,
        end_time: app.job.end_time,
        break_time: app.job.break_time,
        wage: app.job.wage,
        hourly_wage: app.job.hourly_wage,
        transportation_fee: app.job.transportation_fee,
        deadline: app.job.deadline.toISOString(),
        tags: app.job.tags,
        address: app.job.address,
        access: app.job.access,
        recruitment_count: app.job.recruitment_count,
        applied_count: app.job.applied_count,
        overview: app.job.overview,
        work_content: app.job.work_content,
        required_qualifications: app.job.required_qualifications,
        required_experience: app.job.required_experience,
        dresscode: app.job.dresscode,
        belongings: app.job.belongings,
        manager_name: app.job.manager_name,
        manager_message: app.job.manager_message,
        manager_avatar: app.job.manager_avatar,
        images: app.job.images,
        created_at: app.job.created_at.toISOString(),
        updated_at: app.job.updated_at.toISOString(),
        facility: {
          id: app.job.facility.id,
          corporation_name: app.job.facility.corporation_name,
          facility_name: app.job.facility.facility_name,
          facility_type: app.job.facility.facility_type,
          address: app.job.facility.address,
          lat: app.job.facility.lat,
          lng: app.job.facility.lng,
          phone_number: app.job.facility.phone_number,
          description: app.job.facility.description,
          images: app.job.facility.images,
          rating: app.job.facility.rating,
          review_count: app.job.facility.review_count,
          initial_message: app.job.facility.initial_message,
          created_at: app.job.facility.created_at.toISOString(),
          updated_at: app.job.facility.updated_at.toISOString(),
        },
      },
    }));
  } catch (error) {
    console.error('[getMyApplications] Error:', error);
    return [];
  }
}

export async function getUserProfile() {
  try {
    // 仮のユーザーIDを取得（最初のユーザー）
    const user = await prisma.user.findFirst();

    if (!user) {
      console.log('[getUserProfile] No users found');
      return null;
    }

    console.log('[getUserProfile] Fetching profile for user:', user.id);

    // Date型を文字列に変換してシリアライズ可能にする
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      birth_date: user.birth_date ? user.birth_date.toISOString() : null,
      phone_number: user.phone_number,
      profile_image: user.profile_image,
      qualifications: user.qualifications,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString(),
    };
  } catch (error) {
    console.error('[getUserProfile] Error:', error);
    return null;
  }
}

export async function updateUserProfile(formData: FormData) {
  try {
    // 仮のユーザーIDを取得（最初のユーザー）
    const user = await prisma.user.findFirst();

    if (!user) {
      console.error('[updateUserProfile] No users found');
      return {
        success: false,
        error: 'ユーザーが見つかりません',
      };
    }

    console.log('[updateUserProfile] Updating profile for user:', user.id);

    // FormDataから値を取得
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const birthDate = formData.get('birthDate') as string;
    const qualificationsStr = formData.get('qualifications') as string;

    // 資格は配列に変換
    const qualifications = qualificationsStr ? qualificationsStr.split(',').filter(q => q.trim()) : [];

    // バリデーション
    if (!name || !email || !phoneNumber) {
      return {
        success: false,
        error: '必須項目を入力してください',
      };
    }

    // プロフィール更新
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        email,
        phone_number: phoneNumber,
        birth_date: birthDate ? new Date(birthDate) : null,
        qualifications,
      },
    });

    console.log('[updateUserProfile] Profile updated successfully');

    // ページを再検証して最新のデータを表示
    revalidatePath('/mypage/profile');

    return {
      success: true,
      message: 'プロフィールを更新しました',
    };
  } catch (error) {
    console.error('[updateUserProfile] Error:', error);
    return {
      success: false,
      error: 'プロフィールの更新に失敗しました',
    };
  }
}
