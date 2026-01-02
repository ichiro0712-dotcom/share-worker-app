'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getAuthenticatedUser, createNotification } from './helpers';
import { sendNotification } from '../notification-service';
import { getFacilityUnreadMessageCount, getWorkerUnreadMessageCount } from './message';

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
 * @param isInterviewJob - 審査あり求人の場合true（WORKER_INTERVIEW_ACCEPTEDを使用）
 */
export async function sendMatchingNotification(
    userId: number,
    jobTitle: string,
    facilityName: string,
    jobId: number,
    applicationId?: number,
    workDateInfo?: { workDate: Date; startTime: string; endTime: string },
    isInterviewJob: boolean = false
) {
    // DB通知作成
    await createNotification({
        userId,
        type: 'APPLICATION_APPROVED',
        title: 'マッチングが成立しました',
        message: `${facilityName}の「${jobTitle}」への応募が承認されました。`,
        link: `/jobs/${jobId}`,
    });

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
    });

    if (user && applicationId) {
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            select: { hourly_wage: true }
        });

        // 勤務日時情報をフォーマット
        const formattedWorkDate = workDateInfo?.workDate
            ? new Date(workDateInfo.workDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
            })
            : '';

        // 通知サービス経由で送信
        // 審査あり求人の場合はWORKER_INTERVIEW_ACCEPTED、それ以外はWORKER_MATCHED
        const notificationKey = isInterviewJob ? 'WORKER_INTERVIEW_ACCEPTED' : 'WORKER_MATCHED';

        await sendNotification({
            notificationKey,
            targetType: 'WORKER',
            recipientId: userId,
            recipientName: user.name,
            recipientEmail: user.email,
            applicationId: applicationId,
            variables: {
                worker_name: user.name,
                facility_name: facilityName,
                job_title: jobTitle,
                wage: job?.hourly_wage?.toLocaleString() || '',
                job_url: `${process.env.NEXT_PUBLIC_APP_URL}/jobs/${jobId}`,
                work_date: formattedWorkDate,
                start_time: workDateInfo?.startTime || '',
                end_time: workDateInfo?.endTime || '',
            },
        });
    }
}

/**
 * 新規応募通知を送信（施設宛）
 * @param notificationKey - 通知キー（デフォルト: 'FACILITY_NEW_APPLICATION'、オファー受諾: 'FACILITY_OFFER_ACCEPTED'）
 */
export async function sendApplicationNotification(
    facilityId: number,
    workerName: string,
    jobTitle: string,
    applicationId: number,
    notificationKey: string = 'FACILITY_NEW_APPLICATION'
) {
    try {
        // 応募情報を取得（勤務日を取得するため）
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                workDate: {
                    include: {
                        job: {
                            select: { facility_id: true }
                        }
                    }
                }
            }
        });

        if (!application) {
            console.error('[sendApplicationNotification] Application not found:', applicationId);
            return;
        }

        // 施設情報を取得
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { facility_name: true }
        });
        const facilityName = facility?.facility_name || '';

        // 勤務日をフォーマット
        const workDate = new Date(application.workDate.work_date).toLocaleDateString('ja-JP', {
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });

        // 施設管理者を取得（通知先）
        const admins = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
        });

        if (admins.length === 0) {
            console.warn('[sendApplicationNotification] No facility admins found for facility:', facilityId);
            return;
        }

        // 全管理者に通知送信
        for (const admin of admins) {
            await sendNotification({
                notificationKey: notificationKey,
                targetType: 'FACILITY',
                recipientId: admin.id,
                recipientName: admin.name,
                recipientEmail: admin.email,
                facilityEmails: admins.map(a => a.email), // 全管理者にメール送信
                applicationId: applicationId,
                variables: {
                    facility_name: facilityName,
                    worker_name: workerName,
                    job_title: jobTitle,
                    work_date: workDate,
                    job_url: `${process.env.NEXTAUTH_URL || 'https://tastas.jp'}/admin/applications`, // 施設管理画面の応募一覧へ
                },
            });
        }

        console.log('[sendApplicationNotification] Notification sent to admins count:', admins.length, 'key:', notificationKey);

    } catch (error) {
        console.error('[sendApplicationNotification] Error:', error);
    }
}

/**
 * 複数勤務日への応募通知を送信（施設宛）
 * 1つのメッセージに複数勤務日を羅列する
 */
export async function sendApplicationNotificationMultiple(
    facilityId: number,
    workerName: string,
    jobTitle: string,
    applicationId: number,
    workDates: string[]
) {
    try {
        // 施設情報を取得
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { facility_name: true }
        });
        const facilityName = facility?.facility_name || '';

        // 勤務日をフォーマット（複数の場合は羅列）
        const workDateText = workDates.length === 1
            ? workDates[0]
            : workDates.map(d => `・${d}`).join('\n');

        // 施設管理者を取得（通知先）
        const admins = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
        });

        if (admins.length === 0) {
            console.warn('[sendApplicationNotificationMultiple] No facility admins found for facility:', facilityId);
            return;
        }

        // 全管理者に通知送信
        for (const admin of admins) {
            await sendNotification({
                notificationKey: 'FACILITY_NEW_APPLICATION',
                targetType: 'FACILITY',
                recipientId: admin.id,
                recipientName: admin.name,
                recipientEmail: admin.email,
                facilityEmails: admins.map(a => a.email),
                applicationId: applicationId,
                variables: {
                    facility_name: facilityName,
                    worker_name: workerName,
                    job_title: jobTitle,
                    work_date: workDateText,
                    job_url: `${process.env.NEXTAUTH_URL || 'https://tastas.jp'}/admin/applications`,
                },
            });
        }

        console.log('[sendApplicationNotificationMultiple] Notification sent to admins count:', admins.length, 'for', workDates.length, 'dates');

    } catch (error) {
        console.error('[sendApplicationNotificationMultiple] Error:', error);
    }
}

export async function sendReviewRequestNotification(
    userId: number,
    facilityName: string,
    jobTitle: string,
    applicationId: number
) {
    await createNotification({
        userId,
        type: 'REVIEW_REQUEST',
        title: '評価をお願いします',
        message: `${facilityName}での「${jobTitle}」の勤務が完了しました。評価をお願いします。`,
        link: `/mypage/reviews/${applicationId}`,
    });

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
    });

    if (user) {
        await sendNotification({
            notificationKey: 'WORKER_REVIEW_REQUEST',
            targetType: 'WORKER',
            recipientId: userId,
            recipientName: user.name,
            recipientEmail: user.email,
            applicationId: applicationId,
            variables: {
                worker_name: user.name,
                facility_name: facilityName,
                job_title: jobTitle,
                review_url: `${process.env.NEXT_PUBLIC_APP_URL}/mypage/reviews/${applicationId}`,
            },
        });
    }
}

/**
 * 施設向けレビュー依頼通知を送信
 * ワーカーの勤務完了時に施設へレビュー依頼を送信
 */
export async function sendFacilityReviewRequestNotification(
    facilityId: number,
    workerName: string,
    jobTitle: string,
    applicationId: number
) {
    try {
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { facility_name: true },
        });
        if (!facility) return null;

        const facilityAdmins = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
            select: { id: true, name: true, email: true },
        });
        if (facilityAdmins.length === 0) return null;

        const facilityEmails = facilityAdmins.map(admin => admin.email);
        const primaryAdmin = facilityAdmins[0];

        await sendNotification({
            notificationKey: 'FACILITY_REVIEW_REQUEST',
            targetType: 'FACILITY',
            recipientId: primaryAdmin.id,
            recipientName: primaryAdmin.name,
            facilityEmails,
            applicationId,
            variables: {
                facility_name: facility.facility_name,
                worker_name: workerName,
                job_title: jobTitle,
                review_url: `${process.env.NEXTAUTH_URL || 'https://tastas.jp'}/admin/reviews`,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('[sendFacilityReviewRequestNotification] Error:', error);
        return null;
    }
}

/**
 * 応募キャンセル通知を送信（ワーカー宛）
 * 施設がマッチング済み応募をキャンセルした場合に送信
 */
export async function sendCancelNotification(
    userId: number,
    jobTitle: string,
    facilityName: string,
    workDate: string,
    jobId: number,
    timeInfo?: { startTime: string; endTime: string }
) {
    await createNotification({
        userId,
        type: 'APPLICATION_CANCELLED',
        title: 'マッチングがキャンセルされました',
        message: `${facilityName}の「${jobTitle}」（${workDate}）のマッチングがキャンセルされました。`,
        link: `/jobs/${jobId}`,
    });

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
    });

    if (user) {
        await sendNotification({
            notificationKey: 'WORKER_CANCELLED_BY_FACILITY',
            targetType: 'WORKER',
            recipientId: userId,
            recipientName: user.name,
            recipientEmail: user.email,
            variables: {
                worker_name: user.name,
                facility_name: facilityName,
                job_title: jobTitle,
                work_date: workDate,
                job_url: `${process.env.NEXT_PUBLIC_APP_URL}/jobs/${jobId}`,
                start_time: timeInfo?.startTime || '',
                end_time: timeInfo?.endTime || '',
            }
        });
    }
}

/**
 * レビュー受信通知を送信（施設宛）
 * ワーカーがレビューを投稿した時に施設へ通知
 */
export async function sendReviewReceivedNotificationToFacility(
    facilityId: number,
    workerName: string,
    _rating: number
) {
    try {
        // 施設情報を取得
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { facility_name: true },
        });

        if (!facility) return null;

        // 施設管理者のメールアドレスを取得
        const facilityAdmins = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
            select: { id: true, name: true, email: true },
        });

        if (facilityAdmins.length === 0) return null;

        const facilityEmails = facilityAdmins.map(admin => admin.email);
        const primaryAdmin = facilityAdmins[0];

        await sendNotification({
            notificationKey: 'FACILITY_REVIEW_RECEIVED',
            targetType: 'FACILITY',
            recipientId: primaryAdmin.id,
            recipientName: primaryAdmin.name,
            facilityEmails,
            variables: {
                facility_name: facility.facility_name,
                worker_name: workerName,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('[sendReviewReceivedNotificationToFacility] Error:', error);
        return null;
    }
}

/**
 * レビュー受信通知を送信（ワーカー宛）
 * 施設がレビューを投稿した時にワーカーへ通知
 */
export async function sendReviewReceivedNotificationToWorker(
    userId: number,
    facilityName: string
) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });

        if (!user) return null;

        await sendNotification({
            notificationKey: 'WORKER_REVIEW_RECEIVED',
            targetType: 'WORKER',
            recipientId: userId,
            recipientName: user.name,
            recipientEmail: user.email,
            variables: {
                worker_name: user.name,
                facility_name: facilityName,
                review_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/mypage/reviews`,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('[sendReviewReceivedNotificationToWorker] Error:', error);
        return null;
    }
}

/**
 * 募集枠が埋まった通知を送信（施設宛）
 * 求人日の募集枠が全て埋まった時に施設へ通知
 */
export async function sendSlotsFilled(
    facilityId: number,
    jobTitle: string,
    workDate: string
) {
    try {
        const facilityAdmins = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
            select: { id: true, name: true, email: true },
        });

        if (facilityAdmins.length === 0) return null;

        const facilityEmails = facilityAdmins.map(admin => admin.email);
        const primaryAdmin = facilityAdmins[0];

        await sendNotification({
            notificationKey: 'FACILITY_SLOTS_FILLED',
            targetType: 'FACILITY',
            recipientId: primaryAdmin.id,
            recipientName: primaryAdmin.name,
            facilityEmails,
            variables: {
                job_title: jobTitle,
                work_date: workDate,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('[sendSlotsFilled] Error:', error);
        return null;
    }
}

/**
 * お気に入り施設の新着求人通知を送信（ワーカー宛）
 * 施設が新しい求人を作成した時に、その施設をお気に入りしているワーカーに通知
 */
export async function sendFavoriteNewJobNotification(
    facilityId: number,
    facilityName: string,
    jobId: number
) {
    try {
        // この施設をお気に入りしているワーカーを取得
        const bookmarks = await prisma.bookmark.findMany({
            where: {
                target_facility_id: facilityId,
                user_id: { not: null },
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        if (bookmarks.length === 0) {
            console.log('[sendFavoriteNewJobNotification] No bookmarks found for facility:', facilityId);
            return { success: true, count: 0 };
        }

        let sentCount = 0;
        for (const bookmark of bookmarks) {
            if (!bookmark.user) continue;

            await sendNotification({
                notificationKey: 'WORKER_FAVORITE_NEW_JOB',
                targetType: 'WORKER',
                recipientId: bookmark.user.id,
                recipientName: bookmark.user.name,
                recipientEmail: bookmark.user.email,
                variables: {
                    facility_name: facilityName,
                    job_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/jobs/${jobId}`,
                },
            });
            sentCount++;
        }

        console.log('[sendFavoriteNewJobNotification] Sent to', sentCount, 'workers');
        return { success: true, count: sentCount };
    } catch (error) {
        console.error('[sendFavoriteNewJobNotification] Error:', error);
        return null;
    }
}

/**
 * 施設向け未認識の応募数を取得
 */
export async function getFacilityPendingApplicationCount(facilityId: number): Promise<{
    total: number;
    byJob: Array<{ jobId: number; jobTitle: string; count: number }>;
    byWorker: Array<{ workerId: number; workerName: string; count: number }>;
}> {
    try {
        const pendingApplications = await prisma.application.findMany({
            where: {
                workDate: {
                    job: {
                        facility_id: facilityId,
                    },
                },
                status: 'APPLIED',
            },
            include: {
                workDate: {
                    include: {
                        job: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        const jobMap = new Map<number, { jobTitle: string; count: number }>();
        const workerMap = new Map<number, { workerName: string; count: number }>();

        pendingApplications.forEach((app) => {
            const job = app.workDate.job;
            const existing = jobMap.get(job.id);
            if (existing) {
                existing.count++;
            } else {
                jobMap.set(job.id, { jobTitle: job.title, count: 1 });
            }

            const existingWorker = workerMap.get(app.user.id);
            if (existingWorker) {
                existingWorker.count++;
            } else {
                workerMap.set(app.user.id, { workerName: app.user.name, count: 1 });
            }
        });

        return {
            total: pendingApplications.length,
            byJob: Array.from(jobMap.entries()).map(([jobId, data]) => ({
                jobId,
                jobTitle: data.jobTitle,
                count: data.count,
            })),
            byWorker: Array.from(workerMap.entries()).map(([workerId, data]) => ({
                workerId,
                workerName: data.workerName,
                count: data.count,
            })),
        };
    } catch (error) {
        console.error('[getFacilityPendingApplicationCount] Error:', error);
        return { total: 0, byJob: [], byWorker: [] };
    }
}

/**
 * 施設向けサイドバー通知バッジ情報を一括取得
 */
export async function getFacilitySidebarBadges(facilityId: number): Promise<{
    unreadMessages: number;
    pendingApplications: number;
    unreadAnnouncements: number;
    pendingReviews: number;
}> {
    try {
        const [unreadMessages, unviewedCount, unreadAnnouncementsCount, pendingReviewCount] = await Promise.all([
            getFacilityUnreadMessageCount(facilityId),
            prisma.application.count({
                where: {
                    workDate: {
                        job: {
                            facility_id: facilityId,
                        },
                    },
                    status: { in: ['APPLIED', 'SCHEDULED'] },
                    facility_viewed_at: null,
                },
            }),
            prisma.announcementRecipient.count({
                where: {
                    recipient_type: 'FACILITY',
                    recipient_id: facilityId,
                    is_read: false,
                },
            }),
            // 未入力レビュー（COMPLETED_PENDING = レビュー待ち）の件数
            prisma.application.count({
                where: {
                    workDate: {
                        job: {
                            facility_id: facilityId,
                        },
                    },
                    status: 'COMPLETED_PENDING',
                },
            }),
        ]);

        return {
            unreadMessages,
            pendingApplications: unviewedCount,
            unreadAnnouncements: unreadAnnouncementsCount,
            pendingReviews: pendingReviewCount,
        };
    } catch (error) {
        console.error('[getFacilitySidebarBadges] Error:', error);
        return {
            unreadMessages: 0,
            pendingApplications: 0,
            unreadAnnouncements: 0,
            pendingReviews: 0,
        };
    }
}


/**
 * ワーカーのフッターメニュー用バッジデータを取得
 */
export async function getWorkerFooterBadges(userId: number): Promise<{
    unreadMessages: number;
    unreadAnnouncements: number;
}> {
    try {
        const [unreadMessages, unreadAnnouncementsCount] = await Promise.all([
            getWorkerUnreadMessageCount(userId),
            prisma.announcementRecipient.count({
                where: {
                    recipient_type: 'USER',
                    recipient_id: userId,
                    is_read: false,
                },
            }),
        ]);

        return {
            unreadMessages,
            unreadAnnouncements: unreadAnnouncementsCount,
        };
    } catch (error) {
        console.error('[getWorkerFooterBadges] Error:', error);
        return {
            unreadMessages: 0,
            unreadAnnouncements: 0,
        };
    }
}
export async function sendMessageNotificationToWorker(
  userId: number,
  facilityName: string,
  applicationId: number
) {
  // アプリ内通知を作成
  const notification = await createNotification({
    userId,
    type: 'NEW_MESSAGE',
    title: '新しいメッセージが届きました',
    message: `${facilityName}からメッセージが届きました。`,
    link: `/messages/${applicationId}`,
  });

  // 外部通知（メール・LINE・プッシュ）を送信
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await sendNotification({
        notificationKey: 'WORKER_NEW_MESSAGE',
        targetType: 'WORKER',
        recipientId: userId,
        recipientName: user.name,
        recipientEmail: user.email,
        applicationId,
        variables: {
          facility_name: facilityName,
          worker_name: user.name,
          message_url: `${process.env.NEXTAUTH_URL || 'https://tastas.jp'}/messages`,
        },
      });
    }
  } catch (error) {
    console.error('[sendMessageNotificationToWorker] Error sending external notification:', error);
  }

  return notification;
}

/**
 * メッセージ受信通知を送信（施設宛）
 * 注: 現在のNotificationモデルはuser_idのみ対応。施設向け通知はメール/プッシュのみ
 */
export async function sendMessageNotificationToFacility(
  facilityId: number,
  workerName: string,
  applicationId: number
) {
  try {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: { admins: true },
    });

    if (facility) {
      const facilityEmails = facility.admins.map(a => a.email);

      await sendNotification({
        notificationKey: 'FACILITY_NEW_MESSAGE',
        targetType: 'FACILITY',
        recipientId: facilityId,
        recipientName: facility.facility_name,
        facilityEmails,
        applicationId,
        variables: {
          worker_name: workerName,
          facility_name: facility.facility_name,
          message_url: `${process.env.NEXTAUTH_URL || 'https://tastas.jp'}/admin/messages`,
        },
      });
    }
  } catch (error) {
    console.error('[sendMessageNotificationToFacility] Error sending notification:', error);
  }
}

// ========================================
// システム管理者向け通知
// ========================================

/**
 * 新規施設登録通知（システム管理者宛）
 */
export async function sendAdminNewFacilityNotification(
    facilityId: number,
    facilityName: string,
    corporationName: string
) {
    try {
        // システム管理者を取得
        const admins = await prisma.systemAdmin.findMany({
            select: { id: true, name: true, email: true },
        });

        if (admins.length === 0) return null;

        for (const admin of admins) {
            await sendNotification({
                notificationKey: 'ADMIN_NEW_FACILITY',
                targetType: 'SYSTEM_ADMIN',
                recipientId: admin.id,
                recipientName: admin.name,
                recipientEmail: admin.email,
                variables: {
                    facility_name: facilityName,
                    corporation_name: corporationName,
                    facility_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/system-admin/facilities/${facilityId}`,
                },
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[sendAdminNewFacilityNotification] Error:', error);
        return null;
    }
}

/**
 * 新規ワーカー登録通知（システム管理者宛）
 */
export async function sendAdminNewWorkerNotification(
    workerId: number,
    workerName: string,
    workerEmail: string
) {
    try {
        const admins = await prisma.systemAdmin.findMany({
            select: { id: true, name: true, email: true },
        });

        if (admins.length === 0) return null;

        for (const admin of admins) {
            await sendNotification({
                notificationKey: 'ADMIN_NEW_WORKER',
                targetType: 'SYSTEM_ADMIN',
                recipientId: admin.id,
                recipientName: admin.name,
                recipientEmail: admin.email,
                variables: {
                    worker_name: workerName,
                    worker_email: workerEmail,
                    worker_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/system-admin/workers/${workerId}`,
                },
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[sendAdminNewWorkerNotification] Error:', error);
        return null;
    }
}

/**
 * 高キャンセル率警告（システム管理者宛）
 * @param targetType 'WORKER' | 'FACILITY'
 * @param targetId ワーカーIDまたは施設ID
 * @param targetName 対象者名
 * @param cancelRate キャンセル率（%）
 */
export async function sendAdminHighCancelRateNotification(
    targetType: 'WORKER' | 'FACILITY',
    targetId: number,
    targetName: string,
    cancelRate: number
) {
    try {
        const admins = await prisma.systemAdmin.findMany({
            select: { id: true, name: true, email: true },
        });

        if (admins.length === 0) return null;

        const targetUrl = targetType === 'WORKER'
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/system-admin/workers/${targetId}`
            : `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/system-admin/facilities/${targetId}`;

        for (const admin of admins) {
            await sendNotification({
                notificationKey: 'ADMIN_HIGH_CANCEL_RATE',
                targetType: 'SYSTEM_ADMIN',
                recipientId: admin.id,
                recipientName: admin.name,
                recipientEmail: admin.email,
                variables: {
                    target_type: targetType === 'WORKER' ? 'ワーカー' : '施設',
                    target_name: targetName,
                    cancel_rate: `${cancelRate.toFixed(1)}%`,
                    target_url: targetUrl,
                },
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[sendAdminHighCancelRateNotification] Error:', error);
        return null;
    }
}

/**
 * 低評価連続警告（システム管理者宛）
 */
export async function sendAdminLowRatingStreakNotification(
    targetType: 'WORKER' | 'FACILITY',
    targetId: number,
    targetName: string,
    streakCount: number,
    avgRating: number
) {
    try {
        const admins = await prisma.systemAdmin.findMany({
            select: { id: true, name: true, email: true },
        });

        if (admins.length === 0) return null;

        const targetUrl = targetType === 'WORKER'
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/system-admin/workers/${targetId}`
            : `${process.env.NEXT_PUBLIC_APP_URL || 'https://tastas.jp'}/system-admin/facilities/${targetId}`;

        for (const admin of admins) {
            await sendNotification({
                notificationKey: 'ADMIN_LOW_RATING_STREAK',
                targetType: 'SYSTEM_ADMIN',
                recipientId: admin.id,
                recipientName: admin.name,
                recipientEmail: admin.email,
                variables: {
                    target_type: targetType === 'WORKER' ? 'ワーカー' : '施設',
                    target_name: targetName,
                    streak_count: String(streakCount),
                    avg_rating: avgRating.toFixed(1),
                    target_url: targetUrl,
                },
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[sendAdminLowRatingStreakNotification] Error:', error);
        return null;
    }
}

// ========================================
// 施設情報の取得・更新
// ========================================
