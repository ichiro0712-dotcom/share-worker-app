import { PrismaClient } from '@prisma/client';
import { sendNotification } from '../../src/lib/notification-service';

const prisma = new PrismaClient();

interface TestResult {
    name: string;
    notificationKey: string;
    passed: boolean;
    logId?: number;
    error?: string;
}

const results: TestResult[] = [];

async function checkNotificationLog(
    notificationKey: string,
    afterTimestamp: Date
): Promise<{ found: boolean; logId?: number }> {
    // Wait a bit more to ensure DB write
    await new Promise(resolve => setTimeout(resolve, 2000));

    const log = await prisma.notificationLog.findFirst({
        where: {
            notification_key: notificationKey,
            created_at: { gte: afterTimestamp },
        },
        orderBy: { created_at: 'desc' },
    });
    return { found: !!log, logId: log?.id };
}

async function runTest(
    name: string,
    notificationKey: string,
    sendFn: () => Promise<void>
) {
    console.log(`\n📧 テスト: ${name} (${notificationKey})`);
    const startTime = new Date();

    try {
        await sendFn();
        await new Promise(resolve => setTimeout(resolve, 500));
        const result = await checkNotificationLog(notificationKey, startTime);

        results.push({
            name,
            notificationKey,
            passed: result.found,
            logId: result.logId,
        });

        console.log(result.found ? '  ✅ PASS' : '  ❌ FAIL');
    } catch (error) {
        results.push({
            name,
            notificationKey,
            passed: false,
            error: String(error),
        });
        console.log(`  ❌ ERROR: ${error}`);
    }
}

async function main() {
    console.log('🧪 残り通知テスト開始 (22件) CORRECTED\n');
    console.log('=====================================');

    // テストデータ取得
    // Ensure we have a valid worker
    let worker = await prisma.user.findFirst({ where: { email: 'yamada@example.com' } });
    if (!worker) {
        worker = await prisma.user.findFirst();
    }

    let facility = await prisma.facility.findFirst({ include: { admins: true } });
    let job = await prisma.job.findFirst({ where: { status: 'PUBLISHED' } });

    if (!worker || !facility || !job) {
        console.error('テストデータが不足しています');
        return;
    }

    // ========== ワーカー向け ==========

    await runTest('面接採用決定', 'WORKER_INTERVIEW_ACCEPTED', async () => {
        await sendNotification({
            notificationKey: 'WORKER_INTERVIEW_ACCEPTED',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
                job_title: job!.title,
                work_date: '2025-01-15',
            },
        });
    });

    await runTest('面接不採用', 'WORKER_INTERVIEW_REJECTED', async () => {
        await sendNotification({
            notificationKey: 'WORKER_INTERVIEW_REJECTED',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
                job_title: job!.title,
            },
        });
    });

    await runTest('勤務前日リマインド', 'WORKER_REMINDER_DAY_BEFORE', async () => {
        await sendNotification({
            notificationKey: 'WORKER_REMINDER_DAY_BEFORE',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
                job_title: job!.title,
                work_date: '明日',
                start_time: '09:00',
                facility_address: facility!.address || '東京都渋谷区',
            },
        });
    });

    await runTest('勤務当日リマインド', 'WORKER_REMINDER_SAME_DAY', async () => {
        await sendNotification({
            notificationKey: 'WORKER_REMINDER_SAME_DAY',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
                job_title: job!.title,
                start_time: '09:00',
                facility_address: facility!.address || '東京都渋谷区',
            },
        });
    });

    await runTest('レビュー依頼', 'WORKER_REVIEW_REQUEST', async () => {
        await sendNotification({
            notificationKey: 'WORKER_REVIEW_REQUEST',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
                work_date: '2025-01-10',
            },
        });
    });

    await runTest('レビュー催促', 'WORKER_REVIEW_REMINDER', async () => {
        await sendNotification({
            notificationKey: 'WORKER_REVIEW_REMINDER',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
            },
        });
    });

    await runTest('施設レビュー受信', 'WORKER_REVIEW_RECEIVED', async () => {
        await sendNotification({
            notificationKey: 'WORKER_REVIEW_RECEIVED',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                worker_name: worker!.name,
                facility_name: facility!.facility_name,
            },
        });
    });

    await runTest('お気に入り締切間近', 'WORKER_FAVORITE_DEADLINE', async () => {
        await sendNotification({
            notificationKey: 'WORKER_FAVORITE_DEADLINE',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                facility_name: facility!.facility_name,
                remaining_hours: '24',
            },
        });
    });

    await runTest('お気に入り新着求人', 'WORKER_FAVORITE_NEW_JOB', async () => {
        await sendNotification({
            notificationKey: 'WORKER_FAVORITE_NEW_JOB',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                facility_name: facility!.facility_name,
            },
        });
    });

    await runTest('ワーカーお知らせ', 'WORKER_ANNOUNCEMENT', async () => {
        await sendNotification({
            notificationKey: 'WORKER_ANNOUNCEMENT',
            targetType: 'WORKER',
            recipientId: worker!.id,
            recipientName: worker!.name,
            recipientEmail: worker!.email,
            variables: {
                announcement_title: 'テストお知らせ',
                announcement_body: 'これはテストです。',
            },
        });
    });

    // ========== 施設向け ==========

    await runTest('ワーカーキャンセル', 'FACILITY_CANCELLED_BY_WORKER', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_CANCELLED_BY_WORKER',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                facility_name: facility!.facility_name,
                worker_name: worker!.name,
                job_title: job!.title,
                work_date: '2025-01-15',
            },
        });
    });

    await runTest('施設勤務前日リマインド', 'FACILITY_REMINDER_DAY_BEFORE', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_REMINDER_DAY_BEFORE',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                facility_name: facility!.facility_name,
                worker_name: worker!.name,
                job_title: job!.title,
                work_date: '明日',
                start_time: '09:00',
            },
        });
    });

    await runTest('施設レビュー依頼', 'FACILITY_REVIEW_REQUEST', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_REVIEW_REQUEST',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                facility_name: facility!.facility_name,
                worker_name: worker!.name,
                work_date: '2025-01-10',
            },
        });
    });

    await runTest('ワーカーレビュー受信', 'FACILITY_REVIEW_RECEIVED', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_REVIEW_RECEIVED',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                facility_name: facility!.facility_name,
                worker_name: worker!.name,
            },
        });
    });

    await runTest('求人締切間近', 'FACILITY_DEADLINE_WARNING', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_DEADLINE_WARNING',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                facility_name: facility!.facility_name,
                job_title: job!.title,
                deadline: '2025-01-20',
                current_applicants: '1',
                required_applicants: '5',
            },
        });
    });

    await runTest('募集枠埋まり', 'FACILITY_SLOTS_FILLED', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_SLOTS_FILLED',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                facility_name: facility!.facility_name,
                job_title: job!.title,
                work_date: '2025-01-15',
            },
        });
    });

    await runTest('施設お知らせ', 'FACILITY_ANNOUNCEMENT', async () => {
        await sendNotification({
            notificationKey: 'FACILITY_ANNOUNCEMENT',
            targetType: 'FACILITY',
            recipientId: facility!.id,
            recipientName: facility!.facility_name,
            facilityEmails: (facility!.staff_emails && facility!.staff_emails.length > 0) ? facility!.staff_emails : ['test-facility@example.com'],
            variables: {
                announcement_title: 'テストお知らせ',
                announcement_body: 'これはテストです。',
            },
        });
    });

    // ========== システム管理者向け ==========

    await runTest('新規ワーカー登録', 'ADMIN_NEW_WORKER', async () => {
        await sendNotification({
            notificationKey: 'ADMIN_NEW_WORKER',
            targetType: 'SYSTEM_ADMIN',
            recipientId: 1, // Admin ID
            recipientName: '管理者',
            recipientEmail: 'admin@sworks.jp',
            variables: {
                user_name: '新規 太郎',
                user_email: 'new@example.com',
                registered_at: new Date().toLocaleString('ja-JP'),
            },
        });
    });

    await runTest('新規施設登録', 'ADMIN_NEW_FACILITY', async () => {
        await sendNotification({
            notificationKey: 'ADMIN_NEW_FACILITY',
            targetType: 'SYSTEM_ADMIN',
            recipientId: 1,
            recipientName: '管理者',
            recipientEmail: 'admin@sworks.jp',
            variables: {
                facility_name: '新規施設',
                corporation_name: '株式会社テスト',
                registered_at: new Date().toLocaleString('ja-JP'),
            },
        });
    });

    await runTest('低評価連続', 'ADMIN_LOW_RATING_STREAK', async () => {
        await sendNotification({
            notificationKey: 'ADMIN_LOW_RATING_STREAK',
            targetType: 'SYSTEM_ADMIN',
            recipientId: 1,
            recipientName: '管理者',
            recipientEmail: 'admin@sworks.jp',
            variables: {
                target_type: 'ワーカー',
                target_name: worker!.name,
                target_id: String(worker!.id),
                average_rating: '2.1',
                low_rating_count: '3',
                trigger_reason: '連続低評価',
            },
        });
    });

    await runTest('キャンセル率異常', 'ADMIN_HIGH_CANCEL_RATE', async () => {
        await sendNotification({
            notificationKey: 'ADMIN_HIGH_CANCEL_RATE',
            targetType: 'SYSTEM_ADMIN',
            recipientId: 1,
            recipientName: '管理者',
            recipientEmail: 'admin@sworks.jp',
            variables: {
                target_type: 'ワーカー',
                target_name: worker!.name,
                target_id: String(worker!.id),
                cancel_rate: '45',
                consecutive_cancels: '4',
                trigger_reason: 'キャンセル率超過',
            },
        });
    });

    await runTest('不正アクセス検知', 'ADMIN_SUSPICIOUS_ACCESS', async () => {
        await sendNotification({
            notificationKey: 'ADMIN_SUSPICIOUS_ACCESS',
            targetType: 'SYSTEM_ADMIN',
            recipientId: 1,
            recipientName: '管理者',
            recipientEmail: 'admin@sworks.jp',
            variables: {
                user_email: 'suspicious@example.com',
                ip_address: '192.168.1.100',
                detected_at: new Date().toLocaleString('ja-JP'),
                reason: 'ログイン失敗10回',
            },
        });
    });

    // ========== 結果サマリー ==========
    console.log('\n=====================================');
    console.log('📊 テスト結果サマリー\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`📈 成功率: ${Math.round((passed / results.length) * 100)}%\n`);

    console.log('詳細:');
    results.forEach(r => {
        const status = r.passed ? '✅' : '❌';
        console.log(`  ${status} ${r.notificationKey} ${r.error ? `(${r.error})` : ''}`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
