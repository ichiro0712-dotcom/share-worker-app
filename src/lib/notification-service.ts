import { prisma } from '@/lib/prisma';
import webPush from 'web-push';

// VAPID設定
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@s-works.jp';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface SendNotificationParams {
    notificationKey: string;
    targetType: 'WORKER' | 'FACILITY' | 'SYSTEM_ADMIN';
    recipientId: number;
    recipientName: string;
    recipientEmail?: string;
    facilityEmails?: string[]; // 施設向け: 複数担当者メール
    applicationId?: number; // チャット通知用
    variables: Record<string, string>;
}

// テンプレート内の変数を置換
function replaceVariables(template: string | null, variables: Record<string, string>): string {
    if (!template) return '';
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

// 通知送信メイン関数
export async function sendNotification(params: SendNotificationParams): Promise<void> {
    const {
        notificationKey,
        targetType,
        recipientId,
        recipientName,
        recipientEmail,
        facilityEmails,
        applicationId,
        variables,
    } = params;

    // 通知設定を取得
    const setting = await prisma.notificationSetting.findUnique({
        where: { notification_key: notificationKey },
    });

    if (!setting) {
        console.warn(`Notification setting not found: ${notificationKey}`);
        return;
    }

    // チャット通知
    if (setting.chat_enabled && setting.chat_message && applicationId) {
        await sendChatNotification({
            notificationKey,
            targetType,
            recipientId,
            recipientName,
            applicationId,
            message: replaceVariables(setting.chat_message, variables),
        });
    }

    // メール通知
    if (setting.email_enabled && setting.email_subject && setting.email_body) {
        const toAddresses = facilityEmails && facilityEmails.length > 0
            ? facilityEmails
            : recipientEmail ? [recipientEmail] : [];

        if (toAddresses.length > 0) {
            await sendEmailNotification({
                notificationKey,
                targetType,
                recipientId,
                recipientName,
                recipientEmail: recipientEmail || toAddresses[0],
                toAddresses,
                subject: replaceVariables(setting.email_subject, variables),
                body: replaceVariables(setting.email_body, variables),
            });
        }
    }

    // プッシュ通知
    if (setting.push_enabled && setting.push_title && setting.push_body) {
        await sendPushNotification({
            notificationKey,
            targetType,
            recipientId,
            recipientName,
            title: replaceVariables(setting.push_title, variables),
            body: replaceVariables(setting.push_body, variables),
            url: variables.job_url || variables.review_url || '/',
        });
    }
}

// チャット通知を送信
async function sendChatNotification(params: {
    notificationKey: string;
    targetType: string;
    recipientId: number;
    recipientName: string;
    applicationId: number;
    message: string;
}): Promise<void> {
    const { notificationKey, targetType, recipientId, recipientName, applicationId, message } = params;

    try {
        // Applicationを取得してjob_idを得る
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: { workDate: { include: { job: true } } },
        });

        if (!application) {
            throw new Error(`Application not found: ${applicationId}`);
        }

        // 事務局からのシステムメッセージとして送信（from_user_id と from_facility_id を両方null）
        // ワーカー宛の場合: to_user_id を設定
        // 施設宛の場合: to_facility_id を設定
        const messageData: any = {
            content: message,
            application_id: applicationId,
            job_id: application.workDate.job_id,
            from_user_id: null,
            from_facility_id: null,
        };

        if (targetType === 'WORKER') {
            messageData.to_user_id = recipientId;
            messageData.to_facility_id = application.workDate.job.facility_id;
        } else {
            messageData.to_facility_id = application.workDate.job.facility_id;
            messageData.to_user_id = application.user_id;
        }

        await prisma.message.create({ data: messageData });

        // ログ記録
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'CHAT',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                chat_application_id: applicationId,
                chat_message: message,
                status: 'SENT',
            },
        });
    } catch (error: any) {
        console.error('Chat notification failed:', error);
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'CHAT',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                chat_application_id: applicationId,
                chat_message: message,
                status: 'FAILED',
                error_message: error.message,
            },
        });
    }
}

// メール通知を送信（擬似: DBに記録のみ）
async function sendEmailNotification(params: {
    notificationKey: string;
    targetType: string;
    recipientId: number;
    recipientName: string;
    recipientEmail: string;
    toAddresses: string[];
    subject: string;
    body: string;
}): Promise<void> {
    const { notificationKey, targetType, recipientId, recipientName, recipientEmail, toAddresses, subject, body } = params;

    try {
        // TODO: 将来的にSMTP連携実装時にここで実際にメール送信
        // 現在はログ記録のみ

        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'EMAIL',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                from_address: 'noreply@s-works.jp',
                to_addresses: toAddresses,
                subject,
                body,
                status: 'SENT',
            },
        });
    } catch (error: any) {
        console.error('Email notification failed:', error);
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'EMAIL',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                from_address: 'noreply@s-works.jp',
                to_addresses: toAddresses,
                subject,
                body,
                status: 'FAILED',
                error_message: error.message,
            },
        });
    }
}

// プッシュ通知を送信
async function sendPushNotification(params: {
    notificationKey: string;
    targetType: string;
    recipientId: number;
    recipientName: string;
    title: string;
    body: string;
    url: string;
}): Promise<void> {
    const { notificationKey, targetType, recipientId, recipientName, title, body, url } = params;

    try {
        // プッシュ購読情報を取得
        const subscriptions = await prisma.pushSubscription.findMany({
            where: targetType === 'WORKER'
                ? { user_id: recipientId, user_type: 'worker' }
                : { admin_id: recipientId, user_type: 'facility_admin' },
        });

        if (subscriptions.length === 0) {
            // 購読がない場合はスキップ（エラーではない）
            return;
        }

        const payload = JSON.stringify({ title, body, url });

        // 全デバイスに送信
        for (const sub of subscriptions) {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    payload
                );
            } catch (error: any) {
                // 無効な購読は削除
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } });
                }
            }
        }

        // ログ記録
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'PUSH',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                push_title: title,
                push_body: body,
                push_url: url,
                status: 'SENT',
            },
        });
    } catch (error: any) {
        console.error('Push notification failed:', error);
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'PUSH',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                push_title: title,
                push_body: body,
                push_url: url,
                status: 'FAILED',
                error_message: error.message,
            },
        });
    }
}
