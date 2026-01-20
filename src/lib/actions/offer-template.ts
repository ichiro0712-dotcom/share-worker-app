'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

/**
 * 施設のオファーテンプレート一覧を取得
 */
export async function getOfferTemplates(facilityId: number) {
  try {
    return await prisma.offerTemplate.findMany({
      where: { facility_id: facilityId },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        name: true,
        message: true,
        sort_order: true,
      },
    });
  } catch (error) {
    console.error('[getOfferTemplates] Error:', error);
    return [];
  }
}

/**
 * オファーテンプレートを作成（最大20件まで）
 */
export async function createOfferTemplate(
  facilityId: number,
  name: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getFacilityAdminSessionData();
  try {
    // 件数チェック
    const count = await prisma.offerTemplate.count({
      where: { facility_id: facilityId },
    });

    if (count >= 20) {
      return { success: false, error: 'テンプレートは最大20件までです' };
    }

    // 最大のsort_orderを取得
    const maxOrder = await prisma.offerTemplate.aggregate({
      where: { facility_id: facilityId },
      _max: { sort_order: true },
    });

    const template = await prisma.offerTemplate.create({
      data: {
        facility_id: facilityId,
        name,
        message,
        sort_order: (maxOrder._max.sort_order ?? 0) + 1,
      },
    });

    // 注意: /admin/jobs/newはrevalidateしない（フォーム入力中にリセットされるため）
    // JobForm内ではrefreshOfferTemplates()で手動更新している
    revalidatePath('/admin/settings/offer-templates');

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'OFFER_TEMPLATE_CREATE',
      targetType: 'OfferTemplate',
      targetId: template.id,
      requestData: {
        facilityId,
        name,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[createOfferTemplate] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'OFFER_TEMPLATE_CREATE',
      requestData: {
        facilityId,
        name,
      },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
    }).catch(() => {});

    return { success: false, error: 'テンプレートの作成に失敗しました' };
  }
}

/**
 * オファーテンプレートを更新
 */
export async function updateOfferTemplate(
  templateId: number,
  name: string,
  message: string,
  facilityId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getFacilityAdminSessionData();
  try {
    // 認可チェック: 対象テンプレートが自施設のものか確認
    const existing = await prisma.offerTemplate.findUnique({
      where: { id: templateId },
      select: { facility_id: true },
    });

    if (!existing || existing.facility_id !== facilityId) {
      return { success: false, error: '権限がありません' };
    }

    await prisma.offerTemplate.update({
      where: { id: templateId },
      data: { name, message },
    });

    // 注意: /admin/jobs/newはrevalidateしない（フォーム入力中にリセットされるため）
    revalidatePath('/admin/settings/offer-templates');

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'OFFER_TEMPLATE_UPDATE',
      targetType: 'OfferTemplate',
      targetId: templateId,
      requestData: {
        facilityId,
        name,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[updateOfferTemplate] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'OFFER_TEMPLATE_UPDATE',
      targetType: 'OfferTemplate',
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

/**
 * オファーテンプレートを削除
 */
export async function deleteOfferTemplate(
  templateId: number,
  facilityId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getFacilityAdminSessionData();
  try {
    // 認可チェック: 対象テンプレートが自施設のものか確認
    const existing = await prisma.offerTemplate.findUnique({
      where: { id: templateId },
      select: { facility_id: true },
    });

    if (!existing || existing.facility_id !== facilityId) {
      return { success: false, error: '権限がありません' };
    }

    await prisma.offerTemplate.delete({
      where: { id: templateId },
    });

    // 注意: /admin/jobs/newはrevalidateしない（フォーム入力中にリセットされるため）
    revalidatePath('/admin/settings/offer-templates');

    // ログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'OFFER_TEMPLATE_DELETE',
      targetType: 'OfferTemplate',
      targetId: templateId,
      requestData: {
        facilityId,
      },
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('[deleteOfferTemplate] Error:', error);

    // エラーログ記録
    logActivity({
      userType: 'FACILITY',
      userId: session?.adminId,
      userEmail: session?.email,
      action: 'OFFER_TEMPLATE_DELETE',
      targetType: 'OfferTemplate',
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
