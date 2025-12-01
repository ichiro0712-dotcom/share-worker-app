'use server';

import { prisma } from './prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * 認証済みユーザーを取得する共通ヘルパー関数
 * NextAuthセッションがある場合はそのユーザーを使用
 * 開発環境のみ: セッションがない場合はID=1のテストユーザーにフォールバック
 * 本番環境: セッションがない場合はエラーをスロー
 */
async function getAuthenticatedUser() {
  // NextAuthセッションからユーザーを取得
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    const userId = parseInt(session.user.id, 10);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      return user;
    }
  }

  // 本番環境ではセッションがない場合はエラーをスロー
  if (process.env.NODE_ENV === 'production') {
    throw new Error('認証が必要です');
  }

  // 開発環境のみ: セッションがない場合はID=1のテストユーザーにフォールバック
  let user = await prisma.user.findUnique({
    where: { id: 1 },
  });

  // ユーザーが存在しない場合は作成
  if (!user) {
    console.log('[getAuthenticatedUser] DEV MODE: User with ID=1 not found, creating...');
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password_hash: 'test_password',
        name: 'テストユーザー',
        phone_number: '090-0000-0000',
        qualifications: [],
      },
    });
    console.log('[getAuthenticatedUser] DEV MODE: Test user created with ID:', user.id);
  }

  return user;
}

interface JobSearchParams {
  query?: string;
  prefecture?: string;
  city?: string;
  minWage?: number;
  serviceTypes?: string[];
  transportations?: string[];
  otherConditions?: string[];
  jobTypes?: string[]; // 「看護の仕事のみ」「説明会を除く」
  workTimeTypes?: string[]; // 「日勤」「夜勤」「1日4時間以下」
}

export async function getJobs(searchParams?: JobSearchParams) {
  // 検索条件を動的に構築
  const whereConditions: any = {
    status: 'PUBLISHED',
  };

  // facility条件を別途構築
  const facilityConditions: any = {};

  // キーワード検索（タイトルまたは施設名）
  if (searchParams?.query) {
    whereConditions.OR = [
      {
        title: {
          contains: searchParams.query,
          mode: 'insensitive',
        },
      },
      {
        facility: {
          facility_name: {
            contains: searchParams.query,
            mode: 'insensitive',
          },
        },
      },
    ];
  }

  // 都道府県フィルター
  if (searchParams?.prefecture) {
    facilityConditions.address = {
      contains: searchParams.prefecture,
      mode: 'insensitive',
    };
  }

  // 市区町村フィルター（都道府県と組み合わせる）
  if (searchParams?.city) {
    if (facilityConditions.address) {
      // 都道府県と市区町村の両方を含む
      facilityConditions.AND = [
        { address: { contains: searchParams.prefecture, mode: 'insensitive' } },
        { address: { contains: searchParams.city, mode: 'insensitive' } },
      ];
      delete facilityConditions.address;
    } else {
      facilityConditions.address = {
        contains: searchParams.city,
        mode: 'insensitive',
      };
    }
  }

  // サービス種別フィルター（複数選択対応）
  if (searchParams?.serviceTypes && searchParams.serviceTypes.length > 0) {
    facilityConditions.OR = searchParams.serviceTypes.map((type) => ({
      facility_type: {
        contains: type,
        mode: 'insensitive',
      },
    }));
  }

  // facility条件が存在する場合のみ追加
  if (Object.keys(facilityConditions).length > 0) {
    whereConditions.facility = facilityConditions;
  }

  // 最低時給フィルター
  if (searchParams?.minWage) {
    whereConditions.hourly_wage = {
      gte: searchParams.minWage,
    };
  }

  // 移動手段フィルター（Booleanカラムで検索）
  if (searchParams?.transportations && searchParams.transportations.length > 0) {
    // 移動手段のマッピング: UI選択肢 → DBカラム
    const transportationMapping: Record<string, string> = {
      '車': 'allow_car',
      'バイク': 'allow_bike',
      '自転車': 'allow_bicycle',
      '公共交通機関（電車・バス・徒歩）': 'allow_public_transit',
      '敷地内駐車場あり': 'has_parking',
    };

    whereConditions.AND = whereConditions.AND || [];
    // いずれかの移動手段が利用可能（OR条件）
    whereConditions.AND.push({
      OR: searchParams.transportations
        .filter((t) => transportationMapping[t])
        .map((transport) => ({
          [transportationMapping[transport]]: true,
        })),
    });
  }

  // その他条件フィルター（Booleanカラムで検索）
  if (searchParams?.otherConditions && searchParams.otherConditions.length > 0) {
    // その他条件のマッピング: UI選択肢 → DBカラム
    const otherConditionMapping: Record<string, string> = {
      '入浴介助なし': 'no_bathing_assist',
      '送迎ドライバーあり': 'has_driver',
      '髪型・髪色自由': 'hair_style_free',
      'ネイルOK': 'nail_ok',
      '制服貸与': 'uniform_provided',
      '介護業務未経験歓迎': 'inexperienced_ok',
      'SWORK初心者歓迎': 'beginner_ok',
      '施設オープン５年以内': 'facility_within_5years',
    };

    whereConditions.AND = whereConditions.AND || [];
    // 全てのこだわり条件を満たす（AND条件）
    searchParams.otherConditions.forEach((condition) => {
      const column = otherConditionMapping[condition];
      if (column) {
        whereConditions.AND.push({
          [column]: true,
        });
      }
    });
  }

  // タイプフィルター（登録した資格で応募できる仕事のみ、看護の仕事のみ、説明会を除く）
  if (searchParams?.jobTypes && searchParams.jobTypes.length > 0) {
    whereConditions.AND = whereConditions.AND || [];

    for (const jobType of searchParams.jobTypes) {
      if (jobType === '登録した資格で応募できる仕事のみ') {
        // ユーザーの登録資格を取得
        const user = await getAuthenticatedUser();
        const userQualifications = user.qualifications || [];

        if (userQualifications.length > 0) {
          // 資格のマッピング: ユーザー登録資格 → 求人の資格要件
          // 「看護師」は「正看護師」「准看護師」にマッチ
          // 「介護福祉士」はそのままマッチ
          // など
          const qualificationMapping: Record<string, string[]> = {
            '看護師': ['正看護師', '准看護師'],
            '正看護師': ['正看護師'],
            '准看護師': ['准看護師'],
            '介護福祉士': ['介護福祉士'],
            '初任者研修': ['初任者研修'],
            '実務者研修': ['実務者研修'],
            'ヘルパー2級': ['初任者研修', 'ヘルパー2級'],
            'ヘルパー1級': ['実務者研修', 'ヘルパー1級'],
          };

          // ユーザーの資格から対応する求人資格要件のリストを作成
          const matchingQualifications: string[] = [];
          for (const userQual of userQualifications) {
            const mapped = qualificationMapping[userQual];
            if (mapped) {
              matchingQualifications.push(...mapped);
            } else {
              // マッピングがない場合はそのまま追加
              matchingQualifications.push(userQual);
            }
          }

          // 重複を除去
          const uniqueQualifications = Array.from(new Set(matchingQualifications));

          // 求人の資格要件がユーザーの資格に含まれる、または資格要件がない求人を抽出
          whereConditions.AND.push({
            OR: [
              // 資格要件がない求人（誰でも応募可能）
              { required_qualifications: { equals: [] } },
              // ユーザーの資格のいずれかが求人の資格要件に含まれる
              { required_qualifications: { hasSome: uniqueQualifications } },
            ],
          });
        }
      } else if (jobType === '看護の仕事のみ') {
        // タイトルに「看護」を含む、または資格に「看護」を含む
        whereConditions.AND.push({
          OR: [
            { title: { contains: '看護', mode: 'insensitive' } },
            { required_qualifications: { hasSome: ['正看護師', '准看護師'] } },
          ],
        });
      } else if (jobType === '説明会を除く') {
        // タイトルに「説明会」を含まない
        whereConditions.AND.push({
          NOT: { title: { contains: '説明会', mode: 'insensitive' } },
        });
      }
    }
  }

  // 勤務時間フィルター（日勤、夜勤、1日4時間以下）
  if (searchParams?.workTimeTypes && searchParams.workTimeTypes.length > 0) {
    whereConditions.AND = whereConditions.AND || [];

    // 勤務時間タイプの条件を構築（OR条件）
    const workTimeConditions: any[] = [];

    searchParams.workTimeTypes.forEach((workTimeType) => {
      if (workTimeType === '日勤') {
        // start_time が 05:00 〜 15:59 の求人
        workTimeConditions.push({
          AND: [
            { start_time: { gte: '05:00' } },
            { start_time: { lt: '16:00' } },
          ],
        });
      } else if (workTimeType === '夜勤') {
        // start_time が 16:00 以降の求人
        workTimeConditions.push({
          start_time: { gte: '16:00' },
        });
      } else if (workTimeType === '1日4時間以下') {
        // 勤務時間が4時間以下の求人（計算が必要なのでRaw queryは使わない）
        // start_time と end_time から計算: 簡易的に短時間勤務パターンをチェック
        // 一般的な短時間勤務: 09:00-13:00, 10:00-14:00, 14:00-18:00 など
        workTimeConditions.push({
          OR: [
            // 4時間以下のパターンをマッチ
            { AND: [{ start_time: '09:00' }, { end_time: '13:00' }] },
            { AND: [{ start_time: '10:00' }, { end_time: '14:00' }] },
            { AND: [{ start_time: '14:00' }, { end_time: '18:00' }] },
            { AND: [{ start_time: '08:00' }, { end_time: '12:00' }] },
            { AND: [{ start_time: '13:00' }, { end_time: '17:00' }] },
            // break_time が「なし」の場合は短時間勤務の可能性が高い
            { break_time: 'なし' },
          ],
        });
      }
    });

    // 選択された勤務時間タイプのいずれかに該当（OR条件）
    if (workTimeConditions.length > 0) {
      whereConditions.AND.push({
        OR: workTimeConditions,
      });
    }
  }

  const jobs = await prisma.job.findMany({
    where: whereConditions,
    include: {
      facility: true,
      workDates: {
        orderBy: { work_date: 'asc' },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  // Date型を文字列に変換してシリアライズ可能にする
  // 新しいスキーマでは勤務日は workDates にある
  return jobs.map((job) => {
    // 一番近い勤務日を取得（互換性のため）
    const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
    // 総応募数を計算
    const totalAppliedCount = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);

    return {
      ...job,
      // 互換性のため、一番近い勤務日の情報を work_date と deadline に設定
      work_date: nearestWorkDate ? nearestWorkDate.work_date.toISOString() : null,
      deadline: nearestWorkDate ? nearestWorkDate.deadline.toISOString() : null,
      applied_count: totalAppliedCount,
      // 全ての勤務日情報
      workDates: job.workDates.map((wd) => ({
        ...wd,
        work_date: wd.work_date.toISOString(),
        deadline: wd.deadline.toISOString(),
        created_at: wd.created_at.toISOString(),
        updated_at: wd.updated_at.toISOString(),
      })),
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString(),
      facility: {
        ...job.facility,
        created_at: job.facility.created_at.toISOString(),
        updated_at: job.facility.updated_at.toISOString(),
      },
    };
  });
}

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
    // 全勤務日の応募数合計と募集数合計を計算
    const totalApplied = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
    const totalRecruitment = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

    // 最も近い勤務日
    const today = new Date();
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
      // 勤務日情報
      workDates: job.workDates.map(wd => ({
        id: wd.id,
        date: wd.work_date.toISOString().split('T')[0],
        formattedDate: formatDate(wd.work_date),
        recruitmentCount: wd.recruitment_count,
        appliedCount: wd.applied_count,
        deadline: wd.deadline.toISOString(),
      })),
      // サマリー情報
      totalWorkDates: job.workDates.length,
      totalApplied: totalApplied,
      totalRecruitment: totalRecruitment,
      nearestWorkDate: nearestDate ? formatDate(nearestDate.work_date) : null,
      // 表示用（最初の日付〜最後の日付）
      dateRange: job.workDates.length > 1
        ? `${formatDate(job.workDates[0].work_date)} 〜 ${formatDate(job.workDates[job.workDates.length - 1].work_date)}`
        : nearestDate ? formatDate(nearestDate.work_date) : '',
      // 追加フィールド（プレビュー用）
      overview: job.overview,
      images: job.images,
      address: job.address,
      access: job.access,
      tags: job.tags,
      managerName: job.manager_name,
      managerMessage: job.manager_message,
      managerAvatar: job.manager_avatar,
      facilityName: job.facility.facility_name,
      // 詳細フィールド
      dresscode: job.dresscode,
      dresscodeImages: job.dresscode_images,
      belongings: job.belongings,
      attachments: job.attachments,
      requiredExperience: job.required_experience,
      // 交通手段
      allowCar: job.allow_car,
      allowBike: job.allow_bike,
      allowBicycle: job.allow_bicycle,
      allowPublicTransit: job.allow_public_transit,
      hasParking: job.has_parking,
      // こだわり条件
      noBathingAssist: job.no_bathing_assist,
      hasDriver: job.has_driver,
      hairStyleFree: job.hair_style_free,
      nailOk: job.nail_ok,
      uniformProvided: job.uniform_provided,
      inexperiencedOk: job.inexperienced_ok,
      beginnerOk: job.beginner_ok,
      facilityWithin5years: job.facility_within_5years,
      // 募集条件
      weeklyFrequency: job.weekly_frequency,
      monthlyCommitment: job.monthly_commitment,
      wage: job.wage,
      transportationFee: job.transportation_fee,
      breakTime: job.break_time,
      templateId: job.template_id,
      templateName: job.template?.name || null,
    };
  });
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
      workDates: {
        orderBy: { work_date: 'asc' },
      },
    },
  });

  if (!job) {
    return null;
  }

  // 一番近い勤務日を取得（互換性のため）
  const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
  // 総応募数を計算
  const totalAppliedCount = job.workDates.reduce((sum: number, wd) => sum + wd.applied_count, 0);

  // Date型を文字列に変換してシリアライズ可能にする
  return {
    ...job,
    // 互換性のため、一番近い勤務日の情報を work_date と deadline に設定
    work_date: nearestWorkDate ? nearestWorkDate.work_date.toISOString() : null,
    deadline: nearestWorkDate ? nearestWorkDate.deadline.toISOString() : null,
    applied_count: totalAppliedCount,
    // 全ての勤務日情報
    workDates: job.workDates.map((wd) => ({
      ...wd,
      work_date: wd.work_date.toISOString(),
      deadline: wd.deadline.toISOString(),
      created_at: wd.created_at.toISOString(),
      updated_at: wd.updated_at.toISOString(),
    })),
    created_at: job.created_at.toISOString(),
    updated_at: job.updated_at.toISOString(),
    facility: {
      ...job.facility,
      created_at: job.facility.created_at.toISOString(),
      updated_at: job.facility.updated_at.toISOString(),
    },
  };
}

export async function hasUserAppliedForJob(jobId: string): Promise<boolean> {
  try {
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return false;
    }

    const user = await getAuthenticatedUser();

    // この求人のいずれかの勤務日に応募済みかチェック
    const existingApplication = await prisma.application.findFirst({
      where: {
        user_id: user.id,
        workDate: {
          job_id: jobIdNum,
        },
      },
    });

    return !!existingApplication;
  } catch (error) {
    console.error('[hasUserAppliedForJob] Error:', error);
    return false;
  }
}

export async function applyForJob(jobId: string, workDateId?: number) {
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

    // 求人と勤務日を取得
    const job = await prisma.job.findUnique({
      where: { id: jobIdNum },
      include: {
        workDates: {
          orderBy: { work_date: 'asc' },
        },
      },
    });

    if (!job) {
      console.error('[applyForJob] Job not found:', jobIdNum);
      return {
        success: false,
        error: '求人が見つかりません',
      };
    }

    if (job.workDates.length === 0) {
      console.error('[applyForJob] No work dates found for job:', jobIdNum);
      return {
        success: false,
        error: '勤務日が設定されていません',
      };
    }

    // テスト運用中の認証済みユーザーを取得
    const user = await getAuthenticatedUser();
    console.log('[applyForJob] Using user:', user.id);

    // 応募対象の勤務日を決定（指定がなければ最初の勤務日）
    const targetWorkDateId = workDateId || job.workDates[0].id;

    // 既に応募済みかチェック
    const existingApplication = await prisma.application.findUnique({
      where: {
        work_date_id_user_id: {
          work_date_id: targetWorkDateId,
          user_id: user.id,
        },
      },
    });

    if (existingApplication) {
      console.log('[applyForJob] Already applied:', { workDateId: targetWorkDateId, userId: user.id });
      return {
        success: false,
        error: 'この勤務日には既に応募済みです',
      };
    }

    // 応募を作成
    console.log('[applyForJob] Creating application...', { workDateId: targetWorkDateId, userId: user.id });
    const application = await prisma.application.create({
      data: {
        work_date_id: targetWorkDateId,
        user_id: user.id,
        status: 'APPLIED',
      },
    });

    console.log('[applyForJob] Application created successfully:', application.id);

    // 施設への通知を送信
    await sendApplicationNotification(
      job.facility_id,
      user.name,
      job.title,
      application.id
    );

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
    // テスト運用中の認証済みユーザーを取得
    const user = await getAuthenticatedUser();
    console.log('[getMyApplications] Fetching applications for user:', user.id);

    // ユーザーの応募履歴を取得（workDate経由でjobを取得）
    const applications = await prisma.application.findMany({
      where: {
        user_id: user.id,
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
        created_at: 'desc',
      },
    });

    console.log('[getMyApplications] Found applications:', applications.length);

    // Date型を文字列に変換してシリアライズ可能にする
    return applications.map((app) => {
      const job = app.workDate.job;
      const workDate = app.workDate;

      return {
        id: app.id,
        work_date_id: app.work_date_id,
        user_id: app.user_id,
        status: app.status,
        worker_review_status: app.worker_review_status,
        facility_review_status: app.facility_review_status,
        message: app.message,
        created_at: app.created_at.toISOString(),
        updated_at: app.updated_at.toISOString(),
        // 勤務日情報
        workDate: {
          id: workDate.id,
          work_date: workDate.work_date.toISOString(),
          deadline: workDate.deadline.toISOString(),
          recruitment_count: workDate.recruitment_count,
          applied_count: workDate.applied_count,
        },
        // 互換性のためjob_idも追加
        job_id: job.id,
        job: {
          id: job.id,
          facility_id: job.facility_id,
          template_id: job.template_id,
          status: job.status,
          title: job.title,
          // 互換性のため、応募した勤務日の情報をwork_dateとdeadlineに設定
          work_date: workDate.work_date.toISOString(),
          start_time: job.start_time,
          end_time: job.end_time,
          break_time: job.break_time,
          wage: job.wage,
          hourly_wage: job.hourly_wage,
          transportation_fee: job.transportation_fee,
          deadline: workDate.deadline.toISOString(),
          tags: job.tags,
          address: job.address,
          access: job.access,
          recruitment_count: workDate.recruitment_count,
          applied_count: workDate.applied_count,
          overview: job.overview,
          work_content: job.work_content,
          required_qualifications: job.required_qualifications,
          required_experience: job.required_experience,
          dresscode: job.dresscode,
          belongings: job.belongings,
          manager_name: job.manager_name,
          manager_message: job.manager_message,
          manager_avatar: job.manager_avatar,
          images: job.images,
          created_at: job.created_at.toISOString(),
          updated_at: job.updated_at.toISOString(),
          facility: {
            id: job.facility.id,
            corporation_name: job.facility.corporation_name,
            facility_name: job.facility.facility_name,
            facility_type: job.facility.facility_type,
            address: job.facility.address,
            lat: job.facility.lat,
            lng: job.facility.lng,
            phone_number: job.facility.phone_number,
            description: job.facility.description,
            images: job.facility.images,
            rating: job.facility.rating,
            review_count: job.facility.review_count,
            initial_message: job.facility.initial_message,
            created_at: job.facility.created_at.toISOString(),
            updated_at: job.facility.updated_at.toISOString(),
          },
        },
      };
    });
  } catch (error) {
    console.error('[getMyApplications] Error:', error);
    return [];
  }
}

export async function getUserProfile() {
  try {
    // テスト運用中の認証済みユーザーを取得
    const user = await getAuthenticatedUser();
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
      // 追加フィールド
      last_name_kana: user.last_name_kana,
      first_name_kana: user.first_name_kana,
      gender: user.gender,
      nationality: user.nationality,
      // 住所
      postal_code: user.postal_code,
      prefecture: user.prefecture,
      city: user.city,
      address_line: user.address_line,
      building: user.building,
      // 緊急連絡先
      emergency_name: user.emergency_name,
      emergency_relation: user.emergency_relation,
      emergency_phone: user.emergency_phone,
      emergency_address: user.emergency_address,
      // 働き方・希望
      current_work_style: user.current_work_style,
      desired_work_style: user.desired_work_style,
      job_change_desire: user.job_change_desire,
      desired_work_days_week: user.desired_work_days_week,
      desired_work_period: user.desired_work_period,
      desired_work_days: user.desired_work_days,
      desired_start_time: user.desired_start_time,
      desired_end_time: user.desired_end_time,
      // 経験
      experience_fields: user.experience_fields as Record<string, string> | null,
      work_histories: user.work_histories,
      // 自己PR
      self_pr: user.self_pr,
      // 銀行口座
      bank_name: user.bank_name,
      branch_name: user.branch_name,
      account_name: user.account_name,
      account_number: user.account_number,
      // その他
      pension_number: user.pension_number,
    };
  } catch (error) {
    console.error('[getUserProfile] Error:', error);
    return null;
  }
}

export async function updateUserProfile(formData: FormData) {
  try {
    // テスト運用中の認証済みユーザーを取得
    const user = await getAuthenticatedUser();
    console.log('[updateUserProfile] Updating profile for user:', user.id);

    // FormDataから値を取得
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const birthDate = formData.get('birthDate') as string;
    const qualificationsStr = formData.get('qualifications') as string;
    const profileImageFile = formData.get('profileImage') as File | null;

    // 追加フィールド
    const lastNameKana = formData.get('lastNameKana') as string | null;
    const firstNameKana = formData.get('firstNameKana') as string | null;
    const gender = formData.get('gender') as string | null;
    const nationality = formData.get('nationality') as string | null;

    // 住所
    const postalCode = formData.get('postalCode') as string | null;
    const prefecture = formData.get('prefecture') as string | null;
    const city = formData.get('city') as string | null;
    const addressLine = formData.get('addressLine') as string | null;
    const building = formData.get('building') as string | null;

    // 緊急連絡先
    const emergencyName = formData.get('emergencyName') as string | null;
    const emergencyRelation = formData.get('emergencyRelation') as string | null;
    const emergencyPhone = formData.get('emergencyPhone') as string | null;
    const emergencyAddress = formData.get('emergencyAddress') as string | null;

    // 働き方・希望
    const currentWorkStyle = formData.get('currentWorkStyle') as string | null;
    const desiredWorkStyle = formData.get('desiredWorkStyle') as string | null;
    const jobChangeDesire = formData.get('jobChangeDesire') as string | null;
    const desiredWorkDaysPerWeek = formData.get('desiredWorkDaysPerWeek') as string | null;
    const desiredWorkPeriod = formData.get('desiredWorkPeriod') as string | null;
    const desiredWorkDaysStr = formData.get('desiredWorkDays') as string | null;
    const desiredStartTime = formData.get('desiredStartTime') as string | null;
    const desiredEndTime = formData.get('desiredEndTime') as string | null;

    // 経験
    const experienceFieldsStr = formData.get('experienceFields') as string | null;
    const workHistoriesStr = formData.get('workHistories') as string | null;

    // 自己PR
    const selfPR = formData.get('selfPR') as string | null;

    // 銀行口座
    const bankName = formData.get('bankName') as string | null;
    const branchName = formData.get('branchName') as string | null;
    const accountName = formData.get('accountName') as string | null;
    const accountNumber = formData.get('accountNumber') as string | null;

    // その他
    const pensionNumber = formData.get('pensionNumber') as string | null;

    // 資格は配列に変換
    const qualifications = qualificationsStr ? qualificationsStr.split(',').filter(q => q.trim()) : [];

    // 希望曜日は配列に変換
    const desiredWorkDays = desiredWorkDaysStr ? desiredWorkDaysStr.split(',').filter(d => d.trim()) : [];

    // 職歴は配列に変換（|||で区切り）
    const workHistories = workHistoriesStr ? workHistoriesStr.split('|||').filter(h => h.trim()) : [];

    // 経験分野はJSONパース
    let experienceFields: Record<string, string> | null = null;
    if (experienceFieldsStr) {
      try {
        experienceFields = JSON.parse(experienceFieldsStr);
      } catch {
        experienceFields = null;
      }
    }

    // バリデーション
    if (!name || !email || !phoneNumber) {
      return {
        success: false,
        error: '必須項目を入力してください',
      };
    }

    // プロフィール画像のアップロード処理
    let profileImagePath = user.profile_image; // デフォルトは既存の画像パス

    if (profileImageFile && profileImageFile.size > 0) {
      try {
        console.log('[updateUserProfile] Processing profile image upload...');

        // ファイル名を生成（ユーザーIDとタイムスタンプを使用）
        const timestamp = Date.now();
        const fileExtension = profileImageFile.name.split('.').pop();
        const fileName = `profile-${user.id}-${timestamp}.${fileExtension}`;

        // アップロードディレクトリのパス
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        const filePath = path.join(uploadDir, fileName);

        // ディレクトリが存在しない場合は作成
        await mkdir(uploadDir, { recursive: true });

        // ファイルをバッファに変換して保存
        const bytes = await profileImageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // DBに保存するパス（/uploads/profile-1-xxxxx.jpg）
        profileImagePath = `/uploads/${fileName}`;

        console.log('[updateUserProfile] Profile image saved:', profileImagePath);
      } catch (imageError) {
        console.error('[updateUserProfile] Failed to save profile image:', imageError);
        // 画像保存失敗時もプロフィール更新は続行
      }
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
        profile_image: profileImagePath,
        // 追加フィールド
        last_name_kana: lastNameKana || null,
        first_name_kana: firstNameKana || null,
        gender: gender || null,
        nationality: nationality || null,
        // 住所
        postal_code: postalCode || null,
        prefecture: prefecture || null,
        city: city || null,
        address_line: addressLine || null,
        building: building || null,
        // 緊急連絡先
        emergency_name: emergencyName || null,
        emergency_relation: emergencyRelation || null,
        emergency_phone: emergencyPhone || null,
        emergency_address: emergencyAddress || null,
        // 働き方・希望
        current_work_style: currentWorkStyle || null,
        desired_work_style: desiredWorkStyle || null,
        job_change_desire: jobChangeDesire || null,
        desired_work_days_week: desiredWorkDaysPerWeek,
        desired_work_period: desiredWorkPeriod || null,
        desired_work_days: desiredWorkDays,
        desired_start_time: desiredStartTime || null,
        desired_end_time: desiredEndTime || null,
        // 経験
        experience_fields: experienceFields || undefined,
        work_histories: workHistories,
        // 自己PR
        self_pr: selfPR || null,
        // 銀行口座
        bank_name: bankName || null,
        branch_name: branchName || null,
        account_name: accountName || null,
        account_number: accountNumber || null,
        // その他
        pension_number: pensionNumber || null,
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

// ========================================
// ブックマーク機能 (Bookmark Functions)
// ========================================

/**
 * 求人をブックマークに追加
 * @param jobId - 求人ID
 * @param type - ブックマークタイプ ('FAVORITE' | 'WATCH_LATER')
 */
export async function addJobBookmark(jobId: string, type: 'FAVORITE' | 'WATCH_LATER') {
  try {
    const user = await getAuthenticatedUser();
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return {
        success: false,
        error: '無効な求人IDです',
      };
    }

    // 既にブックマーク済みかチェック
    const existing = await prisma.bookmark.findFirst({
      where: {
        user_id: user.id,
        target_job_id: jobIdNum,
        type,
      },
    });

    if (existing) {
      return {
        success: false,
        error: '既にブックマーク済みです',
      };
    }

    // ブックマークを作成
    await prisma.bookmark.create({
      data: {
        user_id: user.id,
        target_job_id: jobIdNum,
        type,
      },
    });

    revalidatePath('/jobs/' + jobId);
    revalidatePath('/bookmarks');
    revalidatePath('/favorites');

    return {
      success: true,
      message: type === 'FAVORITE' ? 'お気に入りに追加しました' : '後で見るに追加しました',
    };
  } catch (error) {
    console.error('[addJobBookmark] Error:', error);
    return {
      success: false,
      error: 'ブックマークの追加に失敗しました',
    };
  }
}

/**
 * 求人のブックマークを削除
 * @param jobId - 求人ID
 * @param type - ブックマークタイプ ('FAVORITE' | 'WATCH_LATER')
 */
export async function removeJobBookmark(jobId: string, type: 'FAVORITE' | 'WATCH_LATER') {
  try {
    const user = await getAuthenticatedUser();
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return {
        success: false,
        error: '無効な求人IDです',
      };
    }

    // ブックマークを削除
    await prisma.bookmark.deleteMany({
      where: {
        user_id: user.id,
        target_job_id: jobIdNum,
        type,
      },
    });

    revalidatePath('/jobs/' + jobId);
    revalidatePath('/bookmarks');
    revalidatePath('/favorites');

    return {
      success: true,
      message: type === 'FAVORITE' ? 'お気に入りから削除しました' : '後で見るから削除しました',
    };
  } catch (error) {
    console.error('[removeJobBookmark] Error:', error);
    return {
      success: false,
      error: 'ブックマークの削除に失敗しました',
    };
  }
}

/**
 * 求人がブックマーク済みかチェック
 * @param jobId - 求人ID
 * @param type - ブックマークタイプ ('FAVORITE' | 'WATCH_LATER')
 */
export async function isJobBookmarked(jobId: string, type: 'FAVORITE' | 'WATCH_LATER') {
  try {
    const user = await getAuthenticatedUser();
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return false;
    }

    const bookmark = await prisma.bookmark.findFirst({
      where: {
        user_id: user.id,
        target_job_id: jobIdNum,
        type,
      },
    });

    return !!bookmark;
  } catch (error) {
    console.error('[isJobBookmarked] Error:', error);
    return false;
  }
}

/**
 * ユーザーがブックマークした求人一覧を取得
 * @param type - ブックマークタイプ ('FAVORITE' | 'WATCH_LATER')
 */
export async function getBookmarkedJobs(type: 'FAVORITE' | 'WATCH_LATER') {
  try {
    const user = await getAuthenticatedUser();

    const bookmarks = await prisma.bookmark.findMany({
      where: {
        user_id: user.id,
        type,
        target_job_id: {
          not: null,
        },
      },
      include: {
        targetJob: {
          include: {
            facility: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // target_job_id が null でないものだけをフィルタリング
    return bookmarks
      .filter((bookmark) => bookmark.targetJob !== null)
      .map((bookmark) => ({
        bookmarkId: bookmark.id,
        addedAt: bookmark.created_at.toISOString(),
        job: bookmark.targetJob!,
      }));
  } catch (error) {
    console.error('[getBookmarkedJobs] Error:', error);
    return [];
  }
}

/**
 * 施設IDから施設情報を取得
 */
export async function getFacilityById(facilityId: number) {
  try {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
    });
    return facility;
  } catch (error) {
    console.error('[getFacilityById] Error:', error);
    return null;
  }
}

/**
 * 施設IDから求人リストを取得
 */
export async function getJobsByFacilityId(facilityId: number) {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        facility_id: facilityId,
        status: 'PUBLISHED',
      },
      include: {
        facility: true,
        workDates: {
          orderBy: { work_date: 'asc' },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // workDatesから互換性のあるwork_date, deadline, applied_countを生成
    return jobs.map((job) => {
      const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
      const totalAppliedCount = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);

      return {
        ...job,
        // 互換性のため
        work_date: nearestWorkDate ? nearestWorkDate.work_date : null,
        deadline: nearestWorkDate ? nearestWorkDate.deadline : null,
        applied_count: totalAppliedCount,
      };
    });
  } catch (error) {
    console.error('[getJobsByFacilityId] Error:', error);
    return [];
  }
}

/**
 * 施設のお気に入り状態をトグル
 */
export async function toggleFacilityFavorite(facilityId: string) {
  try {
    const user = await getAuthenticatedUser();
    const facilityIdNum = parseInt(facilityId);

    // 既存のお気に入りを検索
    const existingFavorite = await prisma.bookmark.findFirst({
      where: {
        user_id: user.id,
        type: 'FAVORITE',
        target_facility_id: facilityIdNum,
      },
    });

    if (existingFavorite) {
      // 削除
      await prisma.bookmark.delete({
        where: { id: existingFavorite.id },
      });
      return { success: true, isFavorite: false };
    } else {
      // 追加
      await prisma.bookmark.create({
        data: {
          user_id: user.id,
          type: 'FAVORITE',
          target_facility_id: facilityIdNum,
        },
      });
      return { success: true, isFavorite: true };
    }
  } catch (error) {
    console.error('[toggleFacilityFavorite] Error:', error);
    return { success: false, error: 'お気に入りの更新に失敗しました' };
  }
}

/**
 * 施設がお気に入り登録されているかチェック
 */
export async function isFacilityFavorited(facilityId: string) {
  try {
    const user = await getAuthenticatedUser();
    const facilityIdNum = parseInt(facilityId);

    const favorite = await prisma.bookmark.findFirst({
      where: {
        user_id: user.id,
        type: 'FAVORITE',
        target_facility_id: facilityIdNum,
      },
    });

    return !!favorite;
  } catch (error) {
    console.error('[isFacilityFavorited] Error:', error);
    return false;
  }
}

/**
 * ユーザーのお気に入り施設一覧を取得
 */
export async function getFavoriteFacilities() {
  try {
    const user = await getAuthenticatedUser();

    const favorites = await prisma.bookmark.findMany({
      where: {
        user_id: user.id,
        type: 'FAVORITE',
        target_facility_id: {
          not: null,
        },
      },
      include: {
        targetFacility: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return favorites
      .filter((fav) => fav.targetFacility !== null)
      .map((fav) => ({
        favoriteId: fav.id,
        addedAt: fav.created_at.toISOString(),
        facility: fav.targetFacility!,
      }));
  } catch (error) {
    console.error('[getFavoriteFacilities] Error:', error);
    return [];
  }
}

// ========================================
// メッセージ機能 (Message Functions)
// ========================================

/**
 * ユーザーの会話一覧を取得（応募ベースでグループ化）
 * 応募済み（APPLIED以上）の求人に対してメッセージ履歴を取得
 */
export async function getConversations() {
  try {
    const user = await getAuthenticatedUser();
    console.log('[getConversations] Fetching conversations for user:', user.id);

    // ユーザーの応募一覧を取得（メッセージ付き）
    const applications = await prisma.application.findMany({
      where: {
        user_id: user.id,
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
        messages: {
          orderBy: {
            created_at: 'desc',
          },
          take: 1, // 最新メッセージのみ
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    console.log('[getConversations] Found applications:', applications.length);

    // 会話形式に変換
    const conversations = await Promise.all(
      applications.map(async (app) => {
        // 未読メッセージ数を取得
        const unreadCount = await prisma.message.count({
          where: {
            application_id: app.id,
            to_user_id: user.id,
            read_at: null,
          },
        });

        const lastMessage = app.messages[0];

        return {
          applicationId: app.id,
          facilityId: app.workDate.job.facility_id,
          facilityName: app.workDate.job.facility.facility_name,
          jobId: app.workDate.job.id,
          jobTitle: app.workDate.job.title,
          jobDate: app.workDate.work_date.toISOString().split('T')[0],
          status: app.status,
          lastMessage: lastMessage?.content || '新しい応募があります',
          lastMessageTime: lastMessage
            ? formatMessageTime(lastMessage.created_at)
            : formatMessageTime(app.created_at),
          lastMessageTimestamp: lastMessage
            ? lastMessage.created_at.toISOString()
            : app.created_at.toISOString(),
          unreadCount,
        };
      })
    );

    return conversations;
  } catch (error) {
    console.error('[getConversations] Error:', error);
    return [];
  }
}

/**
 * 特定の応募に関するメッセージ一覧を取得
 */
export async function getMessages(applicationId: number) {
  try {
    const user = await getAuthenticatedUser();
    console.log('[getMessages] Fetching messages for application:', applicationId);

    // 応募が存在し、ユーザーのものであることを確認
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: user.id,
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
    });

    if (!application) {
      console.error('[getMessages] Application not found or unauthorized');
      return null;
    }

    // メッセージ一覧を取得
    const messages = await prisma.message.findMany({
      where: {
        application_id: applicationId,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // 未読メッセージを既読にする
    await prisma.message.updateMany({
      where: {
        application_id: applicationId,
        to_user_id: user.id,
        read_at: null,
      },
      data: {
        read_at: new Date(),
      },
    });

    return {
      application: {
        id: application.id,
        status: application.status,
        jobId: application.workDate.job.id,
        jobTitle: application.workDate.job.title,
        jobDate: application.workDate.work_date.toISOString().split('T')[0],
        facilityId: application.workDate.job.facility_id,
        facilityName: application.workDate.job.facility.facility_name,
      },
      messages: messages.map((msg) => ({
        id: msg.id,
        senderType: msg.from_user_id ? ('worker' as const) : ('facility' as const),
        senderName: msg.from_user_id ? user.name : application.workDate.job.facility.facility_name,
        content: msg.content,
        timestamp: msg.created_at.toISOString(),
        isRead: !!msg.read_at,
      })),
    };
  } catch (error) {
    console.error('[getMessages] Error:', error);
    return null;
  }
}

/**
 * メッセージを送信
 */
export async function sendMessage(applicationId: number, content: string) {
  try {
    const user = await getAuthenticatedUser();
    console.log('[sendMessage] Sending message for application:', applicationId);

    // 応募が存在し、ユーザーのものであることを確認
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: user.id,
      },
      include: {
        workDate: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!application) {
      return {
        success: false,
        error: '応募が見つかりません',
      };
    }

    // メッセージを作成
    const message = await prisma.message.create({
      data: {
        application_id: applicationId,
        job_id: application.workDate.job_id,
        from_user_id: user.id,
        to_facility_id: application.workDate.job.facility_id,
        content,
      },
    });

    // 応募の更新日時を更新
    await prisma.application.update({
      where: { id: applicationId },
      data: { updated_at: new Date() },
    });

    // 施設への通知を送信
    await sendMessageNotificationToFacility(
      application.workDate.job.facility_id,
      user.name,
      applicationId
    );

    console.log('[sendMessage] Message sent successfully:', message.id);

    revalidatePath('/messages');

    return {
      success: true,
      message: {
        id: message.id,
        senderType: 'worker' as const,
        senderName: user.name,
        content: message.content,
        timestamp: message.created_at.toISOString(),
        isRead: false,
      },
    };
  } catch (error) {
    console.error('[sendMessage] Error:', error);
    return {
      success: false,
      error: 'メッセージの送信に失敗しました',
    };
  }
}

// ========================================
// 施設管理者向けメッセージ機能
// ========================================

/**
 * 施設管理者用: 会話一覧を取得
 */
export async function getFacilityConversations(facilityId: number) {
  try {
    console.log('[getFacilityConversations] Fetching conversations for facility:', facilityId);

    // 施設の求人に対する応募一覧を取得
    const applications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
      },
      include: {
        user: true,
        workDate: {
          include: {
            job: true,
          },
        },
        messages: {
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    console.log('[getFacilityConversations] Found applications:', applications.length);

    // 会話形式に変換
    const conversations = await Promise.all(
      applications.map(async (app) => {
        // 未読メッセージ数を取得
        const unreadCount = await prisma.message.count({
          where: {
            application_id: app.id,
            to_facility_id: facilityId,
            read_at: null,
          },
        });

        const lastMessage = app.messages[0];

        return {
          applicationId: app.id,
          userId: app.user_id,
          userName: app.user.name,
          userProfileImage: app.user.profile_image,
          userQualifications: app.user.qualifications,
          jobId: app.workDate.job.id,
          jobTitle: app.workDate.job.title,
          jobDate: app.workDate.work_date.toISOString().split('T')[0],
          status: app.status,
          lastMessage: lastMessage?.content || '新しい応募があります',
          lastMessageTime: lastMessage
            ? formatMessageTime(lastMessage.created_at)
            : formatMessageTime(app.created_at),
          lastMessageTimestamp: lastMessage
            ? lastMessage.created_at.toISOString()
            : app.created_at.toISOString(),
          unreadCount,
        };
      })
    );

    return conversations;
  } catch (error) {
    console.error('[getFacilityConversations] Error:', error);
    return [];
  }
}

/**
 * 施設管理者用: 特定の応募に関するメッセージ一覧を取得
 */
export async function getFacilityMessages(applicationId: number, facilityId: number) {
  try {
    console.log('[getFacilityMessages] Fetching messages for application:', applicationId);

    // 応募が存在し、施設のものであることを確認
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
      },
      include: {
        user: true,
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
    });

    if (!application) {
      console.error('[getFacilityMessages] Application not found or unauthorized');
      return null;
    }

    // メッセージ一覧を取得
    const messages = await prisma.message.findMany({
      where: {
        application_id: applicationId,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // 未読メッセージを既読にする
    await prisma.message.updateMany({
      where: {
        application_id: applicationId,
        to_facility_id: facilityId,
        read_at: null,
      },
      data: {
        read_at: new Date(),
      },
    });

    return {
      application: {
        id: application.id,
        status: application.status,
        userId: application.user_id,
        userName: application.user.name,
        userProfileImage: application.user.profile_image,
        userQualifications: application.user.qualifications,
        jobId: application.workDate.job.id,
        jobTitle: application.workDate.job.title,
        jobDate: application.workDate.work_date.toISOString().split('T')[0],
        jobStartTime: application.workDate.job.start_time,
        jobEndTime: application.workDate.job.end_time,
      },
      messages: messages.map((msg) => ({
        id: msg.id,
        senderType: msg.from_facility_id ? ('facility' as const) : ('worker' as const),
        senderName: msg.from_facility_id
          ? application.workDate.job.facility.facility_name
          : application.user.name,
        content: msg.content,
        timestamp: msg.created_at.toISOString(),
        isRead: !!msg.read_at,
      })),
    };
  } catch (error) {
    console.error('[getFacilityMessages] Error:', error);
    return null;
  }
}

/**
 * 施設管理者用: メッセージを送信
 */
export async function sendFacilityMessage(
  applicationId: number,
  facilityId: number,
  content: string
) {
  try {
    console.log('[sendFacilityMessage] Sending message for application:', applicationId);

    // 応募が存在し、施設のものであることを確認
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
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
    });

    if (!application) {
      return {
        success: false,
        error: '応募が見つかりません',
      };
    }

    // メッセージを作成
    const message = await prisma.message.create({
      data: {
        application_id: applicationId,
        job_id: application.workDate.job_id,
        from_facility_id: facilityId,
        to_user_id: application.user_id,
        content,
      },
    });

    // 応募の更新日時を更新
    await prisma.application.update({
      where: { id: applicationId },
      data: { updated_at: new Date() },
    });

    // ワーカーへの通知を送信
    await sendMessageNotificationToWorker(
      application.user_id,
      application.workDate.job.facility.facility_name,
      applicationId
    );

    console.log('[sendFacilityMessage] Message sent successfully:', message.id);

    revalidatePath('/admin/messages');

    return {
      success: true,
      message: {
        id: message.id,
        senderType: 'facility' as const,
        senderName: application.workDate.job.facility.facility_name,
        content: message.content,
        timestamp: message.created_at.toISOString(),
        isRead: false,
      },
    };
  } catch (error) {
    console.error('[sendFacilityMessage] Error:', error);
    return {
      success: false,
      error: 'メッセージの送信に失敗しました',
    };
  }
}

/**
 * 未読メッセージ総数を取得
 */
export async function getUnreadMessageCount() {
  try {
    const user = await getAuthenticatedUser();

    const count = await prisma.message.count({
      where: {
        to_user_id: user.id,
        read_at: null,
      },
    });

    return count;
  } catch (error) {
    console.error('[getUnreadMessageCount] Error:', error);
    return 0;
  }
}

/**
 * メッセージ時間をフォーマット
 */
function formatMessageTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    // 今日
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return '昨日';
  } else if (days < 7) {
    return `${days}日前`;
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  }
}

// ========================================
// 評価機能 (Review Functions)
// ========================================

/**
 * 評価待ちの応募一覧を取得（完了済みで未評価のもの）
 */
export async function getPendingReviews() {
  try {
    const user = await getAuthenticatedUser();
    console.log('[getPendingReviews] Fetching pending reviews for user:', user.id);

    // 完了済みで、ワーカー側の評価が未完了の応募を取得
    const applications = await prisma.application.findMany({
      where: {
        user_id: user.id,
        status: {
          in: ['COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
        worker_review_status: 'PENDING',
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
        updated_at: 'desc',
      },
    });

    console.log('[getPendingReviews] Found pending reviews:', applications.length);

    return applications.map((app) => ({
      applicationId: app.id,
      jobId: app.workDate.job.id,
      jobTitle: app.workDate.job.title,
      jobDate: app.workDate.work_date.toISOString().split('T')[0],
      facilityId: app.workDate.job.facility_id,
      facilityName: app.workDate.job.facility.facility_name,
      facilityAddress: app.workDate.job.facility.address,
      completedAt: app.updated_at.toISOString(),
    }));
  } catch (error) {
    console.error('[getPendingReviews] Error:', error);
    return [];
  }
}

/**
 * レビューを投稿
 */
export async function submitReview(
  applicationId: number,
  rating: number,
  goodPoints: string,
  improvements: string
) {
  try {
    const user = await getAuthenticatedUser();
    console.log('[submitReview] Submitting review for application:', applicationId);

    // 応募が存在し、ユーザーのものであることを確認
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: user.id,
        status: {
          in: ['COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
        worker_review_status: 'PENDING',
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
    });

    if (!application) {
      return {
        success: false,
        error: '評価対象の応募が見つかりません',
      };
    }

    // バリデーション
    if (rating < 1 || rating > 5) {
      return {
        success: false,
        error: '評価は1〜5の範囲で選択してください',
      };
    }

    if (!goodPoints.trim()) {
      return {
        success: false,
        error: '良かった点を入力してください',
      };
    }

    if (!improvements.trim()) {
      return {
        success: false,
        error: '改善点を入力してください',
      };
    }

    // トランザクションで処理
    await prisma.$transaction(async (tx) => {
      // レビューを作成
      await tx.review.create({
        data: {
          facility_id: application.workDate.job.facility_id,
          user_id: user.id,
          work_date_id: application.work_date_id,
          application_id: applicationId,
          reviewer_type: 'WORKER',
          rating,
          good_points: goodPoints.trim(),
          improvements: improvements.trim(),
        },
      });

      // 応募のワーカー評価ステータスを更新
      await tx.application.update({
        where: { id: applicationId },
        data: {
          worker_review_status: 'COMPLETED',
          // 両方の評価が完了した場合はステータスを更新
          status:
            application.facility_review_status === 'COMPLETED'
              ? 'COMPLETED_RATED'
              : application.status,
        },
      });

      // 施設の評価を再計算
      const facilityReviews = await tx.review.findMany({
        where: {
          facility_id: application.workDate.job.facility_id,
          reviewer_type: 'WORKER',
        },
        select: {
          rating: true,
        },
      });

      const avgRating =
        facilityReviews.length > 0
          ? facilityReviews.reduce((sum, r) => sum + r.rating, 0) / facilityReviews.length
          : 0;

      await tx.facility.update({
        where: { id: application.workDate.job.facility_id },
        data: {
          rating: Math.round(avgRating * 10) / 10,
          review_count: facilityReviews.length,
        },
      });
    });

    console.log('[submitReview] Review submitted successfully');

    // 施設への通知を送信
    await sendReviewReceivedNotificationToFacility(
      application.workDate.job.facility_id,
      user.name,
      rating
    );

    revalidatePath('/mypage/reviews');
    revalidatePath('/facilities/' + application.workDate.job.facility_id);

    return {
      success: true,
      message: 'レビューを投稿しました',
    };
  } catch (error) {
    console.error('[submitReview] Error:', error);
    return {
      success: false,
      error: 'レビューの投稿に失敗しました',
    };
  }
}

/**
 * ユーザーが投稿したレビュー一覧を取得
 */
export async function getMyReviews() {
  try {
    const user = await getAuthenticatedUser();
    console.log('[getMyReviews] Fetching reviews for user:', user.id);

    const reviews = await prisma.review.findMany({
      where: {
        user_id: user.id,
        reviewer_type: 'WORKER',
      },
      include: {
        facility: true,
        workDate: {
          include: {
            job: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return reviews.map((review) => ({
      id: review.id,
      facilityId: review.facility_id,
      facilityName: review.facility.facility_name,
      jobTitle: review.workDate.job.title,
      jobDate: review.workDate.work_date.toISOString().split('T')[0],
      rating: review.rating,
      goodPoints: review.good_points,
      improvements: review.improvements,
      createdAt: review.created_at.toISOString(),
    }));
  } catch (error) {
    console.error('[getMyReviews] Error:', error);
    return [];
  }
}

/**
 * 生年月日から年代を計算する
 */
function calculateAgeGroup(birthDate: Date | null): string {
  if (!birthDate) return '年齢非公開';

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 20) return '10代';
  if (age < 30) return '20代';
  if (age < 40) return '30代';
  if (age < 50) return '40代';
  if (age < 60) return '50代';
  return '60代以上';
}

/**
 * 施設のレビュー一覧を取得
 */
export async function getFacilityReviews(facilityId: number) {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        facility_id: facilityId,
        reviewer_type: 'WORKER',
      },
      include: {
        user: {
          select: {
            birth_date: true,
            qualifications: true,
          },
        },
        workDate: {
          include: {
            job: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return reviews.map((review: any) => {
      // 年代を計算
      const ageGroup = calculateAgeGroup(review.user.birth_date);
      // 資格（最初の1つ、なければ「資格なし」）
      const qualification = review.user.qualifications.length > 0
        ? review.user.qualifications[0]
        : '資格なし';

      return {
        id: review.id,
        rating: review.rating,
        goodPoints: review.good_points,
        improvements: review.improvements,
        createdAt: review.created_at.toISOString(),
        // 匿名化された属性情報
        ageGroup,
        qualification,
        userQualifications: review.user.qualifications,
        jobTitle: review.workDate.job.title,
        jobDate: review.workDate.work_date.toISOString().split('T')[0],
      };
    });
  } catch (error) {
    console.error('[getFacilityReviews] Error:', error);
    return [];
  }
}

/**
 * 応募の詳細情報を取得（評価画面用）
 */
export async function getApplicationForReview(applicationId: number) {
  try {
    const user = await getAuthenticatedUser();

    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: user.id,
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
    });

    if (!application) {
      return null;
    }

    return {
      applicationId: application.id,
      status: application.status,
      workerReviewStatus: application.worker_review_status,
      jobId: application.workDate.job.id,
      jobTitle: application.workDate.job.title,
      jobDate: application.workDate.work_date.toISOString().split('T')[0],
      facilityId: application.workDate.job.facility_id,
      facilityName: application.workDate.job.facility.facility_name,
      facilityAddress: application.workDate.job.facility.address,
    };
  } catch (error) {
    console.error('[getApplicationForReview] Error:', error);
    return null;
  }
}

// ========================================
// 施設管理者向け機能 (Facility Admin Functions)
// ========================================

/**
 * 施設の応募一覧を取得（施設管理者向け）
 */
export async function getFacilityApplications(facilityId: number) {
  try {
    console.log('[getFacilityApplications] Fetching applications for facility:', facilityId);

    const applications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            profile_image: true,
            qualifications: true,
          },
        },
        workDate: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                start_time: true,
                end_time: true,
                hourly_wage: true,
                work_content: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log('[getFacilityApplications] Found applications:', applications.length);

    return applications.map((app) => ({
      id: app.id,
      status: app.status,
      createdAt: app.created_at.toISOString(),
      user: {
        id: app.user.id,
        name: app.user.name,
        email: app.user.email,
        phoneNumber: app.user.phone_number,
        profileImage: app.user.profile_image,
        qualifications: app.user.qualifications,
      },
      job: {
        id: app.workDate.job.id,
        title: app.workDate.job.title,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
        hourlyWage: app.workDate.job.hourly_wage,
        workContent: app.workDate.job.work_content,
      },
    }));
  } catch (error) {
    console.error('[getFacilityApplications] Error:', error);
    return [];
  }
}

/**
 * 応募ステータスを更新（施設管理者向け）
 */
export async function updateApplicationStatus(
  applicationId: number,
  newStatus: 'APPLIED' | 'SCHEDULED' | 'WORKING' | 'CANCELLED' | 'COMPLETED_PENDING',
  facilityId: number
) {
  try {
    console.log('[updateApplicationStatus] Updating application:', applicationId, 'to:', newStatus);

    // 応募が存在し、施設に属していることを確認
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
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
        user: true,
      },
    });

    if (!application) {
      return {
        success: false,
        error: '応募が見つかりません',
      };
    }

    // ステータスを更新
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
      },
    });

    // マッチング時（SCHEDULED）は初回メッセージを自動送信 + 通知
    if (newStatus === 'SCHEDULED') {
      if (application.workDate.job.facility.initial_message) {
        await prisma.message.create({
          data: {
            application_id: applicationId,
            job_id: application.workDate.job_id,
            from_facility_id: facilityId,
            to_user_id: application.user_id,
            content: application.workDate.job.facility.initial_message,
          },
        });
        console.log('[updateApplicationStatus] Initial message sent');
      }
      // マッチング成立通知をワーカーに送信
      await sendMatchingNotification(
        application.user_id,
        application.workDate.job.title,
        application.workDate.job.facility.facility_name,
        application.workDate.job.id
      );
    }

    // 勤務完了時（COMPLETED_PENDING）は評価依頼通知を送信
    if (newStatus === 'COMPLETED_PENDING') {
      await sendReviewRequestNotification(
        application.user_id,
        application.workDate.job.facility.facility_name,
        application.workDate.job.title,
        applicationId
      );
    }

    console.log('[updateApplicationStatus] Status updated successfully');

    revalidatePath('/admin/applications');
    revalidatePath('/admin/workers');

    return {
      success: true,
      message:
        newStatus === 'SCHEDULED'
          ? 'マッチングが成立しました'
          : newStatus === 'CANCELLED'
            ? '応募をキャンセルしました'
            : newStatus === 'WORKING'
              ? '勤務開始にしました'
              : '勤務完了にしました',
    };
  } catch (error) {
    console.error('[updateApplicationStatus] Error:', error);
    return {
      success: false,
      error: 'ステータスの更新に失敗しました',
    };
  }
}

/**
 * 施設の求人一覧を取得（応募管理用・応募数付き）
 */
export async function getFacilityJobsWithApplicationCount(facilityId: number) {
  try {
    // Query jobWorkDate instead of jobs since work_date and applications are now in job_work_dates
    const workDates = await prisma.jobWorkDate.findMany({
      where: {
        job: {
          facility_id: facilityId,
          status: {
            in: ['PUBLISHED', 'WORKING', 'COMPLETED'],
          },
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            start_time: true,
            end_time: true,
            hourly_wage: true,
            work_content: true,
            status: true,
          },
        },
        applications: {
          where: {
            status: 'APPLIED',
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        work_date: 'asc',
      },
    });

    return workDates.map((wd) => ({
      id: wd.job.id,
      workDateId: wd.id,
      title: wd.job.title,
      workDate: wd.work_date.toISOString().split('T')[0],
      startTime: wd.job.start_time,
      endTime: wd.job.end_time,
      hourlyWage: wd.job.hourly_wage,
      workContent: wd.job.work_content,
      status: wd.job.status,
      appliedCount: wd.applications.length,
      totalApplications: wd._count.applications,
    }));
  } catch (error) {
    console.error('[getFacilityJobsWithApplicationCount] Error:', error);
    return [];
  }
}

/**
 * 応募管理用: ワーカーごとにグループ化した応募一覧を取得
 * - ワーカー名、評価、直前キャンセル率、応募した求人リストを含む
 */
export async function getFacilityApplicationsByWorker(facilityId: number) {
  try {
    console.log('[getFacilityApplicationsByWorker] Fetching applications for facility:', facilityId);

    // 施設への全応募を取得
    const applications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            profile_image: true,
            qualifications: true,
          },
        },
        workDate: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                start_time: true,
                end_time: true,
                hourly_wage: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 全ワーカーのIDを取得
    const workerIds = Array.from(new Set(applications.map((app) => app.user.id)));

    // 各ワーカーの評価を取得（施設→ワーカーの評価）
    const workerReviews = await prisma.review.findMany({
      where: {
        user_id: { in: workerIds },
        reviewer_type: 'FACILITY',
      },
      select: {
        user_id: true,
        rating: true,
      },
    });

    // ワーカーごとの評価を集計
    const workerRatings = new Map<number, { total: number; count: number }>();
    workerReviews.forEach((review) => {
      const current = workerRatings.get(review.user_id) || { total: 0, count: 0 };
      current.total += review.rating;
      current.count += 1;
      workerRatings.set(review.user_id, current);
    });

    // 各ワーカーの全アプリケーションを取得（直前キャンセル率計算用）
    // 直前キャンセル = 勤務日の前日以降にキャンセルされた応募
    const workerAllApplications = await prisma.application.findMany({
      where: {
        user_id: { in: workerIds },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
        },
      },
      include: {
        workDate: {
          select: {
            work_date: true,
          },
        },
      },
    });

    // ワーカーごとの直前キャンセル率を計算
    const workerCancelRates = new Map<number, { lastMinuteCancels: number; totalScheduled: number }>();
    workerAllApplications.forEach((app) => {
      const current = workerCancelRates.get(app.user_id) || { lastMinuteCancels: 0, totalScheduled: 0 };

      // マッチング済み以上のステータス（キャンセル含む）をカウント
      current.totalScheduled += 1;

      // 直前キャンセルの判定：キャンセルかつ勤務日の前日以降に更新された
      if (app.status === 'CANCELLED') {
        const workDate = new Date(app.workDate.work_date);
        const updatedAt = new Date(app.updated_at);
        const dayBefore = new Date(workDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(0, 0, 0, 0);

        if (updatedAt >= dayBefore) {
          current.lastMinuteCancels += 1;
        }
      }

      workerCancelRates.set(app.user_id, current);
    });

    // ワーカーごとにグループ化
    const workerMap = new Map<
      number,
      {
        user: {
          id: number;
          name: string;
          email: string;
          phoneNumber: string;
          profileImage: string | null;
          qualifications: string[];
        };
        rating: number | null;
        reviewCount: number;
        lastMinuteCancelRate: number;
        applications: {
          id: number;
          status: string;
          createdAt: string;
          job: {
            id: number;
            title: string;
            workDate: string;
            startTime: string;
            endTime: string;
            hourlyWage: number;
          };
        }[];
        latestApplicationAt: Date;
      }
    >();

    applications.forEach((app) => {
      const userId = app.user.id;
      const existing = workerMap.get(userId);

      const applicationData = {
        id: app.id,
        status: app.status,
        createdAt: app.created_at.toISOString(),
        job: {
          id: app.workDate.job.id,
          title: app.workDate.job.title,
          workDate: app.workDate.work_date.toISOString().split('T')[0],
          startTime: app.workDate.job.start_time,
          endTime: app.workDate.job.end_time,
          hourlyWage: app.workDate.job.hourly_wage,
        },
      };

      if (existing) {
        existing.applications.push(applicationData);
        if (app.created_at > existing.latestApplicationAt) {
          existing.latestApplicationAt = app.created_at;
        }
      } else {
        const ratingData = workerRatings.get(userId);
        const cancelData = workerCancelRates.get(userId);

        workerMap.set(userId, {
          user: {
            id: app.user.id,
            name: app.user.name,
            email: app.user.email,
            phoneNumber: app.user.phone_number,
            profileImage: app.user.profile_image,
            qualifications: app.user.qualifications,
          },
          rating: ratingData ? ratingData.total / ratingData.count : null,
          reviewCount: ratingData?.count || 0,
          lastMinuteCancelRate:
            cancelData && cancelData.totalScheduled > 0
              ? (cancelData.lastMinuteCancels / cancelData.totalScheduled) * 100
              : 0,
          applications: [applicationData],
          latestApplicationAt: app.created_at,
        });
      }
    });

    // 最新応募日時順でソート
    const result = Array.from(workerMap.values())
      .sort((a, b) => b.latestApplicationAt.getTime() - a.latestApplicationAt.getTime())
      .map(({ latestApplicationAt, ...rest }) => rest);

    console.log('[getFacilityApplicationsByWorker] Found workers:', result.length);

    return result;
  } catch (error) {
    console.error('[getFacilityApplicationsByWorker] Error:', error);
    return [];
  }
}

/**
 * 施設のマッチング済みワーカー一覧を取得
 */
export async function getFacilityMatchedWorkers(facilityId: number) {
  try {
    const applications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
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
          select: {
            id: true,
            work_date: true,
            job: {
              select: {
                id: true,
                title: true,
                start_time: true,
                end_time: true,
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
      status: app.status,
      user: {
        id: app.user.id,
        name: app.user.name,
        profileImage: app.user.profile_image,
        qualifications: app.user.qualifications,
      },
      job: {
        id: app.workDate.job.id,
        title: app.workDate.job.title,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
      },
    }));
  } catch (error) {
    console.error('[getFacilityMatchedWorkers] Error:', error);
    return [];
  }
}

/**
 * 施設のレビュー一覧を取得（施設管理者向け、詳細情報付き）
 */
export async function getFacilityReviewsForAdmin(facilityId: number) {
  try {
    console.log('[getFacilityReviewsForAdmin] Fetching reviews for facility:', facilityId);

    const reviews = await prisma.review.findMany({
      where: {
        facility_id: facilityId,
        reviewer_type: 'WORKER',
      },
      include: {
        user: {
          select: {
            name: true,
            qualifications: true,
          },
        },
        workDate: {
          select: {
            work_date: true,
            job: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log('[getFacilityReviewsForAdmin] Found reviews:', reviews.length);

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      goodPoints: review.good_points,
      improvements: review.improvements,
      createdAt: review.created_at.toISOString(),
      userName: review.user.name,
      userQualifications: review.user.qualifications,
      jobTitle: review.workDate.job.title,
      jobDate: review.workDate.work_date.toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error('[getFacilityReviewsForAdmin] Error:', error);
    return [];
  }
}

/**
 * 施設のレビュー統計情報を取得（施設管理者向け）
 */
export async function getFacilityReviewStats(facilityId: number) {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        facility_id: facilityId,
        reviewer_type: 'WORKER',
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalCount: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / reviews.length;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const roundedRating = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
      distribution[roundedRating]++;
    });

    return {
      averageRating,
      totalCount: reviews.length,
      distribution,
    };
  } catch (error) {
    console.error('[getFacilityReviewStats] Error:', error);
    return {
      averageRating: 0,
      totalCount: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }
}

/**
 * 応募の詳細情報を取得（施設からの評価画面用）
 */
export async function getApplicationForFacilityReview(applicationId: number, facilityId: number) {
  try {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: 'COMPLETED_PENDING',
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
          select: {
            id: true,
            work_date: true,
            job: {
              select: {
                id: true,
                title: true,
                start_time: true,
                end_time: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return null;
    }

    return {
      applicationId: application.id,
      userId: application.user.id,
      userName: application.user.name,
      userProfileImage: application.user.profile_image,
      userQualifications: application.user.qualifications,
      jobId: application.workDate.job.id,
      jobTitle: application.workDate.job.title,
      jobDate: application.workDate.work_date.toISOString().split('T')[0],
      jobStartTime: application.workDate.job.start_time,
      jobEndTime: application.workDate.job.end_time,
    };
  } catch (error) {
    console.error('[getApplicationForFacilityReview] Error:', error);
    return null;
  }
}

/**
 * 施設からワーカーへのレビューを投稿
 */
export async function submitFacilityReviewForWorker(
  applicationId: number,
  facilityId: number,
  data: {
    rating: number;
    goodPoints?: string;
    improvements?: string;
  }
) {
  try {
    console.log('[submitFacilityReviewForWorker] Submitting review for application:', applicationId);

    // 応募を取得して検証
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: 'COMPLETED_PENDING',
      },
      include: {
        workDate: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!application) {
      return {
        success: false,
        error: '評価対象の応募が見つかりません',
      };
    }

    // 既存のレビューをチェック
    const existingReview = await prisma.review.findFirst({
      where: {
        application_id: applicationId,
        reviewer_type: 'FACILITY',
      },
    });

    if (existingReview) {
      return {
        success: false,
        error: '既に評価済みです',
      };
    }

    // トランザクションでレビュー作成とステータス更新
    await prisma.$transaction(async (tx) => {
      // レビューを作成
      await tx.review.create({
        data: {
          application_id: applicationId,
          work_date_id: application.work_date_id,
          facility_id: facilityId,
          user_id: application.user_id,
          reviewer_type: 'FACILITY',
          rating: data.rating,
          good_points: data.goodPoints || null,
          improvements: data.improvements || null,
        },
      });

      // 応募ステータスを更新
      // ワーカー側のレビューもチェック
      const workerReview = await tx.review.findFirst({
        where: {
          application_id: applicationId,
          reviewer_type: 'WORKER',
        },
      });

      // 双方が評価済みならCOMPLETED_RATED、そうでなければ現状維持
      if (workerReview) {
        await tx.application.update({
          where: { id: applicationId },
          data: {
            status: 'COMPLETED_RATED',
            facility_review_status: 'COMPLETED',
          },
        });
      } else {
        await tx.application.update({
          where: { id: applicationId },
          data: {
            facility_review_status: 'COMPLETED',
          },
        });
      }
    });

    console.log('[submitFacilityReviewForWorker] Review submitted successfully');

    revalidatePath('/admin/workers');
    revalidatePath('/admin/reviews');

    return {
      success: true,
      message: '評価を投稿しました',
    };
  } catch (error) {
    console.error('[submitFacilityReviewForWorker] Error:', error);
    return {
      success: false,
      error: '評価の投稿に失敗しました',
    };
  }
}

// ========================================
// 通知機能 (Notification Functions)
// ========================================

/**
 * 通知を作成（内部ヘルパー関数）
 */
async function createNotification(data: {
  userId: number;
  type: 'APPLICATION_APPROVED' | 'APPLICATION_REJECTED' | 'NEW_MESSAGE' | 'REVIEW_REQUEST' | 'SYSTEM';
  title: string;
  message: string;
  link?: string;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
    console.log('[createNotification] Notification created:', notification.id);
    return notification;
  } catch (error) {
    console.error('[createNotification] Error:', error);
    return null;
  }
}

/**
 * ユーザーの通知一覧を取得
 */
export async function getUserNotifications() {
  try {
    const user = await getAuthenticatedUser();
    console.log('[getUserNotifications] Fetching notifications for user:', user.id);

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: user.id,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 50, // 最新50件
    });

    return notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      isRead: n.read,
      createdAt: n.created_at.toISOString(),
    }));
  } catch (error) {
    console.error('[getUserNotifications] Error:', error);
    return [];
  }
}

/**
 * 施設の通知一覧を取得
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知は将来実装予定
 */
export async function getFacilityNotifications(_facilityId: number) {
  // TODO: 施設向け通知機能を実装する
  console.log('[getFacilityNotifications] Facility notifications not yet implemented');
  return [];
}

/**
 * ユーザーの未読通知数を取得
 */
export async function getUnreadNotificationCount() {
  try {
    const user = await getAuthenticatedUser();

    const count = await prisma.notification.count({
      where: {
        user_id: user.id,
        read: false,
      },
    });

    return count;
  } catch (error) {
    console.error('[getUnreadNotificationCount] Error:', error);
    return 0;
  }
}

/**
 * 施設の未読通知数を取得
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知は将来実装予定
 */
export async function getFacilityUnreadNotificationCount(_facilityId: number) {
  // TODO: 施設向け通知機能を実装する
  console.log('[getFacilityUnreadNotificationCount] Facility notifications not yet implemented');
  return 0;
}

/**
 * 通知を既読にする
 */
export async function markNotificationAsRead(notificationId: number) {
  try {
    const user = await getAuthenticatedUser();

    // ユーザーの通知であることを確認
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        user_id: user.id,
      },
    });

    if (!notification) {
      return { success: false, error: '通知が見つかりません' };
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    revalidatePath('/notifications');

    return { success: true };
  } catch (error) {
    console.error('[markNotificationAsRead] Error:', error);
    return { success: false, error: '通知の更新に失敗しました' };
  }
}

/**
 * ユーザーの全通知を既読にする
 */
export async function markAllNotificationsAsRead() {
  try {
    const user = await getAuthenticatedUser();

    await prisma.notification.updateMany({
      where: {
        user_id: user.id,
        read: false,
      },
      data: {
        read: true,
      },
    });

    revalidatePath('/notifications');

    return { success: true };
  } catch (error) {
    console.error('[markAllNotificationsAsRead] Error:', error);
    return { success: false, error: '通知の更新に失敗しました' };
  }
}

/**
 * 施設の全通知を既読にする
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知は将来実装予定
 */
export async function markAllFacilityNotificationsAsRead(_facilityId: number) {
  // TODO: 施設向け通知機能を実装する
  console.log('[markAllFacilityNotificationsAsRead] Facility notifications not yet implemented');
  return { success: true };
}

// ========================================
// 通知送信ヘルパー関数
// ========================================

/**
 * マッチング成立通知を送信（ワーカー宛）
 */
export async function sendMatchingNotification(
  userId: number,
  jobTitle: string,
  facilityName: string,
  jobId: number
) {
  return createNotification({
    userId,
    type: 'APPLICATION_APPROVED',
    title: 'マッチングが成立しました',
    message: `${facilityName}の「${jobTitle}」への応募が承認されました。`,
    link: `/jobs/${jobId}`,
  });
}

/**
 * 新規応募通知を送信（施設宛）
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知は将来実装予定
 */
export async function sendApplicationNotification(
  _facilityId: number,
  _workerName: string,
  _jobTitle: string,
  _applicationId: number
) {
  // TODO: 施設向け通知機能を実装する
  console.log('[sendApplicationNotification] Facility notifications not yet implemented');
  return null;
}

/**
 * レビュー依頼通知を送信（ワーカー宛）
 */
export async function sendReviewRequestNotification(
  userId: number,
  facilityName: string,
  jobTitle: string,
  applicationId: number
) {
  return createNotification({
    userId,
    type: 'REVIEW_REQUEST',
    title: '評価をお願いします',
    message: `${facilityName}での「${jobTitle}」の勤務が完了しました。評価をお願いします。`,
    link: `/mypage/reviews/${applicationId}`,
  });
}

/**
 * レビュー受信通知を送信（施設宛）
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知は将来実装予定
 */
export async function sendReviewReceivedNotificationToFacility(
  _facilityId: number,
  _workerName: string,
  _rating: number
) {
  // TODO: 施設向け通知機能を実装する
  console.log('[sendReviewReceivedNotificationToFacility] Facility notifications not yet implemented');
  return null;
}

/**
 * メッセージ受信通知を送信（ワーカー宛）
 */
export async function sendMessageNotificationToWorker(
  userId: number,
  facilityName: string,
  applicationId: number
) {
  return createNotification({
    userId,
    type: 'NEW_MESSAGE',
    title: '新しいメッセージが届きました',
    message: `${facilityName}からメッセージが届きました。`,
    link: `/messages/${applicationId}`,
  });
}

/**
 * メッセージ受信通知を送信（施設宛）
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知は将来実装予定
 */
export async function sendMessageNotificationToFacility(
  _facilityId: number,
  _workerName: string,
  _applicationId: number
) {
  // TODO: 施設向け通知機能を実装する
  console.log('[sendMessageNotificationToFacility] Facility notifications not yet implemented');
  return null;
}

// ========================================
// 施設情報の取得・更新
// ========================================

/**
 * 施設情報を取得
 */
export async function getFacilityInfo(facilityId: number) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  });

  if (!facility) {
    return null;
  }

  return {
    id: facility.id,
    corporationName: facility.corporation_name,
    facilityName: facility.facility_name,
    facilityType: facility.facility_type,
    address: facility.address,
    lat: facility.lat,
    lng: facility.lng,
    phoneNumber: facility.phone_number,
    description: facility.description,
    images: facility.images,
    rating: facility.rating,
    reviewCount: facility.review_count,
    initialMessage: facility.initial_message,
  };
}

/**
 * 施設の初回メッセージを更新
 */
export async function updateFacilityInitialMessage(
  facilityId: number,
  initialMessage: string
) {
  try {
    await prisma.facility.update({
      where: { id: facilityId },
      data: { initial_message: initialMessage },
    });

    revalidatePath('/admin/facility');
    return { success: true };
  } catch (error) {
    console.error('Failed to update initial message:', error);
    return { success: false, error: 'Failed to update initial message' };
  }
}

/**
 * 施設情報を更新（基本情報）
 */
export async function updateFacilityBasicInfo(
  facilityId: number,
  data: {
    corporationName?: string;
    facilityName?: string;
    facilityType?: string;
    address?: string;
    phoneNumber?: string;
    description?: string;
    initialMessage?: string;
  }
) {
  try {
    const updateData: any = {};

    if (data.corporationName !== undefined) updateData.corporation_name = data.corporationName;
    if (data.facilityName !== undefined) updateData.facility_name = data.facilityName;
    if (data.facilityType !== undefined) updateData.facility_type = data.facilityType;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.initialMessage !== undefined) updateData.initial_message = data.initialMessage;

    await prisma.facility.update({
      where: { id: facilityId },
      data: updateData,
    });

    revalidatePath('/admin/facility');
    return { success: true };
  } catch (error) {
    console.error('Failed to update facility info:', error);
    return { success: false, error: 'Failed to update facility info' };
  }
}

/**
 * 管理者ダッシュボード用の統計情報を取得
 */
export async function getAdminDashboardStats(facilityId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 施設の全求人とworkDatesを取得
  const jobs = await prisma.job.findMany({
    where: { facility_id: facilityId },
    include: {
      workDates: {
        include: {
          applications: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  });

  // 統計計算
  const totalJobs = jobs.length;

  // アクティブな求人（締切前の勤務日がある求人）
  const activeJobs = jobs.filter((job) => {
    return job.status === 'PUBLISHED' && job.workDates.some((wd) => new Date(wd.deadline) > today);
  }).length;

  // 全応募数
  const totalApplications = jobs.reduce((sum, job) => {
    return sum + job.workDates.reduce((wdSum, wd) => wdSum + wd.applications.length, 0);
  }, 0);

  // 本日の勤務がある勤務日数
  const todayJobs = jobs.reduce((count, job) => {
    return count + job.workDates.filter((wd) => {
      const workDate = new Date(wd.work_date);
      workDate.setHours(0, 0, 0, 0);
      return workDate.getTime() === today.getTime();
    }).length;
  }, 0);

  return {
    totalJobs,
    activeJobs,
    totalApplications,
    todayJobs,
  };
}

/**
 * 管理者ダッシュボード用の求人タスク一覧を取得
 */
export async function getAdminDashboardTasks(facilityId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  // 施設の全求人とworkDatesを取得
  const jobs = await prisma.job.findMany({
    where: { facility_id: facilityId },
    include: {
      workDates: {
        include: {
          applications: {
            where: {
              status: 'APPLIED',
            },
            select: {
              id: true,
              status: true,
              created_at: true,
            },
          },
        },
      },
    },
  });

  // 締切が近い求人（3日以内の締切を持つworkDateがある）
  const deadlineSoon: { id: number; title: string; deadline: string }[] = [];
  jobs.forEach((job) => {
    if (job.status !== 'PUBLISHED') return;
    job.workDates.forEach((wd) => {
      const deadline = new Date(wd.deadline);
      if (deadline > today && deadline <= threeDaysLater) {
        deadlineSoon.push({
          id: job.id,
          title: job.title,
          deadline: wd.deadline.toISOString(),
        });
      }
    });
  });

  // 応募が少ない求人（応募率50%未満のworkDateがある）
  const lowApplications: { id: number; title: string; appliedCount: number; recruitmentCount: number }[] = [];
  jobs.forEach((job) => {
    if (job.status !== 'PUBLISHED') return;
    job.workDates.forEach((wd) => {
      const isActive = new Date(wd.deadline) > today;
      const applicationRate = wd.recruitment_count > 0
        ? (wd.applied_count / wd.recruitment_count) * 100
        : 0;
      if (isActive && applicationRate < 50) {
        lowApplications.push({
          id: job.id,
          title: job.title,
          appliedCount: wd.applied_count,
          recruitmentCount: wd.recruitment_count,
        });
      }
    });
  });

  // 新しい応募がある求人
  const newApplications: { id: number; title: string; appliedCount: number }[] = [];
  jobs.forEach((job) => {
    const totalApplied = job.workDates.reduce((sum, wd) => sum + wd.applications.length, 0);
    if (totalApplied > 0) {
      newApplications.push({
        id: job.id,
        title: job.title,
        appliedCount: totalApplied,
      });
    }
  });

  // 本日の勤務予定
  const todayJobs: { id: number; title: string; startTime: string; endTime: string; appliedCount: number }[] = [];
  jobs.forEach((job) => {
    job.workDates.forEach((wd) => {
      const workDate = new Date(wd.work_date);
      workDate.setHours(0, 0, 0, 0);
      if (workDate.getTime() === today.getTime()) {
        todayJobs.push({
          id: job.id,
          title: job.title,
          startTime: job.start_time,
          endTime: job.end_time,
          appliedCount: wd.applied_count,
        });
      }
    });
  });

  return {
    deadlineSoon,
    lowApplications: lowApplications.slice(0, 10),
    newApplications: newApplications.slice(0, 5),
    todayJobs,
  };
}

/**
 * 管理者求人管理画面用の求人一覧を取得
 */


/**
 * 施設管理者ログイン（DBベース）
 */
export async function authenticateFacilityAdmin(email: string, password: string) {
  try {
    const admin = await prisma.facilityAdmin.findUnique({
      where: { email },
      include: {
        facility: {
          select: {
            id: true,
            facility_name: true,
          },
        },
      },
    });

    if (!admin) {
      return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
    }

    // 注意: 本番ではbcryptなどでパスワードをハッシュ化すべき
    // シードデータでは 'admin123' がパスワード
    if (admin.password_hash !== password) {
      return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
    }

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        facilityId: admin.facility_id,
        name: admin.name,
        phone: admin.phone_number || undefined,
        role: 'admin' as const,
        facilityName: admin.facility?.facility_name || '',
      },
    };
  } catch (error) {
    console.error('Admin authentication error:', error);
    return { success: false, error: '認証中にエラーが発生しました' };
  }
}

/**
 * 管理者用の求人テンプレート一覧を取得
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
 * 管理者用: 求人を作成（複数の勤務日に対応）
 */
export interface CreateJobInput {
  facilityId: number;
  templateId?: number | null;
  title: string;
  workDates: string[]; // YYYY-MM-DD形式の配列
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakTime: number; // 休憩時間（分）
  hourlyWage: number;
  transportationFee: number;
  recruitmentCount: number;
  workContent: string[];
  jobDescription: string;
  qualifications: string[];
  skills: string[];
  dresscode: string[];
  belongings: string[];
  icons: string[]; // こだわり条件
  images?: string[]; // 求人画像URL配列
  dresscodeImages?: string[]; // 服装サンプル画像URL配列
  attachments?: string[]; // 添付ファイルURL配列
  // 募集期間設定
  recruitmentStartDay: number;
  recruitmentStartTime?: string;
  recruitmentEndDay: number;
  recruitmentEndTime?: string;
  // 募集条件
  weeklyFrequency?: number | null; // 週N回以上
  monthlyCommitment?: boolean; // 1ヶ月以上勤務
}

export async function createJobs(input: CreateJobInput) {
  console.log('[createJobs] Input:', JSON.stringify(input, null, 2));

  // 施設情報を取得
  const facility = await prisma.facility.findUnique({
    where: { id: input.facilityId },
  });

  if (!facility) {
    return { success: false, error: '施設が見つかりません' };
  }

  // 日給を計算
  const calculateWage = (startTime: string, endTime: string, breakMinutes: number, hourlyWage: number, transportFee: number) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // 日跨ぎの場合

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

  // 休憩時間文字列を作成
  const breakTimeStr = `${input.breakTime}分`;

  // アイコンからこだわり条件フラグを設定
  const conditionFlags = {
    no_bathing_assist: input.icons.includes('入浴介助なし'),
    has_driver: input.icons.includes('送迎ドライバーあり'),
    hair_style_free: input.icons.includes('髪型・髪色自由'),
    nail_ok: input.icons.includes('ネイルOK'),
    uniform_provided: input.icons.includes('制服貸与'),
    inexperienced_ok: input.icons.includes('介護業務未経験歓迎'),
    beginner_ok: input.icons.includes('SWORK初心者歓迎'),
    facility_within_5years: input.icons.includes('施設オープン5年以内'),
    allow_car: input.icons.includes('車通勤可') || input.icons.includes('車'),
    allow_bike: input.icons.includes('バイク通勤可') || input.icons.includes('バイク'),
    allow_bicycle: input.icons.includes('自転車通勤可') || input.icons.includes('自転車'),
    allow_public_transit: input.icons.includes('公共交通機関') || input.icons.includes('電車・バス'),
    has_parking: input.icons.includes('駐車場あり'),
  };

  // 1つのJobを作成
  const job = await prisma.job.create({
    data: {
      facility_id: input.facilityId,
      template_id: input.templateId || null,
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
      address: facility.address,
      access: '施設へのアクセス情報',
      recruitment_count: input.recruitmentCount,
      overview: input.jobDescription,
      work_content: input.workContent,
      required_qualifications: input.qualifications,
      required_experience: input.skills,
      dresscode: input.dresscode,
      belongings: input.belongings,
      manager_name: '担当者',
      images: input.images && input.images.length > 0 ? input.images : (facility.images || []),
      dresscode_images: input.dresscodeImages || [],
      attachments: input.attachments || [],
      // こだわり条件フラグ
      ...conditionFlags,
      // 募集条件
      weekly_frequency: input.weeklyFrequency || null,
      monthly_commitment: input.monthlyCommitment || false,
    },
  });

  // 複数のJobWorkDateを作成
  const workDates = input.workDates.map(dateStr => {
    const workDate = new Date(dateStr);
    const deadline = new Date(workDate);

    // 締切日時の計算
    if (input.recruitmentEndDay === 0) {
      // 当日
      if (input.recruitmentEndTime) {
        const [h, m] = input.recruitmentEndTime.split(':').map(Number);
        deadline.setHours(h, m, 0, 0);
      } else {
        deadline.setHours(5, 0, 0, 0);
      }
    } else {
      // 前日以前
      deadline.setDate(deadline.getDate() - (input.recruitmentEndDay || 1));
      deadline.setHours(23, 59, 59, 999);
    }

    return {
      job_id: job.id,
      work_date: workDate,
      deadline: deadline,
      recruitment_count: input.recruitmentCount,
      applied_count: 0,
    };
  });

  await prisma.jobWorkDate.createMany({
    data: workDates,
  });

  return { success: true, jobId: job.id };
}


/**
 * 管理者用: 求人テンプレートを取得（単一）
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
    icons: template.tags, // アイコンはタグとして保存されている想定
    workContent: template.work_content || [],
  };
}

/**
 * 管理者用: テンプレートを作成
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
 * 管理者用: テンプレートを更新
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

/**
 * 管理者用: ワーカー詳細を取得
 */
export async function getWorkerDetail(workerId: number, facilityId: number) {
  try {
    // この施設の求人に応募したことがあるワーカーかどうか確認
    const hasApplications = await prisma.application.findFirst({
      where: {
        user_id: workerId,
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
      },
    });

    if (!hasApplications) {
      return null;
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: workerId },
    });

    if (!user) {
      return null;
    }

    // この施設での勤務履歴を取得（完了済み）
    const ourFacilityCompletedApps = await prisma.application.findMany({
      where: {
        user_id: workerId,
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: {
          in: ['COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
      include: {
        workDate: {
          include: {
            job: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // この施設からのレビュー（ワーカーへの評価）を取得
    const ourFacilityReviews = await prisma.review.findMany({
      where: {
        user_id: workerId,
        facility_id: facilityId,
        reviewer_type: 'FACILITY',
      },
      include: {
        workDate: {
          include: {
            job: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 評価の平均を計算（自社）
    const ourAvgRating = ourFacilityReviews.length > 0
      ? ourFacilityReviews.reduce((sum, r) => sum + r.rating, 0) / ourFacilityReviews.length
      : 0;

    // ========================================
    // 追加データ取得：全施設での情報
    // ========================================

    // 全施設からのレビュー（全体評価）
    const allReviews = await prisma.review.findMany({
      where: {
        user_id: workerId,
        reviewer_type: 'FACILITY',
      },
      include: {
        facility: {
          select: {
            facility_type: true,
          },
        },
      },
    });

    const totalAvgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    // 施設種別ごとの評価を集計
    const facilityTypeRatings: Record<string, { total: number; count: number }> = {};
    allReviews.forEach((r) => {
      const type = r.facility.facility_type;
      if (!facilityTypeRatings[type]) {
        facilityTypeRatings[type] = { total: 0, count: 0 };
      }
      facilityTypeRatings[type].total += r.rating;
      facilityTypeRatings[type].count += 1;
    });

    const ratingsByFacilityType = Object.entries(facilityTypeRatings).map(([type, data]) => ({
      facilityType: type,
      averageRating: data.total / data.count,
      reviewCount: data.count,
    }));

    // 他社勤務回数を取得
    const otherFacilityApps = await prisma.application.count({
      where: {
        user_id: workerId,
        workDate: {
          job: {
            facility_id: { not: facilityId },
          },
        },
        status: {
          in: ['COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
    });

    // 全応募を取得してキャンセル率を計算
    const allApplications = await prisma.application.findMany({
      where: {
        user_id: workerId,
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
        },
      },
      include: {
        workDate: {
          select: {
            work_date: true,
          },
        },
      },
    });

    // キャンセル率計算
    const cancelledApps = allApplications.filter((app) => app.status === 'CANCELLED');
    const cancelRate = allApplications.length > 0
      ? (cancelledApps.length / allApplications.length) * 100
      : 0;

    // 直前キャンセル率計算（勤務日の前日以降にキャンセル）
    let lastMinuteCancelCount = 0;
    cancelledApps.forEach((app) => {
      const workDate = new Date(app.workDate.work_date);
      const updatedAt = new Date(app.updated_at);
      const dayBefore = new Date(workDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(0, 0, 0, 0);
      if (updatedAt >= dayBefore) {
        lastMinuteCancelCount += 1;
      }
    });
    const lastMinuteCancelRate = allApplications.length > 0
      ? (lastMinuteCancelCount / allApplications.length) * 100
      : 0;

    // 直近の勤務予定を取得（SCHEDULED状態で未来の日付）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingSchedules = await prisma.application.findMany({
      where: {
        user_id: workerId,
        status: 'SCHEDULED',
        workDate: {
          work_date: { gte: today },
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
                facility: {
                  select: {
                    facility_name: true,
                  },
                },
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
      take: 30,
    });

    // 年齢計算
    let age: number | null = null;
    if (user.birth_date) {
      const birthDate = new Date(user.birth_date);
      const ageDiff = today.getTime() - birthDate.getTime();
      age = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone_number,
      profileImage: user.profile_image,
      qualifications: user.qualifications,
      birthDate: user.birth_date ? user.birth_date.toISOString().split('T')[0] : null,
      age,
      // 追加フィールド（2024-12-01）
      gender: user.gender,
      nationality: user.nationality,
      lastNameKana: user.last_name_kana,
      firstNameKana: user.first_name_kana,
      // 住所
      postalCode: user.postal_code,
      prefecture: user.prefecture,
      city: user.city,
      addressLine: user.address_line,
      building: user.building,
      // 緊急連絡先
      emergencyName: user.emergency_name,
      emergencyRelation: user.emergency_relation,
      emergencyPhone: user.emergency_phone,
      emergencyAddress: user.emergency_address,
      // 働き方・希望
      currentWorkStyle: user.current_work_style,
      desiredWorkStyle: user.desired_work_style,
      jobChangeDesire: user.job_change_desire,
      desiredWorkDaysPerWeek: user.desired_work_days_week,
      desiredWorkPeriod: user.desired_work_period,
      desiredWorkDays: user.desired_work_days,
      desiredStartTime: user.desired_start_time,
      desiredEndTime: user.desired_end_time,
      // 経験
      experienceFields: user.experience_fields as Record<string, string> | null,
      workHistories: user.work_histories,
      // 自己PR
      selfPR: user.self_pr,
      // 銀行口座
      bankName: user.bank_name,
      branchName: user.branch_name,
      accountName: user.account_name,
      accountNumber: user.account_number,
      // その他
      pensionNumber: user.pension_number,
      // 自社データ
      ourFacilityWorkDays: ourFacilityCompletedApps.length,
      ourFacilityAvgRating: ourAvgRating,
      ourFacilityReviewCount: ourFacilityReviews.length,
      // 全体データ
      totalWorkDays: ourFacilityCompletedApps.length + otherFacilityApps,
      otherFacilityWorkDays: otherFacilityApps,
      totalAvgRating,
      totalReviewCount: allReviews.length,
      // キャンセル率
      cancelRate,
      lastMinuteCancelRate,
      // 施設種別ごとの評価
      ratingsByFacilityType,
      // 直近勤務予定
      upcomingSchedules: upcomingSchedules.map((app) => ({
        id: app.id,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
        jobTitle: app.workDate.job.title,
        facilityName: app.workDate.job.facility.facility_name,
      })),
      // 勤務履歴（自社）
      workHistory: ourFacilityCompletedApps.map((app) => ({
        id: app.id,
        jobTitle: app.workDate.job.title,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        status: app.status,
      })),
      // 評価履歴（自社）
      evaluations: ourFacilityReviews.map((r) => ({
        id: r.id,
        jobTitle: r.workDate.job.title,
        jobDate: r.workDate.work_date.toISOString().split('T')[0],
        rating: r.rating,
        comment: r.good_points,
      })),
      // お気に入り・ブロック状態を取得
      isFavorite: await prisma.bookmark.findFirst({
        where: {
          facility_id: facilityId,
          target_user_id: workerId,
          type: 'FAVORITE',
        },
      }).then(b => !!b),
      isBlocked: await prisma.bookmark.findFirst({
        where: {
          facility_id: facilityId,
          target_user_id: workerId,
          type: 'WATCH_LATER', // WATCH_LATERをブロック扱いとして使用
        },
      }).then(b => !!b),
    };
  } catch (error) {
    console.error('[getWorkerDetail] Error:', error);
    return null;
  }
}

/**
 * ワーカーのお気に入りをトグル
 */
export async function toggleWorkerFavorite(workerId: number, facilityId: number): Promise<{ success: boolean; isFavorite?: boolean; error?: string }> {
  try {
    const existing = await prisma.bookmark.findFirst({
      where: {
        facility_id: facilityId,
        target_user_id: workerId,
        type: 'FAVORITE',
      },
    });

    if (existing) {
      await prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return { success: true, isFavorite: false };
    } else {
      await prisma.bookmark.create({
        data: {
          facility_id: facilityId,
          target_user_id: workerId,
          type: 'FAVORITE',
        },
      });
      return { success: true, isFavorite: true };
    }
  } catch (error) {
    console.error('[toggleWorkerFavorite] Error:', error);
    return { success: false, error: 'お気に入りの更新に失敗しました' };
  }
}

/**
 * ワーカーのブロックをトグル（WATCH_LATERをブロック扱いとして使用）
 */
export async function toggleWorkerBlock(workerId: number, facilityId: number): Promise<{ success: boolean; isBlocked?: boolean; error?: string }> {
  try {
    const existing = await prisma.bookmark.findFirst({
      where: {
        facility_id: facilityId,
        target_user_id: workerId,
        type: 'WATCH_LATER',
      },
    });

    if (existing) {
      await prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return { success: true, isBlocked: false };
    } else {
      await prisma.bookmark.create({
        data: {
          facility_id: facilityId,
          target_user_id: workerId,
          type: 'WATCH_LATER',
        },
      });
      return { success: true, isBlocked: true };
    }
  } catch (error) {
    console.error('[toggleWorkerBlock] Error:', error);
    return { success: false, error: 'ブロックの更新に失敗しました' };
  }
}

/**
 * 複数の求人を一括削除する
 * 注: スキーマでonDelete: Cascadeが設定されているため、
 * 関連するApplication, Review, Bookmark, Messageは自動削除される
 */
export async function deleteJobs(jobIds: number[], facilityId: number): Promise<{ success: boolean; message: string; deletedCount?: number }> {
  try {
    // 削除前に、対象の求人がこの施設に属しているか確認
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

    // 求人を削除（関連データはonDelete: Cascadeで自動削除される）
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
 * 複数の求人のステータスを一括更新する
 */
export async function updateJobsStatus(
  jobIds: number[],
  facilityId: number,
  status: 'PUBLISHED' | 'STOPPED'
): Promise<{ success: boolean; message: string; updatedCount?: number }> {
  try {
    // 更新前に、対象の求人がこの施設に属しているか確認
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

    // 求人のステータスを更新
    const result = await prisma.job.updateMany({
      where: { id: { in: validJobIds } },
      data: { status },
    });

    revalidatePath('/admin/jobs');

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
 * 管理者用: 求人を更新
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
    // 勤務日の操作
    addWorkDates?: string[];      // 追加する日付
    removeWorkDateIds?: number[]; // 削除するWorkDateのID
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

    // 日給を計算
    const breakTimeMinutes = data.breakTime;

    const calculateWage = (startTime: string, endTime: string, breakMinutes: number, hourlyWage: number, transportFee: number) => {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (totalMinutes < 0) totalMinutes += 24 * 60; // 日跨ぎの場合

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

    // Jobを更新（条件部分）
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
        updated_at: new Date(),
      },
    });

    // 既存のWorkDateの募集人数を更新
    await prisma.jobWorkDate.updateMany({
      where: { job_id: jobId },
      data: { recruitment_count: data.recruitmentCount },
    });

    // 勤務日を追加
    if (data.addWorkDates && data.addWorkDates.length > 0) {
      const newWorkDates = data.addWorkDates.map(dateStr => {
        const workDate = new Date(dateStr);
        const deadline = new Date(workDate);
        deadline.setDate(deadline.getDate() - 1);
        deadline.setHours(23, 59, 59, 999);

        return {
          job_id: jobId,
          work_date: workDate,
          deadline: deadline,
          recruitment_count: data.recruitmentCount,
          applied_count: 0,
        };
      });

      await prisma.jobWorkDate.createMany({
        data: newWorkDates,
        skipDuplicates: true, // 重複を無視
      });
    }

    // 勤務日を削除（応募がないもののみ）
    if (data.removeWorkDateIds && data.removeWorkDateIds.length > 0) {
      await prisma.jobWorkDate.deleteMany({
        where: {
          id: { in: data.removeWorkDateIds },
          job_id: jobId,
          applied_count: 0, // 応募がないもののみ削除可能
        },
      });
    }

    revalidatePath('/admin/jobs');
    return { success: true };
  } catch (error) {
    console.error('[updateJob] Error:', error);
    return { success: false, error: '求人の更新に失敗しました' };
  }
}

// ========================================
// ワーカー一覧（施設管理者向け）
// ========================================

export type WorkerListStatus = 'NOT_STARTED' | 'WORKING' | 'COMPLETED' | 'CANCELLED';

export interface WorkerListItem {
  userId: number;
  name: string;
  profileImage: string | null;
  qualifications: string[];
  prefecture: string | null;
  city: string | null;
  // ステータス
  statuses: WorkerListStatus[];
  hasCompleted: boolean;
  hasCancelled: boolean;
  // 統計（自社）
  ourWorkCount: number;          // この施設での勤務回数
  lastOurWorkDate: string | null; // この施設での最終勤務日
  // 統計（他社）
  otherWorkCount: number;        // 他社での勤務回数
  lastOtherWorkDate: string | null; // 他社での最終勤務日
  // 統計（合計）
  totalWorkCount: number;        // 総勤務回数
  lastWorkDate: string | null;   // 最終勤務日（自社/他社問わず）
  lastWorkFacilityType: 'our' | 'other' | null; // 最終勤務が自社か他社か
  // キャンセル率
  cancelRate: number;            // キャンセル率（%）
  lastMinuteCancelRate: number;  // 直前キャンセル率（%）
  // 経験分野
  experienceFields: Record<string, string> | null; // {"特養": "3年", ...}
  // 評価
  avgRating: number | null;
  reviewCount: number;
  // ブックマーク状態
  isFavorite: boolean;
  isBlocked: boolean;
}

interface WorkerListSearchParams {
  keyword?: string;           // 氏名・住所で検索
  status?: WorkerListStatus | 'all';
  jobCategory?: 'kaigo' | 'kango' | 'yakuzai' | 'all'; // 介護・看護・薬剤師
  sortBy?: 'workCount_desc' | 'workCount_asc' | 'lastWorkDate_desc' | 'lastWorkDate_asc';
}

/**
 * 施設にマッチしたワーカー一覧を取得（検索・フィルター・並び替え対応）
 */
export async function getWorkerListForFacility(
  facilityId: number,
  params?: WorkerListSearchParams
) {
  try {
    console.log('[getWorkerListForFacility] Fetching workers for facility:', facilityId);

    // この施設にマッチしたユーザーを取得（SCHEDULED以上のステータス）
    const ourApplications = await prisma.application.findMany({
      where: {
        workDate: {
          job: {
            facility_id: facilityId,
          },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile_image: true,
            qualifications: true,
            prefecture: true,
            city: true,
            experience_fields: true,
          },
        },
        workDate: {
          select: {
            work_date: true,
          },
        },
      },
    });

    // ユーザーIDを抽出
    const userIds = Array.from(new Set(ourApplications.map(app => app.user.id)));

    if (userIds.length === 0) {
      return [];
    }

    // 他社での勤務データを取得
    const otherApplications = await prisma.application.findMany({
      where: {
        user_id: { in: userIds },
        workDate: {
          job: {
            facility_id: { not: facilityId },
          },
        },
        status: {
          in: ['COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
      include: {
        workDate: {
          select: {
            work_date: true,
          },
        },
      },
    });

    // お気に入り・ブロック状態を取得
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        facility_id: facilityId,
        target_user_id: { in: userIds },
      },
      select: {
        target_user_id: true,
        type: true,
      },
    });

    // ブックマークをマップ化
    const favoriteSet = new Set<number>();
    const blockedSet = new Set<number>();
    for (const b of bookmarks) {
      if (b.target_user_id) {
        if (b.type === 'FAVORITE') {
          favoriteSet.add(b.target_user_id);
        }
        // ブロックはBOOKMARK_TYPEにないため、別テーブルが必要かもしれないが、
        // 現状はFAVORITE以外をブロックとして扱うか、別途管理が必要
        // ここでは暫定的にWATCH_LATERをブロックとして扱わない
      }
    }

    // 自社での勤務データを集計
    const ourDataMap = new Map<number, {
      user: typeof ourApplications[0]['user'];
      statuses: Set<string>;
      completedDates: Date[];
      cancelledCount: number;
      totalApplications: number; // キャンセル率計算用
    }>();

    for (const app of ourApplications) {
      const existing = ourDataMap.get(app.user.id);
      const isCompleted = app.status === 'COMPLETED_PENDING' || app.status === 'COMPLETED_RATED';
      const isCancelled = app.status === 'CANCELLED';

      if (existing) {
        existing.statuses.add(app.status);
        existing.totalApplications++;
        if (isCompleted) {
          existing.completedDates.push(app.workDate.work_date);
        }
        if (isCancelled) {
          existing.cancelledCount++;
        }
      } else {
        ourDataMap.set(app.user.id, {
          user: app.user,
          statuses: new Set([app.status]),
          completedDates: isCompleted ? [app.workDate.work_date] : [],
          cancelledCount: isCancelled ? 1 : 0,
          totalApplications: 1,
        });
      }
    }

    // 他社での勤務データを集計
    const otherDataMap = new Map<number, {
      completedDates: Date[];
    }>();

    for (const app of otherApplications) {
      const existing = otherDataMap.get(app.user_id);
      if (existing) {
        existing.completedDates.push(app.workDate.work_date);
      } else {
        otherDataMap.set(app.user_id, {
          completedDates: [app.workDate.work_date],
        });
      }
    }

    // 各ワーカーの評価を取得（自社のみ）
    const reviews = await prisma.review.findMany({
      where: {
        user_id: { in: userIds },
        facility_id: facilityId,
        reviewer_type: 'FACILITY',
      },
      select: {
        user_id: true,
        rating: true,
      },
    });

    // ユーザーごとの評価を集計
    const reviewMap = new Map<number, { totalRating: number; count: number }>();
    for (const review of reviews) {
      const existing = reviewMap.get(review.user_id);
      if (existing) {
        existing.totalRating += review.rating;
        existing.count++;
      } else {
        reviewMap.set(review.user_id, {
          totalRating: review.rating,
          count: 1,
        });
      }
    }

    // 結果を構築
    let workers: WorkerListItem[] = Array.from(ourDataMap.entries()).map(([userId, data]) => {
      const reviewData = reviewMap.get(userId);
      const otherData = otherDataMap.get(userId);
      const statusSet = data.statuses;

      // ステータスを判定
      const statuses: WorkerListStatus[] = [];
      const hasCompleted = statusSet.has('COMPLETED_PENDING') || statusSet.has('COMPLETED_RATED');
      const hasCancelled = statusSet.has('CANCELLED');
      const hasScheduled = statusSet.has('SCHEDULED');
      const hasWorking = statusSet.has('WORKING');

      if (hasScheduled && !hasCompleted) {
        statuses.push('NOT_STARTED');
      }
      if (hasWorking) {
        statuses.push('WORKING');
      }
      if (hasCompleted) {
        statuses.push('COMPLETED');
      }
      if (hasCancelled) {
        statuses.push('CANCELLED');
      }

      // 自社の最終勤務日
      const ourSortedDates = data.completedDates.sort((a, b) => b.getTime() - a.getTime());
      const lastOurWorkDate = ourSortedDates.length > 0
        ? ourSortedDates[0].toISOString().split('T')[0]
        : null;

      // 他社の最終勤務日
      const otherSortedDates = otherData
        ? otherData.completedDates.sort((a, b) => b.getTime() - a.getTime())
        : [];
      const lastOtherWorkDate = otherSortedDates.length > 0
        ? otherSortedDates[0].toISOString().split('T')[0]
        : null;

      // 全体の最終勤務日と施設タイプ
      let lastWorkDate: string | null = null;
      let lastWorkFacilityType: 'our' | 'other' | null = null;

      if (lastOurWorkDate && lastOtherWorkDate) {
        if (new Date(lastOurWorkDate) >= new Date(lastOtherWorkDate)) {
          lastWorkDate = lastOurWorkDate;
          lastWorkFacilityType = 'our';
        } else {
          lastWorkDate = lastOtherWorkDate;
          lastWorkFacilityType = 'other';
        }
      } else if (lastOurWorkDate) {
        lastWorkDate = lastOurWorkDate;
        lastWorkFacilityType = 'our';
      } else if (lastOtherWorkDate) {
        lastWorkDate = lastOtherWorkDate;
        lastWorkFacilityType = 'other';
      }

      // 勤務回数
      const ourWorkCount = data.completedDates.length;
      const otherWorkCount = otherData?.completedDates.length || 0;
      const totalWorkCount = ourWorkCount + otherWorkCount;

      // キャンセル率（自社）
      const cancelRate = data.totalApplications > 0
        ? (data.cancelledCount / data.totalApplications) * 100
        : 0;

      // 経験分野
      const experienceFields = data.user.experience_fields as Record<string, string> | null;

      return {
        userId,
        name: data.user.name,
        profileImage: data.user.profile_image,
        qualifications: data.user.qualifications,
        prefecture: data.user.prefecture,
        city: data.user.city,
        statuses,
        hasCompleted,
        hasCancelled,
        ourWorkCount,
        lastOurWorkDate,
        otherWorkCount,
        lastOtherWorkDate,
        totalWorkCount,
        lastWorkDate,
        lastWorkFacilityType,
        cancelRate,
        lastMinuteCancelRate: 0, // TODO: 直前キャンセルの定義が必要
        experienceFields,
        avgRating: reviewData ? reviewData.totalRating / reviewData.count : null,
        reviewCount: reviewData?.count || 0,
        isFavorite: favoriteSet.has(userId),
        isBlocked: blockedSet.has(userId),
      };
    });

    // キーワード検索（氏名・住所）
    if (params?.keyword) {
      const keyword = params.keyword.toLowerCase();
      workers = workers.filter(w =>
        w.name.toLowerCase().includes(keyword) ||
        (w.prefecture && w.prefecture.toLowerCase().includes(keyword)) ||
        (w.city && w.city.toLowerCase().includes(keyword))
      );
    }

    // ステータスフィルター
    if (params?.status && params.status !== 'all') {
      workers = workers.filter(w => w.statuses.includes(params.status as WorkerListStatus));
    }

    // 資格フィルター（介護・看護・薬剤師）
    if (params?.jobCategory && params.jobCategory !== 'all') {
      const kaigoQuals = ['介護福祉士', '介護職員初任者研修', '実務者研修', 'ケアマネージャー'];
      const kangoQuals = ['看護師', '准看護師'];
      const yakuzaiQuals = ['薬剤師'];

      let targetQuals: string[] = [];
      switch (params.jobCategory) {
        case 'kaigo':
          targetQuals = kaigoQuals;
          break;
        case 'kango':
          targetQuals = kangoQuals;
          break;
        case 'yakuzai':
          targetQuals = yakuzaiQuals;
          break;
      }

      workers = workers.filter(w =>
        w.qualifications.some(q => targetQuals.some(tq => q.includes(tq)))
      );
    }

    // 並び替え
    switch (params?.sortBy) {
      case 'workCount_desc':
        workers.sort((a, b) => b.totalWorkCount - a.totalWorkCount);
        break;
      case 'workCount_asc':
        workers.sort((a, b) => a.totalWorkCount - b.totalWorkCount);
        break;
      case 'lastWorkDate_desc':
        workers.sort((a, b) => {
          if (!a.lastWorkDate && !b.lastWorkDate) return 0;
          if (!a.lastWorkDate) return 1;
          if (!b.lastWorkDate) return -1;
          return new Date(b.lastWorkDate).getTime() - new Date(a.lastWorkDate).getTime();
        });
        break;
      case 'lastWorkDate_asc':
        workers.sort((a, b) => {
          if (!a.lastWorkDate && !b.lastWorkDate) return 0;
          if (!a.lastWorkDate) return 1;
          if (!b.lastWorkDate) return -1;
          return new Date(a.lastWorkDate).getTime() - new Date(b.lastWorkDate).getTime();
        });
        break;
      default:
        // デフォルト: 勤務回数多い順
        workers.sort((a, b) => b.totalWorkCount - a.totalWorkCount);
    }

    return workers;
  } catch (error) {
    console.error('[getWorkerListForFacility] Error:', error);
    return [];
  }
}

