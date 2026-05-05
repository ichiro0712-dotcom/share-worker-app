
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const user = await prisma.user.findUnique({ where: { email: 'yamada@example.com' } });
    if (!user) {
        console.log('User not found');
        return;
    }
    const apps = await prisma.application.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        take: 1
    });
    console.log('Latest Application:', JSON.stringify(apps, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
