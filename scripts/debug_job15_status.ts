
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Job 15 Status ---');

    const user = await prisma.user.findUnique({ where: { email: 'yamada@example.com' } });
    if (!user) { console.error('User not found'); return; }

    const application = await prisma.application.findFirst({
        where: {
            user_id: user.id,
            workDate: {
                job_id: 15
            }
        },
        include: {
            workDate: true
        }
    });

    if (application) {
        console.log('Application FOUND:', application);
    } else {
        console.log('Application NOT FOUND');
    }

    // Check logs
    const logs = await prisma.notificationLog.findMany({
        where: {
            notification_key: 'FACILITY_NEW_APPLICATION'
        },
        orderBy: { created_at: 'desc' },
        take: 5
    });

    console.log('Recent FACILITY_NEW_APPLICATION logs:', logs.map(l => ({
        key: l.notification_key,
        target: l.target_type,
        message: l.body?.substring(0, 20)
    })));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
