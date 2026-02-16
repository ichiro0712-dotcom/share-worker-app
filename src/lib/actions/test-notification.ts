'use server';

import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { getVersionForLog } from '@/lib/version';

interface SearchableUser {
  id: number;
  name: string;
  email: string;
  userType: 'worker' | 'facility_admin';
  pushSubscriptionCount: number;
  facilityName?: string;
  facilityId?: number;
}

/**
 * 通知テスト用の軽量ユーザー検索
 * ワーカー・施設管理者を横断検索し、プッシュ購読数も返す
 */
export async function searchUsersForNotification(
  query: string,
  userType: 'all' | 'worker' | 'facility_admin' = 'all'
): Promise<SearchableUser[]> {
  const session = await getSystemAdminSessionData();
  if (!session) throw new Error('Unauthorized');

  const searchTerm = query.trim();
  if (!searchTerm) return [];

  const isNumeric = /^\d+$/.test(searchTerm);
  const results: SearchableUser[] = [];

  // ワーカー検索
  if (userType === 'all' || userType === 'worker') {
    const whereConditions: any[] = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
    ];
    if (isNumeric) {
      whereConditions.push({ id: parseInt(searchTerm, 10) });
    }

    const workers = await prisma.user.findMany({
      where: { OR: whereConditions },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { pushSubscriptions: true } },
      },
      take: 10,
      orderBy: { id: 'desc' },
    });

    results.push(
      ...workers.map((w) => ({
        id: w.id,
        name: w.name || '(名前未設定)',
        email: w.email,
        userType: 'worker' as const,
        pushSubscriptionCount: w._count.pushSubscriptions,
      }))
    );
  }

  // 施設管理者検索
  if (userType === 'all' || userType === 'facility_admin') {
    const whereConditions: any[] = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { facility: { facility_name: { contains: searchTerm, mode: 'insensitive' } } },
    ];
    if (isNumeric) {
      whereConditions.push({ id: parseInt(searchTerm, 10) });
    }

    const admins = await prisma.facilityAdmin.findMany({
      where: { OR: whereConditions },
      select: {
        id: true,
        name: true,
        email: true,
        facility_id: true,
        facility: { select: { facility_name: true } },
        _count: { select: { pushSubscriptions: true } },
      },
      take: 10,
      orderBy: { id: 'desc' },
    });

    results.push(
      ...admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        userType: 'facility_admin' as const,
        pushSubscriptionCount: a._count.pushSubscriptions,
        facilityName: a.facility.facility_name,
        facilityId: a.facility_id,
      }))
    );
  }

  return results;
}

/**
 * テスト用お知らせ送信
 * Announcement + AnnouncementRecipient を作成し、ワーカー/施設の「運営からのお知らせ」に表示する
 */
export async function sendTestAnnouncement(params: {
  targetType: 'WORKER' | 'FACILITY';
  recipientId: number;
  content: string;
}): Promise<{ success: boolean; error?: string; announcementId?: number }> {
  const session = await getSystemAdminSessionData();
  if (!session) throw new Error('Unauthorized');

  const { targetType, recipientId, content } = params;

  if (!content.trim()) {
    return { success: false, error: 'メッセージ内容を入力してください' };
  }

  const versionInfo = getVersionForLog();

  try {
    const announcement = await prisma.announcement.create({
      data: {
        title: '【テスト】運営からのお知らせ',
        content: content.trim(),
        category: 'NEWS',
        target_type: targetType === 'WORKER' ? 'WORKER' : 'FACILITY',
        published: true,
        published_at: new Date(),
        recipients: {
          create: {
            recipient_type: targetType === 'WORKER' ? 'WORKER' : 'FACILITY',
            recipient_id: recipientId,
          },
        },
      },
    });

    // NotificationLogに記録
    await prisma.notificationLog.create({
      data: {
        notification_key: 'SYSTEM_ADMIN_TEST_CHAT',
        channel: 'CHAT',
        target_type: targetType,
        recipient_id: recipientId,
        recipient_name: '',
        chat_message: content.trim(),
        status: 'SENT',
        app_version: versionInfo.app_version,
        deployment_id: versionInfo.deployment_id,
      },
    }).catch((e) => console.error('[Test Chat] Log save failed:', e));

    return { success: true, announcementId: announcement.id };
  } catch (error: any) {
    console.error('[sendTestAnnouncement] Error:', error);

    // 失敗ログ
    await prisma.notificationLog.create({
      data: {
        notification_key: 'SYSTEM_ADMIN_TEST_CHAT',
        channel: 'CHAT',
        target_type: targetType,
        recipient_id: recipientId,
        recipient_name: '',
        chat_message: content.trim(),
        status: 'FAILED',
        error_message: error.message,
        app_version: versionInfo.app_version,
        deployment_id: versionInfo.deployment_id,
      },
    }).catch((e) => console.error('[Test Chat] Log save failed:', e));

    return { success: false, error: error.message };
  }
}
