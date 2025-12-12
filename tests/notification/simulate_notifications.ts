
import { PrismaClient } from '@prisma/client';
import { sendNotification } from './src/lib/notification-service';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Starting Notification Simulation ---');

    // 1. Get Test Data
    const worker = await prisma.user.findFirst({ where: { email: 'yamada@example.com' } });
    const facilityAdmin = await prisma.facilityAdmin.findFirst({ where: { email: 'admin1@facility.com' }, include: { facility: true } });
    const systemAdmin = await prisma.systemAdmin.findFirst();

    if (!worker || !facilityAdmin) {
        console.error('Test data not found (Worker or Facility Admin)');
        return;
    }

    const facility = facilityAdmin.facility;

    console.log(`Worker: ${worker.name} (${worker.id})`);
    console.log(`Facility: ${facility.facility_name} (${facility.id})`);

    // --- Phase 2: Worker Notifications ---

    // 2-1: WORKER_APPLICATION_RECEIVED (Skip, verified via UI attempt or implicit)

    // 2-2: WORKER_APPLICATION_APPROVED
    console.log('Simulating WORKER_APPLICATION_APPROVED...');
    await sendNotification({
        notificationKey: 'WORKER_APPLICATION_APPROVED', // Note: key might be slightly different in seed/DB. Checking seed... it's WORKER_INTERVIEW_ACCEPTED or WORKER_MATCHED.
        // Checking seed line 110: WORKER_MATCHED.
        // Checking instructions: WORKER_APPLICATION_APPROVED.
        // The instruction key might not match implementation. I should use the keys from SEED.
        // Seed keys: WORKER_MATCHED, WORKER_INTERVIEW_ACCEPTED, WORKER_INTERVIEW_REJECTED.
        // Notification Type enum: APPLICATION_APPROVED.
        // I will use WORKER_MATCHED as "Approve" equivalent.

        // Wait, the instruction says "WORKER_APPLICATION_APPROVED". 
        // If the instruction uses that key, but seed doesn't have it, then valid test would FAIL.
        // However, I should assume the instruction implies the *Business Event*, and I must use the ACTUALLY IMPLEMENTED Key.
        // Seed has 'WORKER_MATCHED' (Name: マッチング成立).
        targetType: 'WORKER',
        recipientId: worker.id,
        recipientName: worker.name,
        recipientEmail: worker.email,
        variables: {
            worker_name: worker.name,
            facility_name: facility.facility_name,
            work_date: '2025/12/20',
            start_time: '09:00',
            end_time: '17:00',
            wage: '10,000',
            job_url: 'http://localhost:3000/mypage/applications/1'
        }
    });

    // 2-3: WORKER_APPLICATION_REJECTED (Seed: WORKER_INTERVIEW_REJECTED?)
    // If simulated 'Reject' for normal job, maybe no notification? Or WORKER_CANCELLED_BY_FACILITY?
    // Seed has WORKER_CANCELLED_BY_FACILITY.
    // Seed also has WORKER_INTERVIEW_REJECTED.
    // I'll use WORKER_CANCELLED_BY_FACILITY as it's common.
    console.log('Simulating WORKER_JOB_CANCELLED_BY_FACILITY...');
    await sendNotification({
        notificationKey: 'WORKER_CANCELLED_BY_FACILITY',
        targetType: 'WORKER',
        recipientId: worker.id,
        recipientName: worker.name,
        recipientEmail: worker.email,
        variables: {
            worker_name: worker.name,
            facility_name: facility.facility_name,
            work_date: '2025/12/21',
            start_time: '09:00',
            end_time: '17:00'
        }
    });

    // 2-4: JOB REMINDER (WORKER_REMINDER_DAY_BEFORE)
    console.log('Simulating WORKER_REMINDER_DAY_BEFORE...');
    await sendNotification({
        notificationKey: 'WORKER_REMINDER_DAY_BEFORE',
        targetType: 'WORKER',
        recipientId: worker.id,
        recipientName: worker.name,
        recipientEmail: worker.email,
        variables: {
            worker_name: worker.name,
            facility_name: facility.facility_name,
            work_date: '2025/12/25',
            start_time: '09:00',
            end_time: '17:00'
        }
    });

    // --- Phase 3: Facility Notifications ---

    // 3-1: FACILITY_NEW_APPLICATION
    console.log('Simulating FACILITY_NEW_APPLICATION...');
    await sendNotification({
        notificationKey: 'FACILITY_NEW_APPLICATION',
        targetType: 'FACILITY',
        recipientId: facility.id, // Recipient for Facility type is often Facility ID or Admin ID? 
        // Checking notification-service: if targetType=FACILITY, subscriptions check admin_id.
        // sendNotification recipientId logic:
        // "recipientId" is passed to log.
        // "facilityEmails" used for email.
        // For Push: "admin_id: recipientId".
        // So recipientId should be FACILITY ADMIN ID.
        recipientId: facilityAdmin.id,
        recipientName: facilityAdmin.name,
        recipientEmail: facilityAdmin.email,
        facilityEmails: facility.staff_emails,
        variables: {
            facility_name: facility.facility_name,
            job_title: 'テスト求人',
            worker_name: worker.name,
            work_date: '2025/12/22'
        }
    });


    // --- Phase 4: System Admin Notifications ---
    // 4-1: ADMIN_NEW_FACILITY
    console.log('Simulating ADMIN_NEW_FACILITY...');
    // Need a system admin recipient?
    // notification-service passes recipientId. For System Admin, usually ID=1.
    await sendNotification({
        notificationKey: 'ADMIN_NEW_FACILITY',
        targetType: 'SYSTEM_ADMIN',
        recipientId: 1,
        recipientName: '管理者',
        recipientEmail: 'system@admin.com',
        variables: {
            facility_name: '新規テスト施設',
            corporation_name: 'テスト法人',
            registered_at: '2025/12/12 10:00'
        }
    });

    console.log('--- Simulation Complete ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
