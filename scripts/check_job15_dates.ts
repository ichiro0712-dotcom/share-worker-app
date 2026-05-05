
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Job 15 Work Dates ---');

    const job = await prisma.job.findUnique({
        where: { id: 15 },
        include: {
            workDates: true
        }
    });

    if (!job) {
        console.error('Job 15 not found');
        return;
    }

    console.log('Work Dates for Job 15:');
    job.workDates.forEach(wd => {
        console.log(`ID: ${wd.id}, Date: ${wd.work_date.toISOString()}, Recruited: ${wd.recruitment_count}, Matched: ${wd.matched_count}, Applied: ${wd.applied_count}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
