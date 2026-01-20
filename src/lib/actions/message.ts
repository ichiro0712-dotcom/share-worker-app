'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedUser, formatMessageTime } from './helpers';
import { revalidatePath } from 'next/cache';

import { sendMessageNotificationToWorker, sendMessageNotificationToFacility } from './notification';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

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

    // 未読メッセージ数を一括取得（N+1クエリ対策）
    const applicationIds = applications.map((app) => app.id);
    const unreadCounts = await prisma.message.groupBy({
      by: ['application_id'],
      where: {
        application_id: { in: applicationIds },
        to_user_id: user.id,
        read_at: null,
      },
      _count: {
        id: true,
      },
    });

    // application_id -> unreadCount のマップを作成
    const unreadCountMap = new Map(
      unreadCounts.map((item) => [item.application_id, item._count.id])
    );

    // 会話形式に変換
    const conversations = applications.map((app) => {
      const lastMessage = app.messages[0];
      const unreadCount = unreadCountMap.get(app.id) || 0;

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
    });

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

    // メッセージ一覧を取得（ワーカー向けのみ表示）
    // - to_facility_id が設定されているメッセージは施設専用なので除外
    const messages = await prisma.message.findMany({
      where: {
        application_id: applicationId,
        to_facility_id: null, // 施設専用メッセージは除外
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
        updated_by_type: 'WORKER',
        updated_by_id: user.id,
      },
    });

    // 応募の更新日時を更新
    await prisma.application.update({
      where: { id: applicationId },
      data: { updated_at: new Date(), updated_by_type: 'WORKER', updated_by_id: user.id },
    });

    // 施設への通知を送信
    await sendMessageNotificationToFacility(
      application.workDate.job.facility_id,
      user.name,
      applicationId
    );

    console.log('[sendMessage] Message sent successfully:', message.id);

    revalidatePath('/messages');

    // メッセージ送信成功をログ記録
    logActivity({
      userType: 'WORKER',
      userId: user.id,
      userEmail: user.email,
      action: 'MESSAGE_SEND',
      targetType: 'Message',
      targetId: message.id,
      requestData: {
        applicationId,
        toFacilityId: application.workDate.job.facility_id,
        contentLength: content.length,
      },
      result: 'SUCCESS',
    }).catch(() => {});

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

    // メッセージ送信失敗をログ記録
    // エラー時もユーザー情報を取得してログに含める
    let failedUserId: number | undefined;
    let failedUserEmail: string | undefined;
    try {
      const failedUser = await getAuthenticatedUser();
      failedUserId = failedUser.id;
      failedUserEmail = failedUser.email;
    } catch {
      // ユーザー取得失敗は無視
    }
    logActivity({
      userType: 'WORKER',
      userId: failedUserId,
      userEmail: failedUserEmail,
      action: 'MESSAGE_SEND_FAILED',
      requestData: { applicationId },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

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

    // 未読メッセージ数を一括取得（N+1クエリ対策）
    const applicationIds = applications.map((app) => app.id);
    const unreadCounts = await prisma.message.groupBy({
      by: ['application_id'],
      where: {
        application_id: { in: applicationIds },
        to_facility_id: facilityId,
        read_at: null,
      },
      _count: {
        id: true,
      },
    });

    // application_id -> unreadCount のマップを作成
    const unreadCountMap = new Map(
      unreadCounts.map((item) => [item.application_id, item._count.id])
    );

    // 会話形式に変換
    const conversations = applications.map((app) => {
      const lastMessage = app.messages[0];
      const unreadCount = unreadCountMap.get(app.id) || 0;

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
    });

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
    // ワーカー専用のシステム通知（to_user_id設定済み）は除外
    const messages = await prisma.message.findMany({
      where: {
        application_id: applicationId,
        to_user_id: null, // ワーカー専用メッセージは除外
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
  content: string,
  attachments: string[] = [],
  adminId?: number
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
        attachments,
        ...(adminId && { updated_by_type: 'FACILITY_ADMIN', updated_by_id: adminId }),
      },
    });

    // 応募の更新日時を更新
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        updated_at: new Date(),
        ...(adminId && { updated_by_type: 'FACILITY_ADMIN', updated_by_id: adminId }),
      },
    });

    // ワーカーへの通知を送信
    await sendMessageNotificationToWorker(
      application.user_id,
      application.workDate.job.facility.facility_name,
      applicationId
    );

    console.log('[sendFacilityMessage] Message sent successfully:', message.id);

    revalidatePath('/admin/messages');

    // 施設からのメッセージ送信成功をログ記録
    // 施設管理者セッション情報を取得
    const facilitySession = await getFacilityAdminSessionData();
    logActivity({
      userType: 'FACILITY',
      userId: facilitySession?.adminId,
      userEmail: facilitySession?.email,
      action: 'MESSAGE_SEND',
      targetType: 'Message',
      targetId: message.id,
      requestData: {
        applicationId,
        fromFacilityId: facilityId,
        toUserId: application.user_id,
        contentLength: content.length,
        hasAttachments: attachments.length > 0,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return {
      success: true,
      message: {
        id: message.id,
        senderType: 'facility' as const,
        senderName: application.workDate.job.facility.facility_name,
        content: message.content,
        attachments: message.attachments,
        timestamp: message.created_at.toISOString(),
        isRead: false,
      },
    };
  } catch (error) {
    console.error('[sendFacilityMessage] Error:', error);

    // 施設からのメッセージ送信失敗をログ記録
    // エラー時も施設管理者セッション情報を取得してログに含める
    let failedAdminId: number | undefined;
    let failedAdminEmail: string | undefined;
    try {
      const failedSession = await getFacilityAdminSessionData();
      failedAdminId = failedSession?.adminId;
      failedAdminEmail = failedSession?.email;
    } catch {
      // セッション取得失敗は無視
    }
    logActivity({
      userType: 'FACILITY',
      userId: failedAdminId,
      userEmail: failedAdminEmail,
      action: 'MESSAGE_SEND_FAILED',
      requestData: { applicationId, facilityId },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

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
// 評価機能 (Review Functions)
// ========================================

/**
 * 評価待ちの応募一覧を取得（完了済みで未評価のもの）
 */
export async function getFacilityUnreadMessageCount(facilityId: number): Promise<number> {
  try {
    // 並列で取得
    const [messageCount, systemNotificationCount] = await Promise.all([
      // 施設宛の未読メッセージ数をカウント（ワーカーからのメッセージ）
      prisma.message.count({
        where: {
          to_facility_id: facilityId,
          read_at: null,
        },
      }),
      // SystemNotificationテーブルの未読数をカウント（運営からのシステム通知）
      prisma.systemNotification.count({
        where: {
          target_type: 'FACILITY',
          recipient_id: facilityId,
          read_at: null,
        },
      }),
    ]);

    return messageCount + systemNotificationCount;
  } catch (error) {
    console.error('[getFacilityUnreadMessageCount] Error:', error);
    return 0;
  }
}

/**
 * 施設の新規応募数を取得（APPLIED状態の応募 = 未対応の応募）
 */
export async function getWorkerUnreadMessageCount(userId: number): Promise<number> {
  try {
    // ワーカー宛の未読メッセージ数をカウント
    // to_user_idでフィルタすることで、施設からのメッセージとシステム通知の両方を含む
    const count = await prisma.message.count({
      where: {
        to_user_id: userId,
        read_at: null,
      },
    });

    return count;
  } catch (error) {
    console.error('[getWorkerUnreadMessageCount] Error:', error);
    return 0;
  }
}

/**
 * ワーカーのフッターメニュー用バッジデータを取得
 */
export async function getGroupedConversations() {
  const user = await getAuthenticatedUser();

  // ユーザーの全応募を取得（施設情報付き）
  // ID-82/86対応: APPLIED（審査待ち）やCANCELLED（不採用）でもメッセージがある場合は表示
  const applications = await prisma.application.findMany({
    where: {
      user_id: user.id,
      OR: [
        { status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] } },
        { messages: { some: {} } }, // メッセージがある応募は全て表示
      ],
    },
    include: {
      workDate: {
        include: {
          job: {
            include: { facility: true },
          },
        },
      },
      messages: {
        where: { to_facility_id: null }, // 施設専用メッセージは除外
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  // MessageThreadベースのオファーメッセージも取得
  const threads = await prisma.messageThread.findMany({
    where: {
      worker_id: user.id,
    },
    include: {
      facility: true,
      messages: {
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  // スレッドの未読メッセージ数を一括取得（N+1クエリ対策）
  const threadIds = threads.map((thread) => thread.id);
  const threadUnreadCounts = await prisma.message.groupBy({
    by: ['thread_id'],
    where: {
      thread_id: { in: threadIds },
      to_user_id: user.id,
      read_at: null,
    },
    _count: {
      id: true,
    },
  });

  // thread_id -> unreadCount のマップを作成
  const threadUnreadCountMap = new Map(
    threadUnreadCounts.map((item) => [item.thread_id, item._count.id])
  );

  // 施設ごとにグループ化
  const facilityMap = new Map<number, {
    facilityId: number;
    facilityName: string;
    facilityDisplayName: string;  // 担当者名付きの表示名
    staffAvatar: string | null;    // 担当者アバター
    applicationIds: number[];
    threadIds: number[];           // オファー用スレッドID
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
  }>();

  // 応募ベースのメッセージを処理
  for (const app of applications) {
    const facility = app.workDate?.job?.facility;
    if (!facility) continue;

    // 担当者名と表示名の生成
    const staffName = facility.staff_last_name && facility.staff_first_name
      ? `${facility.staff_last_name} ${facility.staff_first_name}`
      : '';
    const facilityDisplayName = staffName
      ? `${facility.facility_name}（${staffName}）`
      : facility.facility_name;
    const staffAvatar = facility.staff_photo || null;

    const existing = facilityMap.get(facility.id);
    const lastMsg = app.messages[0];
    const unread = app.messages.filter(m => !m.read_at && m.from_facility_id).length;

    if (existing) {
      existing.applicationIds.push(app.id);
      existing.unreadCount += unread;
      if (lastMsg && lastMsg.created_at > existing.lastMessageTime) {
        existing.lastMessage = lastMsg.content;
        existing.lastMessageTime = lastMsg.created_at;
      }
    } else {
      facilityMap.set(facility.id, {
        facilityId: facility.id,
        facilityName: facility.facility_name,
        facilityDisplayName,
        staffAvatar,
        applicationIds: [app.id],
        threadIds: [],
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg?.created_at || app.created_at,
        unreadCount: unread,
      });
    }
  }

  // スレッドベースのオファーメッセージを処理
  for (const thread of threads) {
    const facility = thread.facility;
    if (!facility) continue;

    // 担当者名と表示名の生成
    const staffName = facility.staff_last_name && facility.staff_first_name
      ? `${facility.staff_last_name} ${facility.staff_first_name}`
      : '';
    const facilityDisplayName = staffName
      ? `${facility.facility_name}（${staffName}）`
      : facility.facility_name;
    const staffAvatar = facility.staff_photo || null;

    const existing = facilityMap.get(facility.id);
    const lastMsg = thread.messages[0];
    const unread = threadUnreadCountMap.get(thread.id) || 0;

    if (existing) {
      existing.threadIds.push(thread.id);
      existing.unreadCount += unread;
      if (lastMsg && lastMsg.created_at > existing.lastMessageTime) {
        existing.lastMessage = lastMsg.content;
        existing.lastMessageTime = lastMsg.created_at;
      }
    } else {
      facilityMap.set(facility.id, {
        facilityId: facility.id,
        facilityName: facility.facility_name,
        facilityDisplayName,
        staffAvatar,
        applicationIds: [],
        threadIds: [thread.id],
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg?.created_at || thread.created_at,
        unreadCount: unread,
      });
    }
  }

  return Array.from(facilityMap.values()).sort(
    (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );
}

/**
 * ワーカー用: 特定施設との全メッセージを取得
 */
export async function getMessagesByFacility(
  facilityId: number,
  options?: { cursor?: number; limit?: number; markAsRead?: boolean }
) {
  const user = await getAuthenticatedUser();
  const limit = options?.limit || 50;
  const cursor = options?.cursor;
  const markAsRead = options?.markAsRead ?? true;

  // この施設との全応募IDを取得
  const applications = await prisma.application.findMany({
    where: {
      user_id: user.id,
      workDate: {
        job: { facility_id: facilityId },
      },
    },
    select: {
      id: true,
    },
  });

  const applicationIds = applications.map(a => a.id);

  // この施設とのMessageThreadを取得（オファー用）
  const thread = await prisma.messageThread.findUnique({
    where: {
      worker_id_facility_id: {
        worker_id: user.id,
        facility_id: facilityId,
      },
    },
  });

  // 施設情報を別途取得（担当者情報含む）
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: {
      id: true,
      facility_name: true,
      staff_first_name: true,
      staff_last_name: true,
      staff_photo: true,
    },
  });

  // メッセージをページネーションで取得（最新から）
  // ワーカー向け:
  // - application_idベース: 応募に関連するメッセージ
  // - thread_idベース: オファーに関連するメッセージ
  const whereConditions: any[] = [];

  // 応募ベースのメッセージ
  if (applicationIds.length > 0) {
    whereConditions.push({
      application_id: { in: applicationIds },
      OR: [
        { to_facility_id: null }, // 施設からワーカーへのメッセージ
        { from_user_id: user.id }, // 自分が送ったメッセージ
      ],
    });
  }

  // スレッドベースのメッセージ（オファー）
  if (thread) {
    whereConditions.push({
      thread_id: thread.id,
    });
  }

  // どちらもない場合は空のメッセージを返す
  if (whereConditions.length === 0) {
    return {
      facilityId,
      facilityName: facility?.facility_name || '',
      facilityDisplayName: facility?.facility_name || '施設',
      staffAvatar: facility?.staff_photo || null,
      applicationIds,
      messages: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: whereConditions,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1, // 次があるか確認用
    include: {
      application: {
        include: {
          workDate: {
            include: {
              job: true,
            },
          },
        },
      },
      job: {
        select: {
          title: true,
        },
      },
    },
  });

  const hasMore = messages.length > limit;
  const data = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  // フォーマット（古い順に並び替え）
  // 施設メッセージには担当者名と担当者アバターを含める
  const staffName = facility?.staff_last_name && facility?.staff_first_name
    ? `${facility.staff_last_name} ${facility.staff_first_name}`
    : '';
  const staffAvatar = facility?.staff_photo || null;
  const facilityDisplayName = staffName
    ? `${facility?.facility_name || '施設'}（${staffName}）`
    : (facility?.facility_name || '施設');

  const formattedMessages = data.reverse().map(msg => ({
    id: msg.id,
    applicationId: msg.application_id,
    threadId: msg.thread_id,
    content: msg.content,
    attachments: msg.attachments,
    senderType: msg.from_user_id ? 'worker' : 'facility',
    senderName: msg.from_user_id ? user.name : facilityDisplayName,
    senderAvatar: msg.from_user_id ? null : staffAvatar,
    createdAt: msg.created_at,
    timestamp: msg.created_at.toISOString(),
    isRead: !!msg.read_at,
    // オファーメッセージの場合はjob直接参照、応募の場合はapplication経由
    jobTitle: msg.job?.title || msg.application?.workDate?.job?.title || '',
    jobDate: msg.application?.workDate?.work_date || null,
    isOfferMessage: !!msg.thread_id && !msg.application_id,
  }));

  // 初回読み込み時のみ未読を既読に（markAsRead=trueの場合）
  // この施設からの全未読メッセージを一括で既読にする（バッジ表示問題の修正）
  if (markAsRead && !cursor) {
    const updateConditions: any[] = [];

    // 応募ベースのメッセージ
    if (applicationIds.length > 0) {
      updateConditions.push({
        application_id: { in: applicationIds },
        to_facility_id: null,
        from_user_id: null,  // 施設からのメッセージ
        read_at: null,
      });
    }

    // スレッドベースのメッセージ（オファー）
    if (thread) {
      updateConditions.push({
        thread_id: thread.id,
        from_user_id: null,  // 施設からのメッセージ
        read_at: null,
      });
    }

    if (updateConditions.length > 0) {
      console.log('[getMessagesByFacility] Marking all unread as read:', JSON.stringify(updateConditions));
      const result = await prisma.message.updateMany({
        where: { OR: updateConditions },
        data: { read_at: new Date() },
      });
      console.log('[getMessagesByFacility] Updated count:', result.count);
    }
  }

  return {
    facilityId,
    facilityName: facility?.facility_name || '',
    facilityDisplayName,  // 担当者名付きの表示名
    staffAvatar,          // 担当者アバター
    applicationIds,
    messages: formattedMessages,
    nextCursor,
    hasMore,
  };
}

/**
 * 施設用: ワーカーごとにグループ化した会話一覧を取得
 * 最適化: Promise.allで並列実行 + select最小化
 */
export async function getGroupedWorkerConversations(facilityId: number) {
  // 3つの独立したクエリを並列実行
  const [applications, threads, officeData] = await Promise.all([
    // 1. 施設の全応募を取得（必要なフィールドのみ）
    prisma.application.findMany({
      where: {
        workDate: {
          job: { facility_id: facilityId },
        },
        OR: [
          { status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] } },
          { messages: { some: {} } },
        ],
      },
      select: {
        id: true,
        status: true,
        created_at: true,
        user: {
          select: { id: true, name: true, profile_image: true },
        },
        messages: {
          orderBy: { created_at: 'desc' as const },
          take: 1,
          select: { content: true, created_at: true },
        },
        workDate: {
          select: {
            job: { select: { title: true } },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                read_at: null,
                to_facility_id: { not: null },
              },
            },
          },
        },
      },
    }),
    // 2. MessageThread取得（オファー用）
    prisma.messageThread.findMany({
      where: { facility_id: facilityId },
      select: {
        id: true,
        created_at: true,
        worker: {
          select: { id: true, name: true, profile_image: true },
        },
        messages: {
          orderBy: { created_at: 'desc' as const },
          take: 1,
          select: { content: true, created_at: true, read_at: true, to_facility_id: true },
        },
      },
    }),
    // 3. 運営通知（2つのクエリを並列実行）
    Promise.all([
      prisma.systemNotification.findFirst({
        where: { target_type: 'FACILITY', recipient_id: facilityId },
        orderBy: { created_at: 'desc' },
        select: { content: true, created_at: true },
      }),
      prisma.systemNotification.count({
        where: { target_type: 'FACILITY', recipient_id: facilityId, read_at: null },
      }),
    ]),
  ]);

  const [officeLastNotification, officeUnreadCount] = officeData;

  // ワーカーごとにグループ化
  const workerMap = new Map<number, {
    userId: number;
    userName: string;
    userProfileImage: string | null;
    applicationIds: number[];
    threadIds: number[];
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    jobTitle: string;
    status: string;
    isOffice?: boolean;
  }>();

  // 応募ベースのメッセージを処理
  for (const app of applications) {
    const user = app.user;
    if (!user) continue;

    const existing = workerMap.get(user.id);
    const lastMsg = app.messages[0];
    const unread = app._count?.messages || 0;
    const userName = user.name || '不明なユーザー';

    if (existing) {
      existing.applicationIds.push(app.id);
      existing.unreadCount += unread;
      if (lastMsg && lastMsg.created_at > existing.lastMessageTime) {
        existing.lastMessage = lastMsg.content;
        existing.lastMessageTime = lastMsg.created_at;
        existing.jobTitle = app.workDate?.job?.title || '';
        existing.status = app.status;
      }
    } else {
      workerMap.set(user.id, {
        userId: user.id,
        userName: userName,
        userProfileImage: user.profile_image || null,
        applicationIds: [app.id],
        threadIds: [],
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg?.created_at || app.created_at,
        unreadCount: unread,
        jobTitle: app.workDate?.job?.title || '',
        status: app.status,
      });
    }
  }

  // スレッドベースのオファーメッセージを処理
  for (const thread of threads) {
    const user = thread.worker;
    if (!user) continue;

    const existing = workerMap.get(user.id);
    const lastMsg = thread.messages[0];
    const userName = user.name || '不明なユーザー';
    const threadUnreadCount = thread.messages.filter(m => !m.read_at && m.to_facility_id).length;

    if (existing) {
      existing.threadIds.push(thread.id);
      if (lastMsg && lastMsg.created_at > existing.lastMessageTime) {
        existing.lastMessage = lastMsg.content;
        existing.lastMessageTime = lastMsg.created_at;
      }
    } else {
      workerMap.set(user.id, {
        userId: user.id,
        userName: userName,
        userProfileImage: user.profile_image || null,
        applicationIds: [],
        threadIds: [thread.id],
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg?.created_at || thread.created_at,
        unreadCount: threadUnreadCount,
        jobTitle: '',
        status: '',
      });
    }
  }

  // 「運営」エントリを追加
  if (officeLastNotification || officeUnreadCount > 0) {
    workerMap.set(-1, {
      userId: -1,
      userName: '運営',
      userProfileImage: null,
      applicationIds: [],
      threadIds: [],
      lastMessage: officeLastNotification?.content || '',
      lastMessageTime: officeLastNotification?.created_at || new Date(0),
      unreadCount: officeUnreadCount,
      jobTitle: '',
      status: '',
      isOffice: true,
    });
  }

  return Array.from(workerMap.values()).sort(
    (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );
}

/**
 * 施設用: 特定ワーカーとのメッセージを取得（ページネーション対応）
 * @param facilityId 施設ID
 * @param workerId ワーカーID
 * @param options.cursor これより古いメッセージを取得（メッセージID）
 * @param options.limit 取得件数（デフォルト50）
 * @param options.markAsRead 既読にするか（初回のみtrue）
 */
export async function getMessagesByWorker(
  facilityId: number,
  workerId: number,
  options?: { cursor?: number; limit?: number; markAsRead?: boolean }
) {
  const limit = options?.limit || 50;
  const cursor = options?.cursor;
  const markAsRead = options?.markAsRead ?? true; // デフォルトは既読にする

  // 「運営」の場合はSystemNotificationから取得
  if (workerId === -1) {
    const notifications = await prisma.systemNotification.findMany({
      where: {
        target_type: 'FACILITY',
        recipient_id: facilityId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      include: {
        application: {
          include: {
            workDate: { include: { job: true } },
            user: { select: { name: true } },
          },
        },
        job: { select: { title: true } },
      },
    });

    const hasMore = notifications.length > limit;
    const data = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    const formattedMessages = data.reverse().map(notif => ({
      id: notif.id,
      applicationId: notif.application_id,
      content: notif.content,
      attachments: [],
      senderType: 'office' as const,
      senderName: '運営',
      timestamp: notif.created_at.toISOString(),
      isRead: notif.read_at !== null,
      jobTitle: notif.job?.title || notif.application?.workDate?.job?.title || '',
      jobDate: notif.application?.workDate?.work_date?.toISOString() || null,
      workerName: notif.application?.user?.name || undefined,
    }));

    // 既読にする
    if (markAsRead) {
      const unreadIds = formattedMessages.filter(m => !m.isRead).map(m => m.id);
      if (unreadIds.length > 0) {
        await prisma.systemNotification.updateMany({
          where: { id: { in: unreadIds } },
          data: { read_at: new Date() },
        });
      }
    }

    return {
      userId: -1,
      userName: '運営',
      userProfileImage: null,
      isOffice: true,
      applicationIds: [] as number[], // 運営の場合は空配列
      messages: formattedMessages,
      nextCursor,
      hasMore,
    };
  }




  // このワーカーの応募IDを取得
  const applications = await prisma.application.findMany({
    where: {
      user_id: workerId,
      workDate: {
        job: { facility_id: facilityId },
      },
    },
    select: {
      id: true,
      user: true,
      workDate: {
        include: {
          job: { select: { title: true } },
        },
      },
    },
  });

  const applicationIds = applications.map(app => app.id);

  // このワーカーとのMessageThreadを取得（オファー用）
  const thread = await prisma.messageThread.findUnique({
    where: {
      worker_id_facility_id: {
        worker_id: workerId,
        facility_id: facilityId,
      },
    },
  });

  // ワーカー情報を取得（応募がない場合でもスレッドから取得できる）
  let workerInfo: { name: string; profile_image: string | null } | null = null;
  if (applications.length > 0) {
    workerInfo = applications[0].user;
  } else if (thread) {
    const workerData = await prisma.user.findUnique({
      where: { id: workerId },
      select: { name: true, profile_image: true },
    });
    workerInfo = workerData;
  }

  // どちらもない場合は空のメッセージを返す
  if (applicationIds.length === 0 && !thread) {
    return {
      userId: workerId,
      userName: '',
      userProfileImage: null,
      applicationIds: [],
      messages: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  // メッセージをページネーションで取得（最新から）
  // application_idベースとthread_idベースの両方を取得
  const whereConditions: any[] = [];

  if (applicationIds.length > 0) {
    whereConditions.push({
      application_id: { in: applicationIds },
    });
  }

  if (thread) {
    whereConditions.push({
      thread_id: thread.id,
    });
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: whereConditions,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1, // 次があるか確認用に1件多く取得
    include: {
      application: {
        include: {
          workDate: {
            include: {
              job: { select: { title: true } },
            },
          },
          user: { select: { name: true, profile_image: true } },
        },
      },
      job: {
        select: { title: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  const data = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  // 古い順に並び替えて返す
  const formattedMessages = data.reverse().map(msg => ({
    id: msg.id,
    applicationId: msg.application_id,
    threadId: msg.thread_id,
    content: msg.content,
    attachments: msg.attachments,
    senderType: msg.from_user_id ? 'worker' : 'facility',
    senderName: msg.from_user_id ? (msg.application?.user?.name ?? workerInfo?.name ?? '') : '施設',
    timestamp: msg.created_at.toISOString(),
    isRead: !!msg.read_at,
    // オファーメッセージの場合はjob直接参照、応募の場合はapplication経由
    jobTitle: msg.job?.title || msg.application?.workDate?.job?.title || '',
    jobDate: msg.application?.workDate?.work_date || null,
    isOfferMessage: !!msg.thread_id && !msg.application_id,
  }));

  // 未読を既読に（初回読み込み時のみ）
  if (markAsRead) {
    const unreadIds = formattedMessages
      .filter(m => !m.isRead && m.senderType === 'worker')
      .map(m => m.id);
    if (unreadIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: unreadIds } },
        data: { read_at: new Date() },
      });
    }
  }

  const userName = workerInfo?.name || '';

  return {
    userId: workerId,
    userName: userName,
    userProfileImage: workerInfo?.profile_image || null,
    applicationIds, // 追加: メッセージ送信時に使用
    messages: formattedMessages,
    nextCursor,
    hasMore,
  };
}

/**
 * ワーカー用: 施設にメッセージを送信（最新の応募に関連付け）
 */
export async function sendMessageToFacility(facilityId: number, content: string, attachments: string[] = []) {
  try {
    const user = await getAuthenticatedUser();

    // この施設との最新の応募を取得
    const latestApplication = await prisma.application.findFirst({
      where: {
        user_id: user.id,
        workDate: {
          job: { facility_id: facilityId },
        },
      },
      orderBy: { created_at: 'desc' },
      include: {
        workDate: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!latestApplication) {
      return { success: false, error: 'この施設への応募履歴が見つかりません' };
    }

    // メッセージを作成
    const message = await prisma.message.create({
      data: {
        content,
        attachments,
        from_user_id: user.id,
        to_facility_id: facilityId,
        application_id: latestApplication.id,
        job_id: latestApplication.workDate.job_id,
        updated_by_type: 'WORKER',
        updated_by_id: user.id,
      },
    });

    // 通知ロジックの呼び出し (簡易実装: 既存のsendNotificationを使用)
    // 施設管理者を取得して通知
    const facilityAdmins = await prisma.facilityAdmin.findMany({
      where: { facility_id: facilityId },
    });

    // 注: 現状のNotificationシステムがFacilityAdminに対応していない可能性があるため、ログのみ出力しておく
    // 実際の実装ではEmail等で通知する必要がある
    console.log(`[sendMessageToFacility] Message sent to facility ${facilityId}. Notify admins: ${facilityAdmins.map(a => a.id).join(', ')}`);

    return {
      success: true,
      message: {
        id: message.id,
        senderType: 'worker' as const,
        senderName: user.name,
        content: message.content,
        attachments: message.attachments,
        timestamp: message.created_at.toISOString(),
        isRead: false,
      },
    };

  } catch (error) {
    console.error('Failed to send message:', error);
    return { success: false, error: 'メッセージの送信に失敗しました' };
  }
}

/**
 * 施設のシフト一覧を取得（マッチング済みの勤務予定）
 */
