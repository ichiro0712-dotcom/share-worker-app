'use server';

import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

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
 * テスト用システム通知（チャット）を送信
 * SystemNotificationテーブルに直接作成（ユーザーの「運営」会話に表示される）
 */
export async function sendTestSystemNotification(params: {
  targetType: 'WORKER' | 'FACILITY';
  recipientId: number;
  content: string;
}): Promise<{ success: boolean; error?: string; notificationId?: number }> {
  const session = await getSystemAdminSessionData();
  if (!session) throw new Error('Unauthorized');

  const { targetType, recipientId, content } = params;

  if (!content.trim()) {
    return { success: false, error: 'メッセージ内容を入力してください' };
  }

  try {
    const notification = await prisma.systemNotification.create({
      data: {
        notification_key: 'SYSTEM_ADMIN_TEST',
        target_type: targetType,
        recipient_id: recipientId,
        content: content.trim(),
      },
    });

    return { success: true, notificationId: notification.id };
  } catch (error: any) {
    console.error('[sendTestSystemNotification] Error:', error);
    return { success: false, error: error.message };
  }
}
