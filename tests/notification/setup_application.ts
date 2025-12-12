
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'yamada@example.com';
    const facilityAdminEmail = 'admin1@facility.com';

    const user = await prisma.user.findUnique({ where: { email } });
    const admin = await prisma.facilityAdmin.findUnique({ where: { email: facilityAdminEmail }, include: { facility: true } });

    if (!user || !admin) {
        console.error('User or Admin not found');
        process.exit(1);
    }

    // Create Job 1: APPROVE
    const jobApprove = await prisma.job.create({
        data: {
            facility_id: admin.facility_id,
            title: 'テスト求人(承認用)',
            status: 'PUBLISHED',
            start_time: '09:00',
            end_time: '17:00',
            break_time: '60分',
            wage: 10000,
            hourly_wage: 1000,
            transportation_fee: 500,
            recruitment_count: 5,
            address: '東京都新宿区',
            access: '新宿駅',
            work_content: ['テスト'],
            required_qualifications: [],
            required_experience: [],
            dresscode: [],
            belongings: [],
            manager_name: '管理者',
            overview: '承認用テスト求人です',
            images: [],
        }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const workDateApprove = await prisma.jobWorkDate.create({
        data: {
            job_id: jobApprove.id,
            work_date: tomorrow,
            deadline: tomorrow,
            recruitment_count: 5,
        }
    });

    await prisma.application.create({
        data: {
            work_date_id: workDateApprove.id,
            user_id: user.id,
            status: 'APPLIED',
        }
    });

    // Create Job 2: REJECT
    const jobReject = await prisma.job.create({
        data: {
            facility_id: admin.facility_id,
            title: 'テスト求人(却下用)',
            status: 'PUBLISHED',
            start_time: '09:00',
            end_time: '17:00',
            break_time: '60分',
            wage: 10000,
            hourly_wage: 1000,
            transportation_fee: 500,
            recruitment_count: 5,
            address: '東京都新宿区',
            access: '新宿駅',
            work_content: ['テスト'],
            required_qualifications: [],
            required_experience: [],
            dresscode: [],
            belongings: [],
            manager_name: '管理者',
            overview: '却下用テスト求人です',
            images: [],
        }
    });

    const workDateReject = await prisma.jobWorkDate.create({
        data: {
            job_id: jobReject.id,
            work_date: tomorrow,
            deadline: tomorrow,
            recruitment_count: 5,
        }
    });

    await prisma.application.create({
        data: {
            work_date_id: workDateReject.id,
            user_id: user.id,
            status: 'APPLIED',
        }
    });

    console.log('Applications created successfully (Approve & Reject).');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
