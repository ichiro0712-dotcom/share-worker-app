
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying Logs ---');

    const keys = [
        'WORKER_CANCELLED_BY_FACILITY',
        'WORKER_REMINDER_DAY_BEFORE',
        'FACILITY_NEW_APPLICATION',
        'ADMIN_NEW_FACILITY',
        // 'WORKER_APPLICATION_APPROVED' // Failed, so we expect 0 or miss
    ];

    for (const key of keys) {
        const count = await prisma.notificationLog.count({
            where: { notification_key: key }
        });
        console.log(`${key}: ${count}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
