import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Updating test user passwords...');

  // テストユーザーのパスワードをハッシュ化
  const hashedPassword = await bcrypt.hash('password123', 12);

  // 全テストユーザーのパスワードを更新
  const result = await prisma.user.updateMany({
    where: {
      email: {
        in: ['test1@example.com', 'test2@example.com', 'test3@example.com']
      }
    },
    data: {
      password_hash: hashedPassword
    }
  });

  console.log(`✅ Updated ${result.count} users with hashed passwords`);

  // テスト用に別のユーザーも追加（ログインページのテストユーザー）
  const testUsers = [
    { email: 'yamada.taro@example.com', name: '山田 太郎', phone: '090-1111-2222' },
    { email: 'suzuki.hanako@example.com', name: '鈴木 花子', phone: '090-3333-4444' },
    { email: 'tanaka.jiro@example.com', name: '田中 次郎', phone: '090-5555-6666' },
  ];

  for (const user of testUsers) {
    try {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          password_hash: hashedPassword,
        },
        create: {
          email: user.email,
          password_hash: hashedPassword,
          name: user.name,
          phone_number: user.phone,
          qualifications: ['介護福祉士'],
        },
      });
      console.log(`✅ Created/updated user: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to create/update user ${user.email}:`, error);
    }
  }

  console.log('🎉 Password update completed!');
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
