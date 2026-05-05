
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Resetting Yamada Applications ---');

    const user = await prisma.user.findUnique({
        where: { email: 'yamada@example.com' }
    });

    if (!user) {
        console.error('User yamada@example.com not found');
        process.exit(1);
    }

    const deleted = await prisma.application.deleteMany({
        where: {
            user_id: user.id
        }
    });

    console.log(`Deleted ${deleted.count} applications for yamada@example.com`);

    // Also clear notifications for clean slate check?
    // Not strictly necessary but good for test.
    /*
    const deletedLogs = await prisma.notificationLog.deleteMany({
        where: { recipient_email: user.email }
    });
    console.log(`Deleted ${deletedLogs.count} notification logs for yamada@example.com`);
    */
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
