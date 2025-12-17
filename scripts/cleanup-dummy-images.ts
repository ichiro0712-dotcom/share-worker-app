/**
 * 本番DBのダミー画像パスをクリアするスクリプト
 *
 * 使用方法:
 * DATABASE_URL="本番DB接続文字列" npx tsx scripts/cleanup-dummy-images.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== ダミー画像パスのクリーンアップ開始 ===\n');

  // 1. ユーザーのダミー画像をクリア
  const usersWithDummyImages = await prisma.user.findMany({
    where: {
      OR: [
        { profile_image: { contains: '/uploads/test/' } },
        { id_document: { contains: '/uploads/test/' } },
        { bank_book_image: { contains: '/uploads/test/' } },
      ],
    },
    select: {
      id: true,
      email: true,
      profile_image: true,
      id_document: true,
      bank_book_image: true,
      qualification_certificates: true,
    },
  });

  console.log(`ダミー画像を持つユーザー: ${usersWithDummyImages.length}人`);

  for (const user of usersWithDummyImages) {
    console.log(`\nユーザー ID:${user.id} (${user.email})`);

    const updates: {
      profile_image?: null;
      id_document?: null;
      bank_book_image?: null;
      qualification_certificates?: Prisma.InputJsonValue;
    } = {};

    if (user.profile_image?.includes('/uploads/test/')) {
      console.log(`  - profile_image: ${user.profile_image} → null`);
      updates.profile_image = null;
    }

    if (user.id_document?.includes('/uploads/test/')) {
      console.log(`  - id_document: ${user.id_document} → null`);
      updates.id_document = null;
    }

    if (user.bank_book_image?.includes('/uploads/test/')) {
      console.log(`  - bank_book_image: ${user.bank_book_image} → null`);
      updates.bank_book_image = null;
    }

    // 資格証明書のダミー画像もクリア
    if (user.qualification_certificates && typeof user.qualification_certificates === 'object') {
      const certs = user.qualification_certificates as Record<string, unknown>;
      const cleanedCerts: Record<string, unknown> = {};
      let certsChanged = false;

      for (const [key, value] of Object.entries(certs)) {
        if (typeof value === 'string' && value.includes('/uploads/test/')) {
          console.log(`  - qualification_certificates[${key}]: ${value} → null`);
          cleanedCerts[key] = null;
          certsChanged = true;
        } else if (value && typeof value === 'object' && 'certificate_image' in value) {
          const certImage = (value as { certificate_image?: string }).certificate_image;
          if (certImage?.includes('/uploads/test/')) {
            console.log(`  - qualification_certificates[${key}].certificate_image: ${certImage} → null`);
            cleanedCerts[key] = null;
            certsChanged = true;
          } else {
            cleanedCerts[key] = value;
          }
        } else {
          cleanedCerts[key] = value;
        }
      }

      if (certsChanged) {
        updates.qualification_certificates = cleanedCerts as Prisma.InputJsonValue;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
      console.log(`  ✅ 更新完了`);
    }
  }

  // 2. 施設のダミー画像をクリア
  const facilitiesWithDummyImages = await prisma.facility.findMany({
    where: {
      OR: [
        { images: { has: '/images/anken.png' } },
        { images: { hasSome: ['/images/facilities/facility1.jpg', '/images/facilities/facility2.jpg', '/images/facilities/facility3.jpg'] } },
      ],
    },
    select: {
      id: true,
      facility_name: true,
      images: true,
    },
  });

  console.log(`\nダミー画像を持つ施設: ${facilitiesWithDummyImages.length}件`);

  for (const facility of facilitiesWithDummyImages) {
    console.log(`\n施設 ID:${facility.id} (${facility.facility_name})`);

    // 存在しない画像パスを除去し、実在する画像のみ残す
    const cleanedImages = facility.images.filter((img: string) => {
      const isDummy = img.includes('/images/anken.png') ||
                      img.includes('/images/facilities/') ||
                      img.includes('/uploads/test/');
      if (isDummy) {
        console.log(`  - 除去: ${img}`);
      }
      return !isDummy;
    });

    // 画像が空になった場合はサンプル画像を設定
    const finalImages = cleanedImages.length > 0
      ? cleanedImages
      : ['/images/samples/facility_top_1.png'];

    await prisma.facility.update({
      where: { id: facility.id },
      data: { images: finalImages },
    });
    console.log(`  ✅ 更新完了 (${finalImages.length}枚の画像)`);
  }

  // 3. 求人のダミー画像をクリア
  const jobsWithDummyImages = await prisma.job.findMany({
    where: {
      OR: [
        { images: { has: '/images/anken.png' } },
        { images: { hasSome: ['/images/facilities/facility1.jpg', '/images/facilities/facility2.jpg', '/images/facilities/facility3.jpg'] } },
      ],
    },
    select: {
      id: true,
      title: true,
      images: true,
    },
  });

  console.log(`\nダミー画像を持つ求人: ${jobsWithDummyImages.length}件`);

  for (const job of jobsWithDummyImages) {
    console.log(`\n求人 ID:${job.id} (${job.title})`);

    const cleanedImages = job.images.filter((img: string) => {
      const isDummy = img.includes('/images/anken.png') ||
                      img.includes('/images/facilities/') ||
                      img.includes('/uploads/test/');
      if (isDummy) {
        console.log(`  - 除去: ${img}`);
      }
      return !isDummy;
    });

    const finalImages = cleanedImages.length > 0
      ? cleanedImages
      : ['/images/samples/facility_top_1.png'];

    await prisma.job.update({
      where: { id: job.id },
      data: { images: finalImages },
    });
    console.log(`  ✅ 更新完了 (${finalImages.length}枚の画像)`);
  }

  console.log('\n=== クリーンアップ完了 ===');
}

main()
  .catch((e) => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
