'use server';

import { prisma } from '@/lib/prisma';
import { unstable_noStore, revalidatePath } from 'next/cache';
import { getCurrentTime, getTodayStart, type WorkerListItem, type WorkerListSearchParams, type WorkerListStatus } from './helpers';
import { sendReviewReceivedNotificationToWorker, sendAdminLowRatingStreakNotification } from './notification';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';
import { getJSTTodayStart, normalizeToJSTDayStart } from '@/utils/debugTime.server';

/**
 * 施設管理者用: ワーカーの詳細情報を取得（統計・評価・キャンセル率含む）
 * 最適化: Promise.allで並列クエリ実行
 */
export async function getWorkerDetail(workerId: number, facilityId: number) {
  try {
    // 最初に応募確認とユーザー情報を並列で取得
    const [hasApplied, user] = await Promise.all([
      prisma.application.findFirst({
        where: {
          user_id: workerId,
          workDate: { job: { facility_id: facilityId } },
        },
      }),
      prisma.user.findUnique({ where: { id: workerId } }),
    ]);

    if (!hasApplied || !user) return null;

    const today = getTodayStart();

    // 全ての独立したクエリを並列で実行
    const [
      ourFacilityCompletedApps,
      ourFacilityReviews,
      allReviews,
      otherFacilityApps,
      allApplications,
      upcomingSchedules,
      isFavoriteBookmark,
      isBlockedBookmark,
    ] = await Promise.all([
      prisma.application.findMany({
        where: {
          user_id: workerId,
          workDate: { job: { facility_id: facilityId } },
          status: { in: ['COMPLETED_PENDING', 'COMPLETED_RATED'] },
        },
        include: { workDate: { include: { job: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.review.findMany({
        where: {
          user_id: workerId,
          facility_id: facilityId,
          reviewer_type: 'FACILITY',
        },
        include: { job: true },
        orderBy: { created_at: 'desc' },
      }),
      prisma.review.findMany({
        where: { user_id: workerId, reviewer_type: 'FACILITY' },
        include: { facility: { select: { facility_type: true } } },
      }),
      prisma.application.count({
        where: {
          user_id: workerId,
          workDate: { job: { facility_id: { not: facilityId } } },
          status: { in: ['COMPLETED_PENDING', 'COMPLETED_RATED'] },
        },
      }),
      prisma.application.findMany({
        where: {
          user_id: workerId,
          status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'] },
        },
        select: {
          status: true,
          updated_at: true,
          cancelled_by: true,
          workDate: { select: { work_date: true } },
        },
      }),
      prisma.application.findMany({
        where: {
          user_id: workerId,
          status: 'SCHEDULED',
          workDate: { work_date: { gte: today }, job: { facility_id: facilityId } },
        },
        include: {
          workDate: {
            include: { job: { include: { facility: { select: { facility_name: true } } } } },
          },
        },
        orderBy: { workDate: { work_date: 'asc' } },
        take: 30,
      }),
      prisma.bookmark.findFirst({
        where: { facility_id: facilityId, target_user_id: workerId, type: 'FAVORITE' },
      }),
      prisma.bookmark.findFirst({
        where: { facility_id: facilityId, target_user_id: workerId, type: 'WATCH_LATER' },
      }),
    ]);

    // レビュー完了済み（COMPLETED_RATED）があるか確認（オファー対象判定用）
    const hasCompletedRated = ourFacilityCompletedApps.some(app => app.status === 'COMPLETED_RATED');

    const ourAvgRating = ourFacilityReviews.length > 0
      ? ourFacilityReviews.reduce((sum, r) => sum + r.rating, 0) / ourFacilityReviews.length
      : 0;

    const totalAvgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    const facilityTypeRatings: Record<string, { total: number; count: number }> = {};
    allReviews.forEach((r) => {
      const type = r.facility.facility_type;
      if (!facilityTypeRatings[type]) facilityTypeRatings[type] = { total: 0, count: 0 };
      facilityTypeRatings[type].total += r.rating;
      facilityTypeRatings[type].count += 1;
    });

    const ratingsByFacilityType = Object.entries(facilityTypeRatings).map(([type, data]) => ({
      facilityType: type,
      averageRating: data.total / data.count,
      reviewCount: data.count,
    }));

    const ratingsByCategory = { attendance: 0, skill: 0, execution: 0, communication: 0, attitude: 0 };
    const categoryCounts = { attendance: 0, skill: 0, execution: 0, communication: 0, attitude: 0 };

    allReviews.forEach((r) => {
      if (r.rating_attendance) { ratingsByCategory.attendance += r.rating_attendance; categoryCounts.attendance++; }
      if (r.rating_skill) { ratingsByCategory.skill += r.rating_skill; categoryCounts.skill++; }
      if (r.rating_execution) { ratingsByCategory.execution += r.rating_execution; categoryCounts.execution++; }
      if (r.rating_communication) { ratingsByCategory.communication += r.rating_communication; categoryCounts.communication++; }
      if (r.rating_attitude) { ratingsByCategory.attitude += r.rating_attitude; categoryCounts.attitude++; }
    });

    const finalRatingsByCategory = {
      attendance: categoryCounts.attendance > 0 ? ratingsByCategory.attendance / categoryCounts.attendance : null,
      skill: categoryCounts.skill > 0 ? ratingsByCategory.skill / categoryCounts.skill : null,
      execution: categoryCounts.execution > 0 ? ratingsByCategory.execution / categoryCounts.execution : null,
      communication: categoryCounts.communication > 0 ? ratingsByCategory.communication / categoryCounts.communication : null,
      attitude: categoryCounts.attitude > 0 ? ratingsByCategory.attitude / categoryCounts.attitude : null,
    };

    const workerCancelledApps = allApplications.filter(
      (app) => app.status === 'CANCELLED' && app.cancelled_by === 'WORKER'
    );
    const cancelRate = allApplications.length > 0 ? (workerCancelledApps.length / allApplications.length) * 100 : 0;

    let lastMinuteCancelCount = 0;
    workerCancelledApps.forEach((app) => {
      const workDateNormalized = normalizeToJSTDayStart(new Date(app.workDate.work_date));
      const updatedAt = new Date(app.updated_at);
      // 前日 = workDate - 24時間（JST基準）
      const dayBefore = new Date(workDateNormalized.getTime() - 24 * 60 * 60 * 1000);
      if (updatedAt >= dayBefore) lastMinuteCancelCount += 1;
    });
    const lastMinuteCancelRate = allApplications.length > 0 ? (lastMinuteCancelCount / allApplications.length) * 100 : 0;

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
      gender: user.gender,
      nationality: user.nationality,
      lastNameKana: user.last_name_kana,
      firstNameKana: user.first_name_kana,
      postalCode: user.postal_code,
      prefecture: user.prefecture,
      city: user.city,
      addressLine: user.address_line,
      building: user.building,
      emergencyName: user.emergency_name,
      emergencyRelation: user.emergency_relation,
      emergencyPhone: user.emergency_phone,
      emergencyAddress: user.emergency_address,
      currentWorkStyle: user.current_work_style,
      desiredWorkStyle: user.desired_work_style,
      jobChangeDesire: user.job_change_desire,
      desiredWorkDaysPerWeek: user.desired_work_days_week,
      desiredWorkPeriod: user.desired_work_period,
      desiredWorkDays: user.desired_work_days,
      desiredStartTime: user.desired_start_time,
      desiredEndTime: user.desired_end_time,
      experienceFields: user.experience_fields as Record<string, string> | null,
      workHistories: user.work_histories,
      selfPR: user.self_pr,
      bankName: user.bank_name,
      branchName: user.branch_name,
      accountName: user.account_name,
      accountNumber: user.account_number,
      pensionNumber: user.pension_number,
      ourFacilityWorkDays: ourFacilityCompletedApps.length,
      ourFacilityAvgRating: ourAvgRating,
      ourFacilityReviewCount: ourFacilityReviews.length,
      totalWorkDays: ourFacilityCompletedApps.length + otherFacilityApps,
      otherFacilityWorkDays: otherFacilityApps,
      totalAvgRating,
      totalReviewCount: allReviews.length,
      cancelRate,
      lastMinuteCancelRate,
      ratingsByFacilityType,
      upcomingSchedules: upcomingSchedules.map((app) => ({
        id: app.id,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
        jobTitle: app.workDate.job.title,
        facilityName: app.workDate.job.facility.facility_name,
      })),
      workHistory: ourFacilityCompletedApps.map((app) => ({
        id: app.id,
        jobTitle: app.workDate.job.title,
        workDate: app.workDate.work_date.toISOString().split('T')[0],
        status: app.status,
      })),
      evaluations: ourFacilityReviews.map((r) => ({
        id: r.id,
        jobTitle: r.job.title,
        jobDate: r.created_at.toISOString().split('T')[0],
        rating: r.rating,
        comment: r.good_points,
      })),
      isFavorite: !!isFavoriteBookmark,
      isBlocked: !!isBlockedBookmark,
      ratingsByCategory: finalRatingsByCategory,
      qualificationCertificates: user.qualification_certificates as Record<string, string | { certificate_image?: string }> | null,
      hasCompletedRated, // レビュー完了済み（オファー対象）
    };
  } catch (error) {
    console.error('[getWorkerDetail] Error:', error);
    return null;
  }
}

/**
 * 施設管理者用: 未評価のワーカー一覧を取得
 */
export async function getPendingWorkerReviews(facilityId: number) {
  unstable_noStore();
  try {
    const today = getCurrentTime();
    const applications = await prisma.application.findMany({
      where: {
        workDate: { job: { facility_id: facilityId }, work_date: { lte: today } },
        status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
      },
      include: { user: true, workDate: { include: { job: true } } },
      orderBy: { workDate: { work_date: 'asc' } },
    });

    const existingReviews = await prisma.review.findMany({
      where: { facility_id: facilityId, reviewer_type: 'FACILITY' },
      select: { job_id: true, user_id: true },
    });

    const reviewedSet = new Set(existingReviews.map(r => `${r.job_id}-${r.user_id}`));
    const pendingReviewsMap = new Map();

    for (const app of applications) {
      const key = `${app.workDate.job_id}-${app.user_id}`;
      if (reviewedSet.has(key)) continue;
      if (pendingReviewsMap.has(key)) continue;

      const workDate = new Date(app.workDate.work_date);
      const diffTime = Math.abs(today.getTime() - workDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      pendingReviewsMap.set(key, {
        applicationId: app.id,
        jobId: app.workDate.job.id,
        userId: app.user.id,
        userName: app.user.name,
        userProfileImage: app.user.profile_image,
        jobTitle: app.workDate.job.title,
        workDate: app.workDate.work_date.toISOString(),
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
        daysSinceWork: diffDays,
      });
    }

    return Array.from(pendingReviewsMap.values());
  } catch (error) {
    console.error('[getPendingWorkerReviews] Error:', error);
    return [];
  }
}
export async function getCompletedWorkerReviews(facilityId: number) {
  unstable_noStore(); // キャッシュを無効化
  try {
    const reviews = await prisma.review.findMany({
      where: {
        facility_id: facilityId,
        reviewer_type: 'FACILITY',
      },
      include: {
        user: true,
        job: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return reviews.map(review => ({
      id: review.id,
      userId: review.user.id,
      userName: review.user.name,
      userProfileImage: review.user.profile_image,
      jobTitle: review.job.title,
      // workDateは必須ではなくなったので、jobの情報を使うか、null許容にする
      // ここではjobの作成日などを仮に入れるか、review.created_atを使う
      workDate: review.created_at.toISOString(),
      rating: review.rating,
      comment: review.good_points,
      createdAt: review.created_at.toISOString(),
    }));
  } catch (error) {
    console.error('[getCompletedWorkerReviews] Error:', error);
    return [];
  }
}
export async function submitWorkerReview(data: {
  applicationId: number;
  facilityId: number;
  ratings: {
    attendance: number;
    skill: number;
    execution: number;
    communication: number;
    attitude: number;
  };
  comment: string;
  action?: 'favorite' | 'block';
}) {
  const session = await getFacilityAdminSessionData();
  try {
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
      include: { workDate: true },
    });

    if (!application) throw new Error('Application not found');

    // 総合評価（平均）
    const totalScore =
      data.ratings.attendance +
      data.ratings.skill +
      data.ratings.execution +
      data.ratings.communication +
      data.ratings.attitude;
    const averageRating = Math.round(totalScore / 5);

    // レビュー作成
    await prisma.review.create({
      data: {
        facility_id: data.facilityId,
        user_id: application.user_id,
        work_date_id: application.work_date_id,
        job_id: application.workDate.job_id, // job_idを追加
        application_id: data.applicationId,
        reviewer_type: 'FACILITY',
        rating: averageRating,
        rating_attendance: data.ratings.attendance,
        rating_skill: data.ratings.skill,
        rating_execution: data.ratings.execution,
        rating_communication: data.ratings.communication,
        rating_attitude: data.ratings.attitude,
        good_points: data.comment,
      },
    });

    // アプリケーションステータス更新
    await prisma.application.update({
      where: { id: data.applicationId },
      data: {
        facility_review_status: 'COMPLETED',
        status: 'COMPLETED_RATED', // 双方評価完了かどうかは別途チェックが必要だが簡易的に
      },
    });

    // アクション処理
    if (data.action === 'favorite') {
      await toggleWorkerFavorite(application.user_id, data.facilityId);
    } else if (data.action === 'block') {
      await toggleWorkerBlock(application.user_id, data.facilityId);
    }

    // ワーカーの連続低評価チェック（低評価が続いている場合は管理者に通知）
    const LOW_RATING_THRESHOLD = 2; // 2以下を低評価とみなす
    const STREAK_COUNT_THRESHOLD = 3; // 3回連続で低評価の場合にアラート

    const recentReviews = await prisma.review.findMany({
      where: { user_id: application.user_id, reviewer_type: 'FACILITY' },
      orderBy: { created_at: 'desc' },
      take: STREAK_COUNT_THRESHOLD,
      select: { rating: true },
    });

    if (recentReviews.length >= STREAK_COUNT_THRESHOLD) {
      const allLowRatings = recentReviews.every(r => r.rating <= LOW_RATING_THRESHOLD);
      if (allLowRatings) {
        const avgRating = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
        const worker = await prisma.user.findUnique({
          where: { id: application.user_id },
          select: { name: true },
        });

        await sendAdminLowRatingStreakNotification(
          'WORKER',
          application.user_id,
          worker?.name || 'ワーカー',
          STREAK_COUNT_THRESHOLD,
          Math.round(avgRating * 10) / 10
        );
      }
    }

    revalidatePath('/admin/worker-reviews');

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_CREATE',
      targetType: 'Review',
      requestData: {
        facilityId: data.facilityId,
        applicationId: data.applicationId,
        workerId: application.user_id,
        rating: averageRating,
        ratings: data.ratings,
        action: data.action,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[submitWorkerReview] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_CREATE',
      requestData: {
        facilityId: data.facilityId,
        applicationId: data.applicationId,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'Failed to submit review' };
  }
}
export async function submitWorkerReviewByJob(data: {
  jobId: number;
  userId: number;
  facilityId: number;
  ratings: {
    attendance: number;
    skill: number;
    execution: number;
    communication: number;
    attitude: number;
  };
  comment: string;
  action?: 'favorite' | 'block';
}) {
  const session = await getFacilityAdminSessionData();
  try {
    console.log('[submitWorkerReviewByJob] Submitting review for job:', data.jobId, 'user:', data.userId);

    // 求人が存在し、施設のものであることを確認
    const job = await prisma.job.findFirst({
      where: {
        id: data.jobId,
        facility_id: data.facilityId,
      },
    });

    if (!job) {
      return { success: false, error: '求人が見つかりません' };
    }

    // このワーカーのこの求人への応募が存在することを確認
    const applications = await prisma.application.findMany({
      where: {
        user_id: data.userId,
        workDate: {
          job_id: data.jobId,
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
    });

    if (applications.length === 0) {
      return { success: false, error: 'このワーカーの勤務実績がありません' };
    }

    // 既存レビューチェック（job_id + user_id + reviewer_type でユニーク）
    const existingReview = await prisma.review.findFirst({
      where: {
        job_id: data.jobId,
        user_id: data.userId,
        reviewer_type: 'FACILITY',
      },
    });

    if (existingReview) {
      return { success: false, error: '既にレビュー済みです' };
    }

    // 総合評価（平均）
    const totalScore =
      data.ratings.attendance +
      data.ratings.skill +
      data.ratings.execution +
      data.ratings.communication +
      data.ratings.attitude;
    const averageRating = Math.round(totalScore / 5);

    // レビュー作成
    await prisma.review.create({
      data: {
        facility_id: data.facilityId,
        user_id: data.userId,
        job_id: data.jobId,
        reviewer_type: 'FACILITY',
        rating: averageRating,
        rating_attendance: data.ratings.attendance,
        rating_skill: data.ratings.skill,
        rating_execution: data.ratings.execution,
        rating_communication: data.ratings.communication,
        rating_attitude: data.ratings.attitude,
        good_points: data.comment || null,
      },
    });

    // この求人に対する該当ワーカーの全応募をCOMPLETED_RATEDに更新
    await prisma.application.updateMany({
      where: {
        user_id: data.userId,
        workDate: {
          job_id: data.jobId,
        },
        status: 'COMPLETED_PENDING',
      },
      data: {
        status: 'COMPLETED_RATED',
        facility_review_status: 'COMPLETED',
      },
    });

    // アクション処理（お気に入り・ブロック）
    if (data.action === 'favorite') {
      await toggleWorkerFavorite(data.userId, data.facilityId);
    } else if (data.action === 'block') {
      await toggleWorkerBlock(data.userId, data.facilityId);
    }

    // ワーカーの連続低評価チェック（低評価が続いている場合は管理者に通知）
    const LOW_RATING_THRESHOLD = 2; // 2以下を低評価とみなす
    const STREAK_COUNT_THRESHOLD = 3; // 3回連続で低評価の場合にアラート

    const recentReviews = await prisma.review.findMany({
      where: { user_id: data.userId, reviewer_type: 'FACILITY' },
      orderBy: { created_at: 'desc' },
      take: STREAK_COUNT_THRESHOLD,
      select: { rating: true },
    });

    if (recentReviews.length >= STREAK_COUNT_THRESHOLD) {
      const allLowRatings = recentReviews.every(r => r.rating <= LOW_RATING_THRESHOLD);
      if (allLowRatings) {
        const avgRating = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
        const worker = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { name: true },
        });

        await sendAdminLowRatingStreakNotification(
          'WORKER',
          data.userId,
          worker?.name || 'ワーカー',
          STREAK_COUNT_THRESHOLD,
          Math.round(avgRating * 10) / 10
        );
      }
    }

    console.log('[submitWorkerReviewByJob] Review submitted successfully');
    revalidatePath('/admin/worker-reviews');
    revalidatePath('/admin/workers');

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_CREATE',
      targetType: 'Review',
      requestData: {
        facilityId: data.facilityId,
        jobId: data.jobId,
        workerId: data.userId,
        rating: averageRating,
        ratings: data.ratings,
        action: data.action,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[submitWorkerReviewByJob] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_CREATE',
      requestData: {
        facilityId: data.facilityId,
        jobId: data.jobId,
        workerId: data.userId,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'レビューの登録に失敗しました' };
  }
}
export async function getReceivedReviews(userId: number) {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        user_id: userId,
        reviewer_type: 'FACILITY',
      },
      include: {
        facility: true,
        job: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return reviews.map(review => ({
      id: review.id,
      facilityName: review.facility.facility_name,
      jobTitle: review.job.title,
      workDate: review.created_at.toISOString(), // workDateの代わりに作成日を使用
      rating: review.rating,
      ratings: {
        attendance: review.rating_attendance || 0,
        skill: review.rating_skill || 0,
        execution: review.rating_execution || 0,
        communication: review.rating_communication || 0,
        attitude: review.rating_attitude || 0,
      },
      comment: review.good_points,
      createdAt: review.created_at.toISOString(),
    }));
  } catch (error) {
    console.error('[getReceivedReviews] Error:', error);
    return [];
  }
}

// テンプレート関連
export async function getReviewTemplates(facilityId: number) {
  try {
    return await prisma.reviewTemplate.findMany({
      where: { facility_id: facilityId },
      orderBy: { created_at: 'desc' },
    });
  } catch (error) {
    console.error('[getReviewTemplates] Error:', error);
    return [];
  }
}

export async function createReviewTemplate(facilityId: number, name: string, content: string) {
  const session = await getFacilityAdminSessionData();
  try {
    const template = await prisma.reviewTemplate.create({
      data: {
        facility_id: facilityId,
        name,
        content,
      },
    });
    // 注意: /admin/worker-reviewsはrevalidateしない（レビューフォーム入力中にリセットされるため）
    // ページ内ではrefreshTemplates()で手動更新している

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_TEMPLATE_CREATE',
      targetType: 'ReviewTemplate',
      targetId: template.id,
      requestData: {
        facilityId,
        name,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[createReviewTemplate] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_TEMPLATE_CREATE',
      requestData: {
        facilityId,
        name,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false };
  }
}

export async function updateReviewTemplate(templateId: number, name: string, content: string, facilityId: number) {
  const session = await getFacilityAdminSessionData();
  try {
    // 認可チェック: 対象テンプレートが自施設のものか確認
    const existing = await prisma.reviewTemplate.findUnique({
      where: { id: templateId },
      select: { facility_id: true },
    });

    if (!existing || existing.facility_id !== facilityId) {
      return { success: false, error: '権限がありません' };
    }

    await prisma.reviewTemplate.update({
      where: { id: templateId },
      data: { name, content },
    });
    // 注意: /admin/worker-reviewsはrevalidateしない（レビューフォーム入力中にリセットされるため）

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_TEMPLATE_UPDATE',
      targetType: 'ReviewTemplate',
      targetId: templateId,
      requestData: {
        facilityId,
        name,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[updateReviewTemplate] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_TEMPLATE_UPDATE',
      targetType: 'ReviewTemplate',
      targetId: templateId,
      requestData: {
        facilityId,
        name,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'テンプレートの更新に失敗しました' };
  }
}

export async function deleteReviewTemplate(templateId: number, facilityId: number) {
  const session = await getFacilityAdminSessionData();
  try {
    // 認可チェック: 対象テンプレートが自施設のものか確認
    const existing = await prisma.reviewTemplate.findUnique({
      where: { id: templateId },
      select: { facility_id: true },
    });

    if (!existing || existing.facility_id !== facilityId) {
      return { success: false, error: '権限がありません' };
    }

    await prisma.reviewTemplate.delete({
      where: { id: templateId },
    });
    // 注意: /admin/worker-reviewsはrevalidateしない（レビューフォーム入力中にリセットされるため）

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_TEMPLATE_DELETE',
      targetType: 'ReviewTemplate',
      targetId: templateId,
      requestData: {
        facilityId,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[deleteReviewTemplate] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_TEMPLATE_DELETE',
      targetType: 'ReviewTemplate',
      targetId: templateId,
      requestData: {
        facilityId,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'テンプレートの削除に失敗しました' };
  }
}

/**
 * ワーカーのお気に入りをトグル
 */
export async function toggleWorkerFavorite(workerId: number, facilityId: number): Promise<{ success: boolean; isFavorite?: boolean; error?: string }> {
  const session = await getFacilityAdminSessionData();
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

      // ログ記録
      logActivity({
        userType: 'FACILITY',
        userId: session?.adminId,
        userEmail: session?.email,
        action: 'BOOKMARK_DELETE',
        targetType: 'Bookmark',
        targetId: existing.id,
        requestData: {
          facilityId,
          workerId,
          type: 'FAVORITE',
        },
        result: 'SUCCESS',
      }).catch(() => {});

      return { success: true, isFavorite: false };
    } else {
      const bookmark = await prisma.bookmark.create({
        data: {
          facility_id: facilityId,
          target_user_id: workerId,
          type: 'FAVORITE',
        },
      });

      // ログ記録
      logActivity({
        userType: 'FACILITY',
        userId: session?.adminId,
        userEmail: session?.email,
        action: 'BOOKMARK_CREATE',
        targetType: 'Bookmark',
        targetId: bookmark.id,
        requestData: {
          facilityId,
          workerId,
          type: 'FAVORITE',
        },
        result: 'SUCCESS',
      }).catch(() => {});

      return { success: true, isFavorite: true };
    }
  } catch (error) {
    console.error('[toggleWorkerFavorite] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'BOOKMARK_CREATE',
      requestData: {
        facilityId,
        workerId,
        type: 'FAVORITE',
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'お気に入りの更新に失敗しました' };
  }
}

/**
 * ワーカーのブロックをトグル（WATCH_LATERをブロック扱いとして使用）
 */
export async function toggleWorkerBlock(workerId: number, facilityId: number): Promise<{ success: boolean; isBlocked?: boolean; error?: string }> {
  const session = await getFacilityAdminSessionData();
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

      // ログ記録
      logActivity({
        userType: 'FACILITY',
        userId: session?.adminId,
        userEmail: session?.email,
        action: 'BOOKMARK_DELETE',
        targetType: 'Bookmark',
        targetId: existing.id,
        requestData: {
          facilityId,
          workerId,
          type: 'BLOCK',
        },
        result: 'SUCCESS',
      }).catch(() => {});

      return { success: true, isBlocked: false };
    } else {
      const bookmark = await prisma.bookmark.create({
        data: {
          facility_id: facilityId,
          target_user_id: workerId,
          type: 'WATCH_LATER',
        },
      });

      // ログ記録
      logActivity({
        userType: 'FACILITY',
        userId: session?.adminId,
        userEmail: session?.email,
        action: 'BOOKMARK_CREATE',
        targetType: 'Bookmark',
        targetId: bookmark.id,
        requestData: {
          facilityId,
          workerId,
          type: 'BLOCK',
        },
        result: 'SUCCESS',
      }).catch(() => {});

      return { success: true, isBlocked: true };
    }
  } catch (error) {
    console.error('[toggleWorkerBlock] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'BOOKMARK_CREATE',
      requestData: {
        facilityId,
        workerId,
        type: 'BLOCK',
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'ブロックの更新に失敗しました' };
  }
}

/**
 * 施設が受けたレビュー一覧を取得（管理者向け）
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
        user: true,
        job: true,
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
      jobTitle: review.job.title,
      jobDate: review.created_at.toISOString().split('T')[0], // workDateの代わりに作成日を使用
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
  const session = await getFacilityAdminSessionData();
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
          job_id: application.workDate.job_id, // job_idを追加
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

    // ワーカーへレビュー受信通知を送信
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { facility_name: true },
    });
    if (facility) {
      await sendReviewReceivedNotificationToWorker(
        application.user_id,
        facility.facility_name
      );
    }

    console.log('[submitFacilityReviewForWorker] Review submitted successfully');

    revalidatePath('/admin/workers');
    revalidatePath('/admin/reviews');

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_CREATE',
      targetType: 'Review',
      requestData: {
        facilityId,
        applicationId,
        workerId: application.user_id,
        rating: data.rating,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return {
      success: true,
      message: '評価を投稿しました',
    };
  } catch (error) {
    console.error('[submitFacilityReviewForWorker] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'REVIEW_CREATE',
      requestData: {
        facilityId,
        applicationId,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return {
      success: false,
      error: '評価の投稿に失敗しました',
    };
  }
}

/**
 * 施設のワーカー一覧を取得（ページネーション対応）
 */
export async function getWorkerListForFacility(
  facilityId: number,
  params?: WorkerListSearchParams
) {
  try {
    const { page = 1, limit = 20, sort = 'lastWorkDate_desc', status = 'all', keyword = '' } = params || {};
    const skip = (page - 1) * limit;

    console.log('[getWorkerListForFacility] Fetching workers for facility:', facilityId, params);

    // 1. まず該当施設の勤務実績があるワーカーIDを収集・集計
    const whereConditions: any = {
      workDate: {
        job: { facility_id: facilityId },
      },
      status: {
        in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
      },
    };

    if (keyword) {
      whereConditions.user = {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
        ]
      };
    }

    // 並列で集計とdistinctを実行
    const [groupedApps, distinctApps] = await Promise.all([
      // 集計（ID一覧とソート用データ）
      prisma.application.groupBy({
        by: ['user_id'],
        where: whereConditions,
        _count: { id: true },
        _max: {
          created_at: true
        },
      }),
      // 対象ワーカーIDを全て取得 (distinct)
      prisma.application.findMany({
        where: whereConditions,
        distinct: ['user_id'],
        select: {
          user_id: true,
        }
      }),
    ]);

    let candidateUserIds = distinctApps.map(app => app.user_id);

    // 2. 全候補者の統計データを取得（ソート・フィルタ用）
    const allAppsForCandidates = await prisma.application.findMany({
      where: {
        user_id: { in: candidateUserIds },
        workDate: { job: { facility_id: facilityId } },
        status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'] }
      },
      select: {
        user_id: true,
        status: true,
        workDate: { select: { work_date: true } }
      }
    });

    const statsMap = new Map();
    allAppsForCandidates.forEach(app => {
      const current = statsMap.get(app.user_id) || { count: 0, lastDate: 0 };
      current.count++;
      const dateDesc = new Date(app.workDate.work_date).getTime();
      if (dateDesc > current.lastDate) current.lastDate = dateDesc;
      statsMap.set(app.user_id, current);
    });

    // 3. メモリソート
    candidateUserIds.sort((a, b) => {
      const statsA = statsMap.get(a) || { count: 0, lastDate: 0 };
      const statsB = statsMap.get(b) || { count: 0, lastDate: 0 };

      switch (sort) {
        case 'workCount_desc': return statsB.count - statsA.count;
        case 'workCount_asc': return statsA.count - statsB.count;
        case 'lastWorkDate_asc': return statsA.lastDate - statsB.lastDate;
        case 'lastWorkDate_desc':
        default:
          return statsB.lastDate - statsA.lastDate;
      }
    });

    // 4. ページネーション (Slice)
    const totalCount = candidateUserIds.length;
    const paginatedIds = candidateUserIds.slice(skip, skip + limit);

    if (paginatedIds.length === 0) {
      return { data: [], pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, hasMore: false } };
    }

    // 5. 詳細データ取得 (paginatedIds に対してのみ) - 並列実行
    const userIds = paginatedIds;

    const [ourApplications, otherApplications, allApplicationsForCancel, bookmarks, reviews] = await Promise.all([
      // 自社での勤務データ
      prisma.application.findMany({
        where: {
          workDate: {
            job: {
              facility_id: facilityId,
            },
          },
          user_id: { in: userIds },
          status: {
            in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
          },
        },
        select: {
          status: true,
          cancelled_by: true,
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
              job: {
                select: {
                  start_time: true,
                  end_time: true,
                },
              },
            },
          },
        },
      }),
      // 他社での勤務データ
      prisma.application.findMany({
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
      }),
      // 全施設での応募データ（キャンセル率計算用）
      prisma.application.findMany({
        where: {
          user_id: { in: userIds },
          status: {
            in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED', 'CANCELLED'],
          },
        },
        select: {
          user_id: true,
          status: true,
          cancelled_by: true,
          updated_at: true,
          workDate: {
            select: {
              work_date: true,
            },
          },
        },
      }),
      // お気に入り・ブロック状態
      prisma.bookmark.findMany({
        where: {
          facility_id: facilityId,
          target_user_id: { in: userIds },
        },
        select: {
          target_user_id: true,
          type: true,
        },
      }),
      // 各ワーカーの評価（自社のみ）
      prisma.review.findMany({
        where: {
          user_id: { in: userIds },
          facility_id: facilityId,
          reviewer_type: 'FACILITY',
        },
        select: {
          user_id: true,
          rating: true,
        },
      }),
    ]);

    // ブックマークをマップ化
    const favoriteSet = new Set<number>();
    const blockedSet = new Set<number>();
    for (const b of bookmarks) {
      if (b.target_user_id) {
        if (b.type === 'FAVORITE') {
          favoriteSet.add(b.target_user_id);
        }
      }
    }

    // 自社での勤務データを集計（JST対応）
    const today = getJSTTodayStart();

    // 勤務予定の詳細情報型
    type ScheduledWorkInfo = {
      date: Date;
      startTime: string;
      endTime: string;
    };

    const ourDataMap = new Map<number, {
      user: typeof ourApplications[0]['user'];
      statuses: Set<string>;
      completedDates: Date[];
      workingDates: Date[];
      scheduledWorks: ScheduledWorkInfo[]; // 勤務予定日（今日以降の予定・勤務中）+ 時間情報
      cancelledCount: number;
      totalApplications: number;
    }>();

    for (const app of ourApplications) {
      const existing = ourDataMap.get(app.user.id);
      const isCompleted = app.status === 'COMPLETED_PENDING' || app.status === 'COMPLETED_RATED';
      const isWorking = app.status === 'WORKING';
      const isScheduled = app.status === 'SCHEDULED';
      const isWorkerCancelled = app.status === 'CANCELLED' && app.cancelled_by === 'WORKER';
      // 勤務予定：今日以降のSCHEDULED/WORKING（JST基準で比較）
      const workDate = normalizeToJSTDayStart(new Date(app.workDate.work_date));
      const isFutureOrToday = workDate >= today;
      const isUpcomingWork = (isScheduled || isWorking) && isFutureOrToday;

      const scheduledWorkInfo: ScheduledWorkInfo = {
        date: app.workDate.work_date,
        startTime: app.workDate.job.start_time,
        endTime: app.workDate.job.end_time,
      };

      if (existing) {
        existing.statuses.add(app.status);
        existing.totalApplications++;
        if (isCompleted) {
          existing.completedDates.push(app.workDate.work_date);
        }
        if (isWorking) {
          existing.workingDates.push(app.workDate.work_date);
        }
        if (isUpcomingWork) {
          existing.scheduledWorks.push(scheduledWorkInfo);
        }
        if (isWorkerCancelled) {
          existing.cancelledCount++;
        }
      } else {
        ourDataMap.set(app.user.id, {
          user: app.user,
          statuses: new Set([app.status]),
          completedDates: isCompleted ? [app.workDate.work_date] : [],
          workingDates: isWorking ? [app.workDate.work_date] : [],
          scheduledWorks: isUpcomingWork ? [scheduledWorkInfo] : [],
          cancelledCount: isWorkerCancelled ? 1 : 0,
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

    // 全施設でのキャンセル率を集計
    const cancelRateMap = new Map<number, {
      totalApplications: number;
      cancelledCount: number;
      lastMinuteCancelCount: number;
    }>();
    for (const app of allApplicationsForCancel) {
      const existing = cancelRateMap.get(app.user_id);
      const isWorkerCancelled = app.status === 'CANCELLED' && app.cancelled_by === 'WORKER';

      // 直前キャンセル判定（勤務日の前日以降にキャンセル）
      let isLastMinuteCancel = false;
      if (isWorkerCancelled) {
        const workDateNormalized = normalizeToJSTDayStart(new Date(app.workDate.work_date));
        const updatedAt = new Date(app.updated_at);
        const dayBefore = new Date(workDateNormalized.getTime() - 24 * 60 * 60 * 1000);
        isLastMinuteCancel = updatedAt >= dayBefore;
      }

      if (existing) {
        existing.totalApplications++;
        if (isWorkerCancelled) {
          existing.cancelledCount++;
        }
        if (isLastMinuteCancel) {
          existing.lastMinuteCancelCount++;
        }
      } else {
        cancelRateMap.set(app.user_id, {
          totalApplications: 1,
          cancelledCount: isWorkerCancelled ? 1 : 0,
          lastMinuteCancelCount: isLastMinuteCancel ? 1 : 0,
        });
      }
    }

    // 結果を構築（paginatedIdsの順序を保持）
    let workers: WorkerListItem[] = [];

    for (const userId of paginatedIds) {
      const data = ourDataMap.get(userId);
      if (!data) continue;

      const reviewData = reviewMap.get(userId);
      const otherData = otherDataMap.get(userId);
      const statusSet = data.statuses;

      // ステータスを判定
      const statuses: WorkerListStatus[] = [];
      const hasCompletedPending = statusSet.has('COMPLETED_PENDING'); // レビュー待ち
      const hasCompletedRated = statusSet.has('COMPLETED_RATED'); // レビュー完了（オファー対象）
      const hasCompleted = hasCompletedPending || hasCompletedRated;
      const hasCancelled = statusSet.has('CANCELLED');
      const hasScheduled = statusSet.has('SCHEDULED');
      const hasWorking = statusSet.has('WORKING');

      if (hasScheduled && !hasCompleted) {
        statuses.push('NOT_STARTED');
      }
      if (hasWorking) {
        statuses.push('WORKING');
      }
      if (hasCompletedRated) {
        // レビュー完了済みは「就労済」
        statuses.push('COMPLETED');
      }
      if (hasCompletedPending) {
        // 勤務完了しているがレビュー待ちの状態
        statuses.push('REVIEW_PENDING');
      }
      if (hasCancelled) {
        statuses.push('CANCELLED');
      }

      // 自社の最終勤務日（完了済みのみ - 勤務予定は含まない）
      const ourCompletedSortedDates = [...data.completedDates].sort((a, b) => b.getTime() - a.getTime());
      const lastOurWorkDate = ourCompletedSortedDates.length > 0
        ? ourCompletedSortedDates[0].toISOString().split('T')[0]
        : null;

      // 勤務予定（日付順にソート、時間情報付き）
      const scheduledDatesWithTime = data.scheduledWorks
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(sw => ({
          date: new Date(sw.date).toISOString().split('T')[0],
          startTime: sw.startTime,
          endTime: sw.endTime,
        }));

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

      // キャンセル率（全施設での応募ベース）
      const cancelData = cancelRateMap.get(userId);
      const cancelRate = cancelData && cancelData.totalApplications > 0
        ? (cancelData.cancelledCount / cancelData.totalApplications) * 100
        : 0;

      // 直前キャンセル率（全施設での応募ベース）
      const lastMinuteCancelRate = cancelData && cancelData.totalApplications > 0
        ? (cancelData.lastMinuteCancelCount / cancelData.totalApplications) * 100
        : 0;

      // 経験分野
      const experienceFields = data.user.experience_fields as Record<string, string> | null;

      workers.push({
        userId,
        name: data.user.name,
        profileImage: data.user.profile_image,
        qualifications: data.user.qualifications,
        prefecture: data.user.prefecture,
        city: data.user.city,
        statuses,
        hasCompleted,
        hasCompletedRated,
        hasCancelled,
        ourWorkCount,
        lastOurWorkDate,
        otherWorkCount,
        lastOtherWorkDate,
        totalWorkCount,
        lastWorkDate,
        lastWorkFacilityType,
        scheduledDates: scheduledDatesWithTime, // 勤務予定（自社のみ、時間情報付き）
        cancelRate,
        lastMinuteCancelRate,
        experienceFields,
        avgRating: reviewData ? reviewData.totalRating / reviewData.count : null,
        reviewCount: reviewData?.count || 0,
        isFavorite: favoriteSet.has(userId),
        isBlocked: blockedSet.has(userId),
      });
    }

    // キーワード検索（氏名・住所）
    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      workers = workers.filter(w =>
        w.name.toLowerCase().includes(kw) ||
        (w.prefecture && w.prefecture.toLowerCase().includes(kw)) ||
        (w.city && w.city.toLowerCase().includes(kw))
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

    // ソートはページネーション前（line 1028-1040）で既に実施済み
    // paginatedIdsの順序を保持するため、ここでは再ソート不要

    return { data: workers, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, hasMore: skip + paginatedIds.length < totalCount } };
  } catch (error) {
    console.error('[getWorkerListForFacility] Error:', error);
    return { data: [], pagination: { currentPage: 1, totalPages: 0, totalCount: 0, hasMore: false } };
  }
}

