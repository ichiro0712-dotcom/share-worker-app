
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Job 15 ---');

    const job = await prisma.job.findUnique({
        where: { id: 15 },
        include: {
            facility: {
                include: {
                    admins: true
                }
            }
        }
    });

    if (!job) {
        console.error('Job 15 not found');
    } else {
        console.log(`Job 15 Title: ${job.title}`);
        console.log(`Facility ID: ${job.facility_id}`);
        console.log(`Facility Name: ${job.facility.facility_name}`);
        console.log('Admins:', job.facility.admins);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
