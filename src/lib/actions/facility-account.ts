'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

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
    const session = await getFacilityAdminSessionData();
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

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_CREATE',
            targetType: 'FacilityAdmin',
            targetId: account.id,
            requestData: {
                facilityId,
                email: data.email,
                name: data.name,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, account };
    } catch (error) {
        console.error('Failed to add facility account:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_CREATE',
            requestData: {
                facilityId,
                email: data.email,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

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
    const session = await getFacilityAdminSessionData();
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

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_UPDATE',
            targetType: 'FacilityAdmin',
            targetId: accountId,
            requestData: {
                facilityId,
                email: data.email,
                name: data.name,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, account: updated };
    } catch (error) {
        console.error('Failed to update facility account:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_UPDATE',
            targetType: 'FacilityAdmin',
            targetId: accountId,
            requestData: {
                facilityId,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

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
    const session = await getFacilityAdminSessionData();
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

        // ログ記録（パスワードは記録しない）
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_UPDATE',
            targetType: 'FacilityAdmin',
            targetId: accountId,
            requestData: {
                facilityId,
                field: 'password',
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true };
    } catch (error) {
        console.error('Failed to update password:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_UPDATE',
            targetType: 'FacilityAdmin',
            targetId: accountId,
            requestData: {
                facilityId,
                field: 'password',
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: 'パスワードの変更に失敗しました' };
    }
}

/**
 * アカウントを削除（初期アカウントは削除不可）
 */
export async function deleteFacilityAccount(accountId: number, facilityId: number) {
    const session = await getFacilityAdminSessionData();
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

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_DELETE',
            targetType: 'FacilityAdmin',
            targetId: accountId,
            requestData: {
                facilityId,
                email: account.email,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true };
    } catch (error) {
        console.error('Failed to delete facility account:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'FACILITY_ACCOUNT_DELETE',
            targetType: 'FacilityAdmin',
            targetId: accountId,
            requestData: {
                facilityId,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: 'アカウントの削除に失敗しました' };
    }
}

/**
 * 施設管理者の利用規約同意状態を取得
 */
export async function getTermsAgreementStatus(adminId: number) {
    try {
        const admin = await prisma.facilityAdmin.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                terms_agreed_at: true,
            },
        });

        if (!admin) {
            return { success: false, error: '管理者が見つかりません' };
        }

        return {
            success: true,
            hasAgreed: admin.terms_agreed_at !== null,
            agreedAt: admin.terms_agreed_at,
        };
    } catch (error) {
        console.error('Failed to get terms agreement status:', error);
        return { success: false, error: '利用規約同意状態の取得に失敗しました' };
    }
}

/**
 * 施設管理者の利用規約に同意
 */
export async function agreeToTerms(adminId: number) {
    const session = await getFacilityAdminSessionData();
    try {
        const admin = await prisma.facilityAdmin.findUnique({
            where: { id: adminId },
        });

        if (!admin) {
            return { success: false, error: '管理者が見つかりません' };
        }

        await prisma.facilityAdmin.update({
            where: { id: adminId },
            data: {
                terms_agreed_at: new Date(),
            },
        });

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'TERMS_AGREEMENT',
            targetType: 'FacilityAdmin',
            targetId: adminId,
            requestData: {
                adminId,
                agreedAt: new Date().toISOString(),
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true };
    } catch (error) {
        console.error('Failed to agree to terms:', error);

        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            userId: session?.adminId,
            userEmail: session?.email,
            action: 'TERMS_AGREEMENT',
            targetType: 'FacilityAdmin',
            targetId: adminId,
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: '利用規約への同意に失敗しました' };
    }
}
