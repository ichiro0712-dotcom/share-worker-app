import { prisma } from '@/lib/prisma';
import webPush from 'web-push';
import { Resend } from 'resend';
import { getTodayStart } from '@/utils/debugTime';

// Resend設定
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tastas.site';

// VAPID設定
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@tastas.jp';

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
    applicationId?: number; // システム通知用
    variables: Record<string, string>;
    // チャットメッセージ（Messageテーブル）用の追加情報
    chatMessageData?: {
        jobId: number;
        fromFacilityId?: number;
        fromUserId?: number;
        toUserId?: number;
        toFacilityId?: number;
    };
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
        chatMessageData,
    } = params;

    // 通知設定を取得
    const setting = await prisma.notificationSetting.findUnique({
        where: { notification_key: notificationKey },
    });

    if (!setting) {
        console.warn(`Notification setting not found: ${notificationKey}`);
        return;
    }

    // チャットメッセージ（Messageテーブル）を送信
    if (setting.chat_enabled && setting.chat_message && chatMessageData) {
        const chatContent = replaceVariables(setting.chat_message, variables);
        try {
            await prisma.message.create({
                data: {
                    application_id: applicationId || null,
                    job_id: chatMessageData.jobId,
                    from_facility_id: chatMessageData.fromFacilityId || null,
                    from_user_id: chatMessageData.fromUserId || null,
                    to_user_id: chatMessageData.toUserId || null,
                    to_facility_id: chatMessageData.toFacilityId || null,
                    content: chatContent,
                },
            });
            console.log(`[sendNotification] Chat message sent for ${notificationKey}`);
        } catch (error) {
            console.error(`[sendNotification] Failed to create chat message for ${notificationKey}:`, error);
        }
    }

    // システム通知（SystemNotificationテーブル）を送信
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

// チャット通知を送信（システム通知テーブルを使用）
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

        // SystemNotificationテーブルに保存
        await prisma.systemNotification.create({
            data: {
                notification_key: notificationKey,
                target_type: targetType,
                recipient_id: recipientId,
                content: message,
                application_id: applicationId,
                job_id: application.workDate.job_id,
            },
        });

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
        console.error('System notification creation failed:', error);
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

// メール通知を送信（Resend経由）
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

    // メール送信が無効化されている場合はスキップ
    if (process.env.DISABLE_EMAIL_SENDING === 'true') {
        console.log('[Email] Sending disabled, logging only:', { to: toAddresses, subject });
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'EMAIL',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                from_address: FROM_EMAIL,
                to_addresses: toAddresses,
                subject,
                body,
                status: 'SKIPPED',
                error_message: 'Email sending disabled',
            },
        });
        return;
    }

    try {
        // Resendでメール送信
        const { data, error } = await resend.emails.send({
            from: `+TASTAS <${FROM_EMAIL}>`,
            to: toAddresses,
            subject: subject,
            html: formatEmailHtml(body),
            text: body, // プレーンテキスト版
        });

        if (error) {
            throw new Error(error.message);
        }

        console.log('[Email] Sent successfully:', { messageId: data?.id, to: toAddresses });

        // 成功ログ記録
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'EMAIL',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                from_address: FROM_EMAIL,
                to_addresses: toAddresses,
                subject,
                body,
                status: 'SENT',
            },
        });
    } catch (error: any) {
        console.error('[Email] Failed to send:', error);
        await prisma.notificationLog.create({
            data: {
                notification_key: notificationKey,
                channel: 'EMAIL',
                target_type: targetType,
                recipient_id: recipientId,
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                from_address: FROM_EMAIL,
                to_addresses: toAddresses,
                subject,
                body,
                status: 'FAILED',
                error_message: error.message,
            },
        });
    }
}

// メール本文をHTML形式に変換
function formatEmailHtml(body: string): string {
    // 改行をbrタグに変換し、基本的なHTMLテンプレートでラップ
    const htmlBody = body.replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${htmlBody}
    </div>
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        <p>このメールは +TASTAS より自動送信されています。</p>
        <p>※このメールに心当たりがない場合は、お手数ですが削除してください。</p>
    </div>
</body>
</html>`;
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

// ========== 近隣通知・求人通知機能 ==========

/**
 * Haversine公式による2点間の距離を計算（km）
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * 指定した施設から一定距離以内のワーカーを取得
 * @param facilityId 施設ID
 * @param distanceKm 距離（km）
 * @returns 対象ワーカーのID配列
 */
export async function getNearbyWorkers(facilityId: number, distanceKm: number): Promise<number[]> {
    // 施設の座標を取得
    const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
        select: { lat: true, lng: true }
    });

    if (!facility || (facility.lat === 0 && facility.lng === 0)) {
        return [];
    }

    // lat/lngが設定されているワーカーを取得
    const workers = await prisma.user.findMany({
        where: {
            lat: { not: null },
            lng: { not: null },
            deleted_at: null,
            is_suspended: false
        },
        select: { id: true, lat: true, lng: true }
    });

    // 距離フィルタリング（Haversine公式）
    const nearbyWorkerIds: number[] = [];
    for (const worker of workers) {
        if (worker.lat && worker.lng) {
            const distance = calculateDistance(
                facility.lat, facility.lng,
                worker.lat, worker.lng
            );
            if (distance <= distanceKm) {
                nearbyWorkerIds.push(worker.id);
            }
        }
    }

    return nearbyWorkerIds;
}

/**
 * ワーカーが今日受け取った近隣通知の数をチェック
 * @returns 通知可能ならtrue
 */
async function canSendNearbyNotification(
    userId: number,
    notificationKey: string,
    maxPerDay: number
): Promise<boolean> {
    const today = getTodayStart();

    const count = await prisma.nearbyNotificationLog.count({
        where: {
            user_id: userId,
            notification_key: notificationKey,
            sent_at: { gte: today }
        }
    });

    return count < maxPerDay;
}

/**
 * 通知送信後にログを記録
 */
async function logNearbyNotification(userId: number, notificationKey: string): Promise<void> {
    await prisma.nearbyNotificationLog.create({
        data: {
            user_id: userId,
            notification_key: notificationKey
        }
    });
}

/**
 * 近隣ワーカーへの通知を送信
 */
export async function sendNearbyJobNotifications(
    jobId: number,
    notificationKey: 'WORKER_NEARBY_NEW_JOB' | 'WORKER_NEARBY_CANCEL_AVAILABLE'
): Promise<void> {

    // 1. 通知設定を取得
    const setting = await prisma.notificationSetting.findFirst({
        where: { notification_key: notificationKey }
    });

    if (!setting) return;

    // 2. 設定値を取得
    const thresholds = setting.alert_thresholds as any || {};
    const distanceKm = thresholds.distance_km || 10;
    const maxPerDay = thresholds.max_notifications_per_day || 5;

    // 3. 求人と施設情報を取得
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
            facility: true,
            workDates: {
                take: 1,
                orderBy: { work_date: 'asc' }
            }
        }
    });

    if (!job) return;

    // 4. 近隣ワーカーを取得
    const nearbyWorkerIds = await getNearbyWorkers(job.facility_id, distanceKm);

    // 5. 各ワーカーに通知送信
    for (const workerId of nearbyWorkerIds) {
        // 頻度チェック
        const canSend = await canSendNearbyNotification(workerId, notificationKey, maxPerDay);
        if (!canSend) continue;

        // ワーカー情報を取得（名前に置換するため）
        const worker = await prisma.user.findUnique({
            where: { id: workerId },
            select: { name: true, email: true, last_name_kana: true }
        });

        if (!worker) continue;

        // 通知データ準備
        const variables = {
            facility_name: job.facility.facility_name,
            job_title: job.title,
            work_date: job.workDates[0]?.work_date
                ? new Date(job.workDates[0].work_date).toLocaleDateString('ja-JP')
                : '未定',
            worker_name: worker.name,
            worker_last_name: worker.last_name_kana || worker.name,
            job_url: `${process.env.NEXTAUTH_URL || 'https://tastas.jp'}/jobs/${job.id}`
        };

        // 通知送信

        // チャット通知 (Applicationが存在しないため送信不可の場合はスキップ)
        // ※ここではApplicationIDがないため、sendChatNotificationは使えません。
        // もしsendNotificationを使うならapplicationIdはundefinedになります。

        // メール通知
        if (setting.email_enabled && setting.email_subject && setting.email_body) {
            await sendEmailNotification({
                notificationKey,
                targetType: 'WORKER',
                recipientId: workerId,
                recipientName: worker.name,
                recipientEmail: worker.email,
                toAddresses: [worker.email],
                subject: replaceVariables(setting.email_subject, variables),
                body: replaceVariables(setting.email_body, variables),
            });
        }

        // プッシュ通知
        if (setting.push_enabled && setting.push_title && setting.push_body) {
            await sendPushNotification({
                notificationKey,
                targetType: 'WORKER',
                recipientId: workerId,
                recipientName: worker.name,
                title: replaceVariables(setting.push_title, variables),
                body: replaceVariables(setting.push_body, variables),
                url: variables.job_url,
            });
        }

        // ログ記録
        await logNearbyNotification(workerId, notificationKey);
    }
}
