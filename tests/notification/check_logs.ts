
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetType = process.argv[2]; // e.g. WORKER
    const key = process.argv[3]; // e.g. WORKER_APPLICATION_RECEIVED

    if (!targetType) {
        console.log("Usage: npx tsx check_logs.ts <TARGET_TYPE> [KEY]");
        process.exit(1);
    }

    const where: any = {
        target_type: targetType,
    };
    if (key) {
        where.notification_key = key;
    }

    const logs = await prisma.notificationLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 1,
    });

    if (logs.length === 0) {
        console.log("No logs found.");
    } else {
        console.log("Log found:");
        console.log(JSON.stringify(logs[0], null, 2));
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
