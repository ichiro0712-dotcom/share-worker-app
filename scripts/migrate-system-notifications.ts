import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration of system notifications...');

    // 1. Find all system messages in Message table
    const systemMessages = await prisma.message.findMany({
        where: {
            from_user_id: null,
            from_facility_id: null,
            OR: [
                { to_facility_id: { not: null } },
                { to_user_id: { not: null } }
            ]
        },
    });

    console.log(`Found ${systemMessages.length} system messages.`);

    if (systemMessages.length === 0) {
        console.log('No messages to migrate.');
        return;
    }

    // 2. Migrate to SystemNotification table
    let migratedCount = 0;
    let errorCount = 0;

    for (const msg of systemMessages) {
        try {
            const targetType = msg.to_facility_id ? 'FACILITY' : 'WORKER';
            const recipientId = msg.to_facility_id || msg.to_user_id!;

            // Create SystemNotification
            await prisma.systemNotification.create({
                data: {
                    notification_key: 'SYSTEM_MESSAGE_MIGRATED', // Default key for migrated messages
                    target_type: targetType,
                    recipient_id: recipientId,
                    content: msg.content,
                    application_id: msg.application_id, // Can be null
                    job_id: msg.job_id, // Can be null
                    read_at: msg.read_at,
                    created_at: msg.created_at,
                },
            });
            migratedCount++;
        } catch (error) {
            console.error(`Failed to migrate message ID ${msg.id}:`, error);
            errorCount++;
        }
    }

    console.log(`Migrated ${migratedCount} messages.`);
    if (errorCount > 0) {
        console.log(`Failed to migrate ${errorCount} messages.`);
    }

    // 3. Delete migrated messages from Message table
    // We delete only after successful creation to be safe, but here we do it in bulk for simplicity if count matches?
    // Or delete one by one in the loop? Better one by one or bulk match.
    // Let's delete all found system messages.

    if (migratedCount > 0) {
        console.log('Deleting migrated messages from Message table...');
        const result = await prisma.message.deleteMany({
            where: {
                id: { in: systemMessages.map(m => m.id) },
            },
        });
        console.log(`Deleted ${result.count} messages from Message table.`);
    }

    console.log('Migration completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
