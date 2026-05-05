
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'yamada@example.com';
  console.log(`Updating profile for ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      current_work_style: 'パート・アルバイト',
      desired_work_style: 'パート・アルバイト',
      job_change_desire: '良い条件があれば',
      desired_work_days_week: '週3日以上',
      desired_work_period: '長期',
      desired_start_time: '09:00',
      desired_end_time: '18:00',
    },
  });

  console.log('Updated user:', updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
