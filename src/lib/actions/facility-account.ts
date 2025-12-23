'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * 施設のアカウント一覧を取得
 */
export async function getFacilityAccounts(facilityId: number) {
    try {
        const accounts = await prisma.facilityAdmin.findMany({
            where: { facility_id: facilityId },
            select: {
                id: true,
                email: true,
                name: true,
                is_primary: true,
                created_at: true,
            },
            orderBy: [
                { is_primary: 'desc' },
                { created_at: 'asc' },
            ],
        });
        return { success: true, accounts };
    } catch (error) {
        console.error('Failed to get facility accounts:', error);
        return { success: false, error: 'アカウント一覧の取得に失敗しました' };
    }
}

/**
 * アカウントを追加（最大5つまで）
 */
export async function addFacilityAccount(
    facilityId: number,
    data: { name: string; email: string; password: string }
) {
    try {
        const count = await prisma.facilityAdmin.count({
            where: { facility_id: facilityId },
        });

        if (count >= 5) {
            return { success: false, error: 'アカウントは最大5つまでです' };
        }

        const existing = await prisma.facilityAdmin.findUnique({
            where: { email: data.email },
        });

        if (existing) {
            return { success: false, error: 'このメールアドレスは既に使用されています' };
        }

        const password_hash = await bcrypt.hash(data.password, 10);

        const account = await prisma.facilityAdmin.create({
            data: {
                facility_id: facilityId,
                name: data.name,
                email: data.email,
                password_hash,
                is_primary: false,
            },
            select: {
                id: true,
                email: true,
                name: true,
                is_primary: true,
                created_at: true,
            },
        });

        return { success: true, account };
    } catch (error) {
        console.error('Failed to add facility account:', error);
        return { success: false, error: 'アカウントの追加に失敗しました' };
    }
}

/**
 * アカウント情報を更新（名前・メールアドレス）
 */
export async function updateFacilityAccount(
    accountId: number,
    facilityId: number,
    data: { name?: string; email?: string }
) {
    try {
        const account = await prisma.facilityAdmin.findFirst({
            where: { id: accountId, facility_id: facilityId },
        });

        if (!account) {
            return { success: false, error: 'アカウントが見つかりません' };
        }

        if (data.email && data.email !== account.email) {
            const existing = await prisma.facilityAdmin.findUnique({
                where: { email: data.email },
            });
            if (existing) {
                return { success: false, error: 'このメールアドレスは既に使用されています' };
            }
        }

        const updated = await prisma.facilityAdmin.update({
            where: { id: accountId },
            data: {
                name: data.name,
                email: data.email,
            },
            select: {
                id: true,
                email: true,
                name: true,
                is_primary: true,
                created_at: true,
            },
        });

        return { success: true, account: updated };
    } catch (error) {
        console.error('Failed to update facility account:', error);
        return { success: false, error: 'アカウントの更新に失敗しました' };
    }
}

/**
 * パスワードを変更
 */
export async function updateFacilityAccountPassword(
    accountId: number,
    facilityId: number,
    newPassword: string
) {
    try {
        const account = await prisma.facilityAdmin.findFirst({
            where: { id: accountId, facility_id: facilityId },
        });

        if (!account) {
            return { success: false, error: 'アカウントが見つかりません' };
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        await prisma.facilityAdmin.update({
            where: { id: accountId },
            data: { password_hash },
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to update password:', error);
        return { success: false, error: 'パスワードの変更に失敗しました' };
    }
}

/**
 * アカウントを削除（初期アカウントは削除不可）
 */
export async function deleteFacilityAccount(accountId: number, facilityId: number) {
    try {
        const account = await prisma.facilityAdmin.findFirst({
            where: { id: accountId, facility_id: facilityId },
        });

        if (!account) {
            return { success: false, error: 'アカウントが見つかりません' };
        }

        if (account.is_primary) {
            return { success: false, error: '初期アカウントは削除できません' };
        }

        await prisma.facilityAdmin.delete({
            where: { id: accountId },
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to delete facility account:', error);
        return { success: false, error: 'アカウントの削除に失敗しました' };
    }
}
