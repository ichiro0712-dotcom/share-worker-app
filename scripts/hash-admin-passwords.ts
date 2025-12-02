import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashAdminPasswords() {
  console.log('施設管理者のパスワードをハッシュ化します...');

  const admins = await prisma.facilityAdmin.findMany();
  let updated = 0;

  for (const admin of admins) {
    // すでにハッシュ化されているか確認（bcryptハッシュは$2a$または$2b$で始まる）
    if (admin.password_hash.startsWith('$2a$') || admin.password_hash.startsWith('$2b$')) {
      console.log(`${admin.email}: すでにハッシュ化済み`);
      continue;
    }

    // 平文パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(admin.password_hash, 10);

    await prisma.facilityAdmin.update({
      where: { id: admin.id },
      data: { password_hash: hashedPassword },
    });

    console.log(`${admin.email}: パスワードをハッシュ化しました`);
    updated++;
  }

  console.log(`\n完了: ${updated}件のパスワードをハッシュ化しました`);
}

hashAdminPasswords()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
