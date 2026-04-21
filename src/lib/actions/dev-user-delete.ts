'use server';

import prisma from '@/lib/prisma';
import { requireSystemAdminAuth } from '@/lib/system-admin-session-server';
import { logActivity } from '@/lib/logger';

export interface DeleteWorkerResult {
  success: boolean;
  message?: string;
  blockers?: string[];
  deletedUser?: { id: number; email: string; name: string };
  counts?: {
    applications: number;
    bookmarks: number;
    messages: number;
    reviews: number;
    attendances: number;
    offeredJobsCleared: number;
    workDateCountersAdjusted: number;
    facilityRatingsRecalculated: number;
  };
}

/**
 * 開発・テスト用: ワーカーユーザーを完全削除（退会処理とは別物）
 *
 * 安全方針:
 * - system-admin 認証必須
 * - 本番環境では `ALLOW_DEV_USER_DELETE=true` でないと実行不可
 * - 進行中の業務があれば削除拒否（SCHEDULED/WORKING 応募、未退勤 attendance）
 * - JobWorkDate カウンター（applied/matched）を削除対象 Application 分だけ減算
 * - 削除対象 Review があれば Facility.rating / review_count を再計算
 * - Job.target_worker_id は null 化（求人自体は保持）
 * - UserActivityLog は FK 無しのため残存（履歴保持）
 */
export async function deleteWorkerCompletely(
  identifier: string
): Promise<DeleteWorkerResult> {
  let admin;
  try {
    admin = await requireSystemAdminAuth();
  } catch {
    return { success: false, message: 'システム管理者認証が必要です' };
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEV_USER_DELETE !== 'true'
  ) {
    return {
      success: false,
      message:
        '本番環境ではこの機能は無効です（ALLOW_DEV_USER_DELETE=true で有効化）',
    };
  }

  if (!identifier || !identifier.trim()) {
    return { success: false, message: 'メールアドレスまたはユーザーIDを入力してください' };
  }

  const trimmed = identifier.trim();
  const idAsNumber = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;

  const user = idAsNumber
    ? await prisma.user.findUnique({ where: { id: idAsNumber } })
    : await prisma.user.findFirst({
        where: { email: { equals: trimmed, mode: 'insensitive' } },
      });

  if (!user) {
    return {
      success: false,
      message: `ユーザーが見つかりません（入力値: ${trimmed}）`,
    };
  }

  // --- 事前セーフガード: 施設業務に影響する状態があれば削除拒否 ---
  const blockers: string[] = [];

  // APPLIED も施設側で審査中なのでブロック対象に含める
  const activeApps = await prisma.application.count({
    where: {
      user_id: user.id,
      status: { in: ['APPLIED', 'SCHEDULED', 'WORKING', 'COMPLETED_PENDING'] },
    },
  });
  if (activeApps > 0) {
    blockers.push(
      `審査中/進行中/完了待ちの応募が ${activeApps} 件あります（APPLIED / SCHEDULED / WORKING / COMPLETED_PENDING）。施設側の業務に影響するため削除できません。`
    );
  }

  const activeAttendance = await prisma.attendance.count({
    where: {
      user_id: user.id,
      check_out_time: null,
    },
  });
  if (activeAttendance > 0) {
    blockers.push(
      `未退勤の勤怠レコードが ${activeAttendance} 件あります。退勤処理を完了してから削除してください。`
    );
  }

  // オファー対象になっている未応答求人があれば拒否（施設が候補として保持している）
  const offeredActive = await prisma.job.count({
    where: {
      target_worker_id: user.id,
      status: { in: ['PUBLISHED', 'WORKING'] },
    },
  });
  if (offeredActive > 0) {
    blockers.push(
      `施設から届いている未応答オファー求人が ${offeredActive} 件あります。施設側の候補者管理に影響するため削除できません。`
    );
  }

  // 労働条件通知書のダウンロードトークン（施設が発行中）があれば拒否
  // worker_id は FK 無しなので cascade 削除されず、削除後に dangling 化する
  const pendingLaborDocTokens = await prisma.laborDocumentDownloadToken.count({
    where: {
      worker_id: user.id,
      expires_at: { gt: new Date() },
    },
  });
  if (pendingLaborDocTokens > 0) {
    blockers.push(
      `施設が発行中の労働条件通知書ダウンロードトークンが ${pendingLaborDocTokens} 件あります。期限切れまで待つかトークンを失効させてください。`
    );
  }

  if (blockers.length > 0) {
    return {
      success: false,
      message: '削除前提条件を満たしていません',
      blockers,
    };
  }

  // 監査ログ用: 影響を受けた主要エンティティのIDを収集
  let appIdsForLog: number[] = [];
  let facilityIdsForLog: number[] = [];
  let threadIdsForLog: number[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Job.target_worker_id を null 化（FK onDelete 無しのため必須）
      const offeredJobsCleared = await tx.job.updateMany({
        where: { target_worker_id: user.id },
        data: { target_worker_id: null },
      });

      // 2. 削除対象 Application（キャンセル済み・過去完了済み）を列挙し、
      //    JobWorkDate のカウンターを減算
      const appsToDelete = await tx.application.findMany({
        where: { user_id: user.id },
        select: { id: true, status: true, work_date_id: true },
      });
      appIdsForLog = appsToDelete.map((a) => a.id);

      // MessageThread も削除対象（cascade で消えるので事前に ID を記録）
      const threadsToDelete = await tx.messageThread.findMany({
        where: { worker_id: user.id },
        select: { id: true },
      });
      threadIdsForLog = threadsToDelete.map((t) => t.id);

      let workDateCountersAdjusted = 0;
      // applied_count はすべての非CANCELLED応募、matched_count は SCHEDULED/WORKING/COMPLETED_* でカウントされる想定
      const wdCountMap = new Map<number, { applied: number; matched: number }>();
      for (const app of appsToDelete) {
        if (!app.work_date_id) continue;
        const current = wdCountMap.get(app.work_date_id) ?? { applied: 0, matched: 0 };
        // CANCELLED は applied_count から減算しない（応募時に decrement 済みのはず）
        if (app.status !== 'CANCELLED') {
          current.applied += 1;
        }
        // マッチング成立済みの状態だけ matched を減らす
        if (['WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(app.status)) {
          current.matched += 1;
        }
        wdCountMap.set(app.work_date_id, current);
      }
      for (const [wdId, c] of Array.from(wdCountMap.entries())) {
        if (c.applied === 0 && c.matched === 0) continue;
        await tx.jobWorkDate.update({
          where: { id: wdId },
          data: {
            applied_count: c.applied > 0 ? { decrement: c.applied } : undefined,
            matched_count: c.matched > 0 ? { decrement: c.matched } : undefined,
          },
        });
        workDateCountersAdjusted += 1;
      }

      // 3. 影響を受ける Facility ID を収集（Review 削除に伴う rating 再計算用）
      // 施設の公開評価は「ワーカーが施設を評価した」レビューのみで集計される
      // （既存実装 src/lib/actions/review-worker.ts と同じルール）
      const affectedWorkerReviews = await tx.review.findMany({
        where: { user_id: user.id, reviewer_type: 'WORKER' },
        select: { facility_id: true },
      });
      const affectedFacilityIds = Array.from(
        new Set(affectedWorkerReviews.map((r) => r.facility_id))
      );
      facilityIdsForLog = affectedFacilityIds;
      // 全レビュー削除数（worker→facility + facility→worker）
      const reviewsCount = await tx.review.count({
        where: { user_id: user.id },
      });

      // カウンター取得（削除前）
      const [bookmarksCount, messagesCount, attendancesCount] = await Promise.all([
        tx.bookmark.count({
          where: { OR: [{ user_id: user.id }, { target_user_id: user.id }] },
        }),
        tx.message.count({
          where: { OR: [{ from_user_id: user.id }, { to_user_id: user.id }] },
        }),
        tx.attendance.count({ where: { user_id: user.id } }),
      ]);

      // 4. User 削除（他の関連テーブルは onDelete: Cascade）
      await tx.user.delete({ where: { id: user.id } });

      // 5. Facility rating を再計算（worker→facility レビューのみで平均、小数1桁丸め）
      // 既存 src/lib/actions/review-worker.ts と同じロジックで整合をとる
      let facilityRatingsRecalculated = 0;
      for (const facilityId of affectedFacilityIds) {
        const workerReviews = await tx.review.findMany({
          where: { facility_id: facilityId, reviewer_type: 'WORKER' },
          select: { rating: true },
        });
        const avg =
          workerReviews.length > 0
            ? workerReviews.reduce((s, r) => s + r.rating, 0) / workerReviews.length
            : 0;
        await tx.facility.update({
          where: { id: facilityId },
          data: {
            rating: Math.round(avg * 10) / 10,
            review_count: workerReviews.length,
          },
        });
        facilityRatingsRecalculated += 1;
      }

      return {
        applications: appsToDelete.length,
        bookmarks: bookmarksCount,
        messages: messagesCount,
        reviews: reviewsCount,
        attendances: attendancesCount,
        offeredJobsCleared: offeredJobsCleared.count,
        workDateCountersAdjusted,
        facilityRatingsRecalculated,
      };
    });

    logActivity({
      userType: 'SYSTEM_ADMIN',
      userId: admin.adminId,
      userEmail: admin.email,
      action: 'DELETE_USER_TEST',
      targetType: 'User',
      targetId: user.id,
      requestData: {
        deletedUserId: user.id,
        deletedUserEmail: user.email,
        deletedUserName: user.name,
        counts: result,
        // 追跡用: 削除で影響を受けた主要エンティティ ID 群
        impactedApplicationIds: appIdsForLog,
        impactedFacilityIds: facilityIdsForLog,
        impactedMessageThreadIds: threadIdsForLog,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return {
      success: true,
      deletedUser: { id: user.id, email: user.email, name: user.name },
      counts: result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[deleteWorkerCompletely] Error:', error);

    logActivity({
      userType: 'SYSTEM_ADMIN',
      userId: admin.adminId,
      userEmail: admin.email,
      action: 'DELETE_USER_TEST_FAILED',
      targetType: 'User',
      targetId: user.id,
      result: 'ERROR',
      errorMessage: message,
    }).catch(() => {});

    return {
      success: false,
      message: `削除に失敗しました: ${message}`,
    };
  }
}
