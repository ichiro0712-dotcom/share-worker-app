'use server';

import { prisma } from './prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * テスト運用中の認証済みユーザーを取得する共通ヘルパー関数
 * 常にID=1のユーザーを使用し、存在しない場合は自動作成する
 */
async function getAuthenticatedUser() {
  // ID=1のユーザーを取得
  let user = await prisma.user.findUnique({
    where: { id: 1 },
  });

  // ユーザーが存在しない場合は作成
  if (!user) {
    console.log('[getAuthenticatedUser] User with ID=1 not found, creating...');
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password_hash: 'test_password',
        name: 'テストユーザー',
        phone_number: '090-0000-0000',
        qualifications: [],
      },
    });
    console.log('[getAuthenticatedUser] Test user created with ID:', user.id);
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

export async function hasUserAppliedForJob(jobId: string): Promise<boolean> {
  try {
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return false;
    }

    const user = await getAuthenticatedUser();

    const existingApplication = await prisma.application.findUnique({
      where: {
        job_id_user_id: {
          job_id: jobIdNum,
          user_id: user.id,
        },
      },
    });

    return !!existingApplication;
  } catch (error) {
    console.error('[hasUserAppliedForJob] Error:', error);
    return false;
  }
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

    // テスト運用中の認証済みユーザーを取得
    const user = await getAuthenticatedUser();
    console.log('[applyForJob] Using user:', user.id);

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
    // テスト運用中の認証済みユーザーを取得
    const user = await getAuthenticatedUser();
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

    // 資格は配列に変換
    const qualifications = qualificationsStr ? qualificationsStr.split(',').filter(q => q.trim()) : [];

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
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    return jobs;
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
