
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Resetting Job 15 Counts ---');
    // ID 156 is 2025-12-15
    await prisma.jobWorkDate.update({
        where: { id: 156 },
        data: {
            applied_count: 0,
            matched_count: 0
        }
    });
    console.log('Reset JobWorkDate 156 counts to 0.');

    console.log('--- Finding System Admin ---');
    // Check FacilityAdmin for system roles?
    const admins = await prisma.facilityAdmin.findMany({});
    console.log('Facility Admins count:', admins.length);
    const systemAdmins = admins.filter(a => a.role === 'system_admin' || a.email.includes('admin'));
    console.log('Potential System Admins (FacilityAdmin):', systemAdmins.map(a => ({ email: a.email, role: a.role })));

    // Check User for system roles?
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { email: { contains: 'admin' } }
            ]
        }
    });
    console.log('Potential System Admins (User):', users.map(u => ({ email: u.email })));

    // Is there a SystemAdmin model?
    // I need to check schema. But I can't check schema from prisma client easily if it's not generated.
    // Try to access prisma.systemAdmin
    if ((prisma as any).systemAdmin) {
        const sysAdmins = await (prisma as any).systemAdmin.findMany({});
        console.log('SystemAdmin model found:', sysAdmins);
    } else {
        console.log('SystemAdmin model NOT found on prisma client');
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
