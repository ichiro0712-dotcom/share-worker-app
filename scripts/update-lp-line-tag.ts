import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * LP 1と2のhas_line_tagをtrueに更新
 * 既存HTMLにdata-cats="lineFriendsFollowLink"が設置されているため
 */
async function main() {
  console.log('Updating LP 1 and 2 has_line_tag to true...');

  const result = await prisma.landingPage.updateMany({
    where: {
      lp_number: {
        in: [1, 2],
      },
    },
    data: {
      has_line_tag: true,
    },
  });

  console.log(`Updated ${result.count} LP records`);

  // 確認
  const lps = await prisma.landingPage.findMany({
    where: {
      lp_number: {
        in: [1, 2],
      },
    },
    select: {
      lp_number: true,
      name: true,
      has_gtm: true,
      has_line_tag: true,
      has_tracking: true,
    },
  });

  console.log('Updated LPs:');
  lps.forEach((lp) => {
    console.log(`  LP ${lp.lp_number}: ${lp.name}`);
    console.log(`    GTM: ${lp.has_gtm}, LINE(data-cats): ${lp.has_line_tag}, Tracking: ${lp.has_tracking}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
