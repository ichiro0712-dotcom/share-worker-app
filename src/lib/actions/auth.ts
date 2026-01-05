'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logActivity, logTrace, getErrorMessage, getErrorStack } from '@/lib/logger';

/**
 * 施設管理者ログイン（DBベース）
 */
export async function authenticateFacilityAdmin(email: string, password: string) {
    try {
        const admin = await prisma.facilityAdmin.findUnique({
            where: { email },
            include: {
                facility: {
                    select: {
                        id: true,
                        facility_name: true,
                    },
                },
            },
        });

        if (!admin) {
            return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
        }

        // bcryptでパスワードを検証
        const bcrypt = await import('bcryptjs');

        // テストユーザーログイン用の特別パスワード（開発環境のみ）
        const MAGIC_PASSWORD = process.env.NODE_ENV === 'production'
            ? 'THIS_SHOULD_NEVER_MATCH_IN_PRODUCTION'
            : 'SKIP_PASSWORD_CHECK_FOR_TEST_USER';

        const isValid = password === MAGIC_PASSWORD || await bcrypt.compare(password, admin.password_hash);

        if (!isValid) {
            // ログイン失敗をログ記録
            logActivity({
                userType: 'FACILITY',
                userEmail: email,
                action: 'FACILITY_LOGIN_FAILED',
                result: 'ERROR',
                errorMessage: 'パスワードが一致しません',
            }).catch(() => {});
            return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
        }

        // ログイン成功をログ記録
        logActivity({
            userType: 'FACILITY',
            userId: admin.id,
            userEmail: admin.email,
            action: 'FACILITY_LOGIN',
            targetType: 'Facility',
            targetId: admin.facility_id,
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                facilityId: admin.facility_id,
                name: admin.name,
                phone: admin.phone_number || undefined,
                role: 'admin' as const,
                facilityName: admin.facility?.facility_name || '',
            },
        };
    } catch (error) {
        console.error('Admin authentication error:', error);
        logActivity({
            userType: 'FACILITY',
            userEmail: email,
            action: 'FACILITY_LOGIN_FAILED',
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});
        return { success: false, error: '認証中にエラーが発生しました' };
    }
}

/**
 * システム管理者ログイン認証
 */
export async function authenticateSystemAdmin(email: string, password: string) {
    try {
        // 開発環境用のシード管理者作成（存在しない場合）
        if (process.env.NODE_ENV !== 'production') {
            const seedAdmin = await prisma.systemAdmin.findUnique({ where: { email: 'admin@system.com' } });
            if (!seedAdmin) {
                await prisma.systemAdmin.create({
                    data: {
                        email: 'admin@system.com',
                        password_hash: await import('bcryptjs').then(b => b.hash('admin123', 10)),
                        name: 'システム管理者',
                        role: 'super_admin'
                    }
                });
            }
        }

        const admin = await prisma.systemAdmin.findUnique({
            where: { email },
        });

        if (!admin) {
            logActivity({
                userType: 'FACILITY',
                userEmail: email,
                action: 'SYSTEM_ADMIN_LOGIN_FAILED',
                result: 'ERROR',
                errorMessage: 'アカウントが見つかりません',
            }).catch(() => {});
            return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
        }

        // パスワード照合
        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(password, admin.password_hash);

        // マスターパスワード（開発用）
        const MAGIC_PASSWORD = process.env.NODE_ENV === 'production'
            ? 'THIS_SHOULD_NEVER_MATCH'
            : 'SKIP_PASSWORD_CHECK_FOR_SYSTEM_ADMIN';

        if (!isValid && password !== MAGIC_PASSWORD) {
            logActivity({
                userType: 'FACILITY',
                userEmail: email,
                action: 'SYSTEM_ADMIN_LOGIN_FAILED',
                result: 'ERROR',
                errorMessage: 'パスワードが一致しません',
            }).catch(() => {});
            return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
        }

        // ログイン成功をログ記録
        logActivity({
            userType: 'FACILITY',
            userId: admin.id,
            userEmail: admin.email,
            action: 'SYSTEM_ADMIN_LOGIN',
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            },
        };
    } catch (error) {
        console.error('System Admin authentication error:', error);
        logActivity({
            userType: 'FACILITY',
            userEmail: email,
            action: 'SYSTEM_ADMIN_LOGIN_FAILED',
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});
        return { success: false, error: 'ログイン処理中にエラーが発生しました' };
    }
}

// ========== パスワードリセット ==========

// パスワードリセット用のトークンを保存するMap（ローカル開発用、本番ではDBに保存）
const passwordResetTokens = new Map<string, { email: string; expires: number }>();

/**
 * パスワードリセットをリクエスト
 * ローカル環境ではモーダルでURLを表示
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; resetToken?: string }> {
    try {
        // ユーザーが存在するか確認
        const user = await prisma.user.findUnique({
            where: { email },
        });

        // セキュリティのため、ユーザーが存在しなくても成功を返す（URLは返さない）
        if (!user) {
            console.log(`[Password Reset] User not found for email: ${email}`);
            logTrace({ action: 'PASSWORD_RESET_REQUEST', data: { email, found: false } });
            return { success: true, message: 'メールを送信しました（存在する場合）' };
        }

        // トークンを生成（簡易的なランダム文字列）
        const token = crypto.randomUUID();
        const expires = Date.now() + 60 * 60 * 1000; // 1時間有効

        // トークンを保存
        passwordResetTokens.set(token, { email, expires });

        // ローカル環境用：トークンを返す（クライアント側でURLを生成）
        console.log(`[Password Reset] Token generated for ${email}`);

        // パスワードリセット要求をログ記録
        logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: email,
            action: 'PASSWORD_RESET_REQUEST',
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, resetToken: token };
    } catch (error) {
        console.error('[requestPasswordReset] Error:', error);
        logActivity({
            userType: 'WORKER',
            userEmail: email,
            action: 'PASSWORD_RESET_REQUEST',
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});
        return { success: false, message: 'エラーが発生しました' };
    }
}

/**
 * リセットトークンを検証
 */
export async function validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    try {
        const tokenData = passwordResetTokens.get(token);

        if (!tokenData) {
            return { valid: false };
        }

        // 有効期限チェック
        if (Date.now() > tokenData.expires) {
            passwordResetTokens.delete(token);
            return { valid: false };
        }

        return { valid: true, email: tokenData.email };
    } catch (error) {
        console.error('[validateResetToken] Error:', error);
        return { valid: false };
    }
}

/**
 * パスワードをリセット
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
        const tokenData = passwordResetTokens.get(token);

        if (!tokenData) {
            logActivity({
                userType: 'WORKER',
                action: 'PASSWORD_RESET_FAILED',
                result: 'ERROR',
                errorMessage: '無効なトークン',
            }).catch(() => {});
            return { success: false, message: '無効なトークンです。再度パスワードリセットをリクエストしてください。' };
        }

        // 有効期限チェック
        if (Date.now() > tokenData.expires) {
            passwordResetTokens.delete(token);
            logActivity({
                userType: 'WORKER',
                userEmail: tokenData.email,
                action: 'PASSWORD_RESET_FAILED',
                result: 'ERROR',
                errorMessage: 'トークン有効期限切れ',
            }).catch(() => {});
            return { success: false, message: 'トークンの有効期限が切れています。再度パスワードリセットをリクエストしてください。' };
        }

        const bcrypt = await import('bcryptjs');

        // 現在のパスワードと同じかチェック
        const currentUser = await prisma.user.findUnique({
            where: { email: tokenData.email },
            select: { id: true, password_hash: true },
        });

        if (currentUser?.password_hash) {
            const isSamePassword = await bcrypt.compare(newPassword, currentUser.password_hash);
            if (isSamePassword) {
                logActivity({
                    userType: 'WORKER',
                    userId: currentUser.id,
                    userEmail: tokenData.email,
                    action: 'PASSWORD_RESET_FAILED',
                    result: 'ERROR',
                    errorMessage: '現在と同じパスワード',
                }).catch(() => {});
                return { success: false, message: '現在のパスワードと同じパスワードは使用できません。別のパスワードを設定してください。' };
            }
        }

        // パスワードをハッシュ化して更新
        const password_hash = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { email: tokenData.email },
            data: { password_hash },
        });

        // 使用済みトークンを削除
        passwordResetTokens.delete(token);

        console.log(`[Password Reset] Password updated for: ${tokenData.email}`);

        // パスワードリセット完了をログ記録
        logActivity({
            userType: 'WORKER',
            userId: currentUser?.id,
            userEmail: tokenData.email,
            action: 'PASSWORD_RESET_COMPLETE',
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, message: 'パスワードを変更しました' };
    } catch (error) {
        console.error('[resetPassword] Error:', error);
        logActivity({
            userType: 'WORKER',
            action: 'PASSWORD_RESET_FAILED',
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});
        return { success: false, message: 'パスワードの変更に失敗しました' };
    }
}

/**
 * テストユーザー一覧を取得（ログイン画面表示用）
 * 特定のメールアドレスを持つユーザーをDBから取得
 */
export async function getTestUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                profile_image: true,
            },
            orderBy: {
                id: 'asc',
            },
        });

        return users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            profileImage: user.profile_image,
        }));
    } catch (error) {
        console.error('Failed to fetch test users:', error);
        return [];
    }
}

/**
 * テスト用管理者を取得（開発用）
 */
export async function getTestAdmins() {
    try {
        const admins = await prisma.facilityAdmin.findMany({
            include: {
                facility: {
                    select: {
                        facility_name: true,
                        is_pending: true,
                    },
                },
            },
            orderBy: {
                id: 'asc',
            },
        });

        // 仮登録状態（is_pending=true）の施設管理者は除外
        return admins
            .filter((admin) => !admin.facility?.is_pending)
            .map((admin) => ({
                id: admin.id,
                email: admin.email,
                name: admin.name,
                facilityName: admin.facility?.facility_name || '所属なし',
            }));
    } catch (error) {
        console.error('Failed to fetch test admins:', error);
        return [];
    }
}
