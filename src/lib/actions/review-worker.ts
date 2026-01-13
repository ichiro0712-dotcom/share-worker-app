'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, getCurrentTime } from './helpers';
import { sendReviewReceivedNotificationToFacility, sendAdminLowRatingStreakNotification } from './notification';

/**
 * 年代を計算する内部ヘルパー
 */
function calculateAgeGroup(birthDate: Date | null): string {
    if (!birthDate) return '年齢非公開';
    const today = getCurrentTime();
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
 * 完了済みで、ワーカー側の評価が未完了の応募を取得
 */
export async function getPendingReviews() {
    try {
        const user = await getAuthenticatedUser();
        const applications = await prisma.application.findMany({
            where: {
                user_id: user.id,
                status: { in: ['COMPLETED_PENDING', 'COMPLETED_RATED'] },
                worker_review_status: 'PENDING',
            },
            include: {
                workDate: {
                    include: {
                        job: { include: { facility: true } },
                    },
                },
            },
            orderBy: { updated_at: 'desc' },
        });

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
    jobId: string,
    rating: number,
    goodPoints: string,
    improvements: string
) {
    try {
        const user = await getAuthenticatedUser();
        const jobIdNum = parseInt(jobId, 10);
        if (isNaN(jobIdNum)) return { success: false, error: '無効な求人IDです' };

        const applications = await prisma.application.findMany({
            where: {
                user_id: user.id,
                workDate: { job_id: jobIdNum },
                status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
            },
            include: {
                workDate: { include: { job: true } },
            },
        });

        if (applications.length === 0) return { success: false, error: '評価対象の求人が見つかりません' };

        const job = applications[0].workDate.job;
        const existingReview = await prisma.review.findFirst({
            where: { job_id: jobIdNum, user_id: user.id, reviewer_type: 'WORKER' },
        });
        if (existingReview) return { success: false, error: 'この求人は既に評価済みです' };

        if (rating < 1 || rating > 5) return { success: false, error: '評価は1〜5の範囲で選択してください' };
        if (!goodPoints.trim()) return { success: false, error: '良かった点を入力してください' };
        if (!improvements.trim()) return { success: false, error: '改善点を入力してください' };

        await prisma.$transaction(async (tx) => {
            await tx.review.create({
                data: {
                    facility_id: job.facility_id,
                    user_id: user.id,
                    job_id: jobIdNum,
                    work_date_id: applications[0].work_date_id,
                    application_id: applications[0].id,
                    reviewer_type: 'WORKER',
                    rating,
                    good_points: goodPoints.trim(),
                    improvements: improvements.trim(),
                },
            });

            await tx.application.updateMany({
                where: { user_id: user.id, workDate: { job_id: jobIdNum } },
                data: { worker_review_status: 'COMPLETED' },
            });

            const facilityReviews = await tx.review.findMany({
                where: { facility_id: job.facility_id, reviewer_type: 'WORKER' },
                select: { rating: true },
            });

            const avgRating = facilityReviews.length > 0
                ? facilityReviews.reduce((sum, r) => sum + r.rating, 0) / facilityReviews.length
                : 0;

            await tx.facility.update({
                where: { id: job.facility_id },
                data: {
                    rating: Math.round(avgRating * 10) / 10,
                    review_count: facilityReviews.length,
                },
            });
        });

        await sendReviewReceivedNotificationToFacility(job.facility_id, user.name, rating);

        // 施設の連続低評価チェック（低評価が続いている場合は管理者に通知）
        const LOW_RATING_THRESHOLD = 2; // 2以下を低評価とみなす
        const STREAK_COUNT_THRESHOLD = 3; // 3回連続で低評価の場合にアラート

        const recentReviews = await prisma.review.findMany({
            where: { facility_id: job.facility_id, reviewer_type: 'WORKER' },
            orderBy: { created_at: 'desc' },
            take: STREAK_COUNT_THRESHOLD,
            select: { rating: true },
        });

        if (recentReviews.length >= STREAK_COUNT_THRESHOLD) {
            const allLowRatings = recentReviews.every(r => r.rating <= LOW_RATING_THRESHOLD);
            if (allLowRatings) {
                const avgRating = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
                const facility = await prisma.facility.findUnique({
                    where: { id: job.facility_id },
                    select: { facility_name: true },
                });

                await sendAdminLowRatingStreakNotification(
                    'FACILITY',
                    job.facility_id,
                    facility?.facility_name || '施設',
                    STREAK_COUNT_THRESHOLD,
                    Math.round(avgRating * 10) / 10
                );
            }
        }

        revalidatePath('/mypage/reviews');
        revalidatePath('/facilities/' + job.facility_id);

        return { success: true, message: 'レビューを投稿しました' };
    } catch (error) {
        console.error('[submitReview] Error:', error);
        return { success: false, error: 'レビューの投稿に失敗しました' };
    }
}

/**
 * ユーザーが投稿したレビュー一覧を取得
 */
export async function getMyReviews() {
    try {
        const user = await getAuthenticatedUser();
        const reviews = await prisma.review.findMany({
            where: { user_id: user.id, reviewer_type: 'WORKER' },
            include: { facility: true, job: true },
            orderBy: { created_at: 'desc' },
        });

        return reviews.map((review) => ({
            id: review.id,
            facilityId: review.facility_id,
            facilityName: review.facility.facility_name,
            jobTitle: review.job.title,
            jobDate: review.created_at.toISOString().split('T')[0],
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
 * 応募の詳細情報を取得（評価画面用）
 */
export async function getApplicationForReview(applicationId: number) {
    try {
        const user = await getAuthenticatedUser();
        const application = await prisma.application.findFirst({
            where: { id: applicationId, user_id: user.id },
            include: {
                workDate: {
                    include: {
                        job: { include: { facility: true } },
                    },
                },
            },
        });

        if (!application) return null;

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

/**
 * 施設のレビュー一覧を取得（ワーカー向け）
 */
export async function getFacilityReviews(facilityId: number) {
    try {
        const reviews = await prisma.review.findMany({
            where: { facility_id: facilityId, reviewer_type: 'WORKER' },
            include: {
                user: { select: { birth_date: true, qualifications: true } },
                workDate: { include: { job: { select: { title: true } } } },
            },
            orderBy: { created_at: 'desc' },
        });

        return reviews.map((review: any) => {
            const ageGroup = calculateAgeGroup(review.user.birth_date);
            const qualification = review.user.qualifications.length > 0 ? review.user.qualifications[0] : '資格なし';

            return {
                id: review.id,
                rating: review.rating,
                goodPoints: review.good_points,
                improvements: review.improvements,
                createdAt: review.created_at.toISOString(),
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

