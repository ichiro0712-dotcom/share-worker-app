
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Admin 15 & Facility 15 ---');

    const admin = await prisma.facilityAdmin.findUnique({
        where: { email: 'admin15@facility.com' },
        include: { facility: true }
    });

    if (!admin) {
        console.log('Admin admin15@facility.com NOT FOUND');
    } else {
        console.log('Admin found:', admin.email);
        // Relationship might be named differently, checking raw first
        // console.log('Linked Facilies:', admin.facility);
    }

    const job = await prisma.job.findUnique({
        where: { id: 15 },
        include: { facility: true }
    });
    console.log('Job 15 Facility:', (job?.facility as any)?.name, 'ID:', job?.facility?.id);

    const apps = await prisma.application.findMany({
        where: {
            user: { email: 'yamada@example.com' }
        },
        include: {
            workDate: {
                include: { job: true }
            }
        }
    });
    console.log('Applications found:', apps.length);
    const targetApp = apps.find(a => a.workDate?.job_id === 15);
    if (targetApp) {
        console.log('Job 15 App:', targetApp);
        console.log('Job 15 Facility ID:', targetApp.workDate.job.facility_id);
    } else {
        console.log('Job 15 App NOT FOUND');
    }

    // List all facility admins
    const admins = await prisma.facilityAdmin.findMany({
        where: { email: 'admin15@facility.com' }
    });
    console.log('Admins raw:', admins);

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
