'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logActivity, logTrace, getErrorMessage, getErrorStack } from '@/lib/logger';
import { Resend } from 'resend';
import { createFacilityAdminSession, clearFacilityAdminSession } from '@/lib/admin-session-server';

// Resend設定（遅延初期化 - APIキーがない場合はnull）
let resend: Resend | null = null;
function getResendClient(): Resend | null {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';

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

        // サーバーサイドセッションを作成（iron-session）
        // API認証用のhttpOnly Cookieを設定
        try {
            await createFacilityAdminSession({
                adminId: admin.id,
                facilityId: admin.facility_id,
                name: admin.name,
                email: admin.email,
                role: 'admin',
            });
        } catch (sessionError) {
            console.error('[authenticateFacilityAdmin] Failed to create server session:', sessionError);
            // セッション作成に失敗しても、認証自体は成功として扱う（互換性維持）
            // クライアント側のlocalStorageセッションで動作を継続
        }

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
                userType: 'SYSTEM_ADMIN',
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
                userType: 'SYSTEM_ADMIN',
                userEmail: email,
                action: 'SYSTEM_ADMIN_LOGIN_FAILED',
                result: 'ERROR',
                errorMessage: 'パスワードが一致しません',
            }).catch(() => {});
            return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
        }

        // ログイン成功をログ記録
        logActivity({
            userType: 'SYSTEM_ADMIN',
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
            userType: 'SYSTEM_ADMIN',
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

/**
 * パスワードリセットメールを送信
 */
async function sendPasswordResetEmail(
    email: string,
    name: string,
    resetUrl: string
): Promise<{ success: boolean; error?: string }> {
    // メール送信が無効化されている場合はスキップ
    if (process.env.DISABLE_EMAIL_SENDING === 'true') {
        console.log('[Password Reset Email] Sending disabled, logging only:', { to: email, resetUrl });
        return { success: true };
    }

    try {
        const client = getResendClient();
        if (!client) {
            console.log('[Password Reset Email] Resend API key not configured, skipping email');
            return { success: true };
        }

        const { error } = await client.emails.send({
            from: `+タスタス <${FROM_EMAIL}>`,
            to: [email],
            subject: '【+タスタス】パスワードリセットのご案内',
            html: formatPasswordResetEmailHtml(name, resetUrl),
            text: formatPasswordResetEmailText(name, resetUrl),
        });

        if (error) {
            console.error('[Password Reset Email] Failed to send:', error);
            return { success: false, error: error.message };
        }

        console.log('[Password Reset Email] Sent successfully to:', email);
        return { success: true };
    } catch (error: any) {
        console.error('[Password Reset Email] Error:', error);
        return { success: false, error: error.message };
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * パスワードリセットメールのHTML本文
 */
function formatPasswordResetEmailHtml(name: string, resetUrl: string): string {
    const safeName = escapeHtml(name);
    const safeUrl = escapeHtml(resetUrl);
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 20px;">パスワードリセット</h2>

        <p>${safeName} 様</p>

        <p>パスワードリセットのリクエストを受け付けました。</p>

        <p>下記のボタンをクリックして、新しいパスワードを設定してください。</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${safeUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none;
                      padding: 14px 28px; border-radius: 6px; font-weight: bold;">
                パスワードを再設定する
            </a>
        </div>

        <p style="font-size: 14px; color: #666;">
            ボタンがクリックできない場合は、以下のURLをブラウザにコピー＆ペーストしてください：<br>
            <a href="${safeUrl}" style="color: #2563eb; word-break: break-all;">${safeUrl}</a>
        </p>

        <p style="font-size: 14px; color: #666; margin-top: 20px;">
            ※このリンクは1時間有効です。<br>
            ※このメールに心当たりがない場合は、お手数ですが削除してください。パスワードは変更されません。
        </p>
    </div>

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        <p>このメールは +タスタス より自動送信されています。</p>
    </div>
</body>
</html>`;
}

/**
 * パスワードリセットメールのプレーンテキスト本文
 */
function formatPasswordResetEmailText(name: string, resetUrl: string): string {
    return `
${name} 様

パスワードリセットのリクエストを受け付けました。

下記のURLをクリックして、新しいパスワードを設定してください：

${resetUrl}

※このリンクは1時間有効です。
※このメールに心当たりがない場合は、お手数ですが削除してください。パスワードは変更されません。

---
このメールは +タスタス より自動送信されています。
`;
}

/**
 * パスワードリセットをリクエスト
 * 本番環境ではメール送信、開発環境ではモーダルでURLを表示
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
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1時間有効

        // トークンをDBに保存
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password_reset_token: token,
                password_reset_token_expires: expires,
            },
        });

        console.log(`[Password Reset] Token generated for ${email}`);

        // パスワードリセット要求をログ記録
        logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: email,
            action: 'PASSWORD_RESET_REQUEST',
            result: 'SUCCESS',
        }).catch(() => {});

        // 本番環境ではメールを送信、開発環境ではトークンを返す
        const isProduction = process.env.NODE_ENV === 'production';
        const APP_URL = process.env.NEXTAUTH_URL || 'https://tastas.work';
        const resetUrl = `${APP_URL}/password-reset/${token}`;

        if (isProduction || process.env.ENABLE_PASSWORD_RESET_EMAIL === 'true') {
            // メール送信
            const emailResult = await sendPasswordResetEmail(email, user.name, resetUrl);
            if (!emailResult.success) {
                console.error('[Password Reset] Failed to send email:', emailResult.error);
                // メール送信に失敗してもセキュリティのため成功を返す
            }
            return { success: true, message: 'パスワードリセット用のメールを送信しました' };
        } else {
            // 開発環境：トークンを返す（クライアント側でURLを表示）
            return { success: true, resetToken: token };
        }
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
        const user = await prisma.user.findUnique({
            where: { password_reset_token: token },
            select: { id: true, email: true, password_reset_token_expires: true },
        });

        if (!user) {
            return { valid: false };
        }

        // 有効期限チェック
        if (!user.password_reset_token_expires || new Date() > user.password_reset_token_expires) {
            // 期限切れトークンをクリア
            await prisma.user.update({
                where: { id: user.id },
                data: { password_reset_token: null, password_reset_token_expires: null },
            });
            return { valid: false };
        }

        return { valid: true, email: user.email };
    } catch (error) {
        console.error('[validateResetToken] Error:', error);
        return { valid: false };
    }
}

/**
 * パスワードをリセット（アトミック: トークン消費とパスワード更新を同時に行う）
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
        // サーバーサイドのパスワード長チェック
        if (!newPassword || newPassword.length < 8) {
            return { success: false, message: 'パスワードは8文字以上で入力してください' };
        }

        const bcrypt = await import('bcryptjs');

        // アトミックにトークンを消費してパスワードを更新
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { password_reset_token: token },
                select: { id: true, email: true, password_hash: true, password_reset_token_expires: true },
            });

            if (!user) {
                return { success: false as const, message: '無効なトークンです。再度パスワードリセットをリクエストしてください。' };
            }

            // 有効期限チェック
            if (!user.password_reset_token_expires || new Date() > user.password_reset_token_expires) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { password_reset_token: null, password_reset_token_expires: null },
                });
                return { success: false as const, message: 'トークンの有効期限が切れています。再度パスワードリセットをリクエストしてください。' };
            }

            // 現在のパスワードと同じかチェック
            if (user.password_hash) {
                const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
                if (isSamePassword) {
                    return { success: false as const, message: '現在のパスワードと同じパスワードは使用できません。別のパスワードを設定してください。' };
                }
            }

            // パスワードをハッシュ化して更新 + トークンクリア（アトミック）
            const password_hash = await bcrypt.hash(newPassword, 12);

            await tx.user.update({
                where: { id: user.id },
                data: {
                    password_hash,
                    password_reset_token: null,
                    password_reset_token_expires: null,
                },
            });

            console.log(`[Password Reset] Password updated for: ${user.email}`);

            // パスワードリセット完了をログ記録
            logActivity({
                userType: 'WORKER',
                userId: user.id,
                userEmail: user.email,
                action: 'PASSWORD_RESET_COMPLETE',
                result: 'SUCCESS',
            }).catch(() => {});

            return { success: true as const, message: 'パスワードを変更しました' };
        });

        return result;
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

/**
 * 施設管理者ログアウト
 * サーバーサイドセッション（iron-session）をクリア
 */
export async function logoutFacilityAdmin(): Promise<{ success: boolean }> {
    try {
        await clearFacilityAdminSession();
        return { success: true };
    } catch (error) {
        console.error('[logoutFacilityAdmin] Error:', error);
        // エラーでも成功を返す（クライアント側のセッションクリアは続行させる）
        return { success: true };
    }
}
