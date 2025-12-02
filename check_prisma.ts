import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Prisma Client...');
    try {
        // Check if we can select job_id from Review
        const review = await prisma.review.findFirst({
            select: {
                id: true,
                // @ts-ignore
                job_id: true,
            },
        });
        console.log('Review:', review);

        // Check if we can include job
        const reviewWithJob = await prisma.review.findFirst({
            include: {
                // @ts-ignore
                job: true,
            },
        });
        console.log('Review with Job:', reviewWithJob);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
