import { prisma } from '@/lib/prisma';

interface ErrorNotificationParams {
    errorKey: string;  // APPLY_ERROR, MATCH_ERROR, etc.
    userId?: number;
    facilityId?: number;
    variables?: Record<string, string>;  // テンプレート変数
}

export async function sendErrorNotification(params: ErrorNotificationParams) {
    const { errorKey, userId, facilityId, variables = {} } = params;

    // 設定を取得
    const setting = await prisma.errorMessageSetting.findUnique({
        where: { key: errorKey },
    });

    if (!setting) {
        console.error(`Error message setting not found: ${errorKey}`);
        return;
    }

    // メッセージのテンプレート変数を置換
    let message = setting.detail_message || setting.banner_message;
    for (const [key, value] of Object.entries(variables)) {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // 1. バナー通知はフロントエンドで処理 (PersistentErrorToast)

    // 2. チャット（お知らせ）に追加
    if (setting.chat_enabled) {
        if (userId) {
            await prisma.notification.create({
                data: {
                    user_id: userId,
                    type: 'SYSTEM',
                    title: setting.title,
                    message: message,
                },
            });
        }
        if (facilityId) {
            // TODO: FacilityNotificationテーブルがスキーマに存在しないため、現在は施設への通知をスキップしています
            // 必要に応じてスキーマに追加してください
            console.log(`[Chat] Would send to facility: ${setting.title}`);
        }
    }

    // 3. メール送信
    if (setting.email_enabled) {
        // TODO: メール送信ロジックの実装
        // await sendEmail({ to: userEmail, subject: setting.title, body: message });
        console.log(`[Email] Would send to user/facility: ${setting.title}`);
    }

    // 4. プッシュ通知
    if (setting.push_enabled) {
        // TODO: プッシュ通知ロジックの実装
        // await sendPushNotification({ userId, title: setting.title, body: message });
        console.log(`[Push] Would send to user/facility: ${setting.title}`);
    }
}
