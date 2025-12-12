
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'yamada@example.com';
    console.log(`Updating user ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error('User not found');
        process.exit(1);
    }

    await prisma.user.update({
        where: { email },
        data: {
            current_work_style: '正社員',
            desired_work_style: '派遣',
            bank_name: 'テスト銀行',
            branch_name: 'テスト支店',
            account_name: 'ヤマダ タロウ',
            account_number: '1234567',
            // Remove qualifications to avoid certificate upload requirement
            qualifications: [],
            // Or if we want to keep them, we need to mock certificates like:
            // qualification_certificates: { '介護福祉士': 'dummy.jpg' }
        },
    });

    console.log('User updated successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
