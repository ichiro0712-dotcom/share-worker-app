import { PrismaClient } from '@prisma/client';
import { facilities } from '../data/facilities';
import { jobs } from '../data/jobs';
import { users } from '../data/users';
import { admins } from '../data/admins';
import { reviews } from '../data/reviews';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. 施設データの投入
  console.log('📍 Seeding facilities...');
  for (const facility of facilities) {
    await prisma.facility.create({
      data: {
        id: facility.id,
        corporation_name: facility.corporationName,
        facility_name: facility.name,
        facility_type: facility.type,
        address: facility.address,
        lat: facility.lat,
        lng: facility.lng,
        phone_number: facility.phoneNumber,
        description: `${facility.name}は${facility.type}です。`,
        images: [facility.image],
        rating: facility.rating,
        review_count: facility.reviewCount,
      },
    });
  }
  console.log(`✅ Created ${facilities.length} facilities`);

  // 2. 施設管理者データの投入
  console.log('👥 Seeding facility admins...');
  for (const admin of admins) {
    await prisma.facilityAdmin.create({
      data: {
        id: admin.id,
        email: admin.email,
        password_hash: admin.password, // 本番環境ではハッシュ化が必要
        facility_id: admin.facilityId,
        name: admin.name,
        phone_number: admin.phone || null,
        role: admin.role,
      },
    });
  }
  console.log(`✅ Created ${admins.length} facility admins`);

  // 3. ユーザー（ワーカー）データの投入
  console.log('👤 Seeding users...');
  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password_hash: user.password, // 本番環境ではハッシュ化が必要
        name: user.name,
        birth_date: null, // モックデータにないフィールド
        phone_number: user.phone || '090-0000-0000',
        profile_image: null,
        qualifications: [user.occupation], // 職種を資格として登録
      },
    });
  }
  console.log(`✅ Created ${users.length} users`);

  // 4. 求人データの投入
  console.log('💼 Seeding jobs...');
  let jobCount = 0;
  for (const job of jobs) {
    try {
      await prisma.job.create({
        data: {
          id: job.id,
          facility_id: job.facilityId,
          template_id: job.templateId || null,
          status: job.status.toUpperCase() as any, // JobStatus enum (lowercase → UPPERCASE)
          title: job.title,
          work_date: new Date(job.workDate),
          start_time: job.startTime,
          end_time: job.endTime,
          break_time: job.breakTime,
          wage: job.wage,
          hourly_wage: job.hourlyWage,
          transportation_fee: job.transportationFee,
          deadline: new Date(job.deadline),
          tags: job.tags,
          address: job.address,
          access: job.accessDescription || 'アクセス情報なし',
          recruitment_count: job.recruitmentCount,
          applied_count: job.appliedCount || 0,
          overview: job.overview,
          work_content: job.workContent,
          required_qualifications: job.qualifications,
          required_experience: job.experience || [],
          dresscode: job.dresscode || [],
          belongings: job.belongings || [],
          manager_name: job.managerName,
          manager_message: job.managerMessage || null,
          manager_avatar: job.managerAvatar,
          images: job.images,
        },
      });
      jobCount++;
    } catch (error) {
      console.error(`❌ Failed to create job ${job.id}:`, error);
    }
  }
  console.log(`✅ Created ${jobCount} jobs`);

  // 5. アプリケーション（応募）データの投入（レビュー作成のため）
  console.log('📋 Seeding applications...');
  const applicationCount = reviews.length;
  for (let i = 0; i < applicationCount; i++) {
    await prisma.application.create({
      data: {
        id: i + 1,
        job_id: (i % 50) + 1, // 求人ID 1-50 をローテーション
        user_id: (i % 3) + 1, // ユーザーID 1-3 をローテーション
        status: 'COMPLETED_RATED', // 評価済み
        worker_review_status: 'COMPLETED',
        facility_review_status: 'COMPLETED',
      },
    });
  }
  console.log(`✅ Created ${applicationCount} applications`);

  // 6. レビューデータの投入
  console.log('⭐ Seeding reviews...');
  let reviewCount = 0;
  for (const review of reviews) {
    try {
      // レビューはワーカーから施設への評価として投入
      await prisma.review.create({
        data: {
          id: review.id,
          facility_id: review.facilityId,
          user_id: 1, // 仮のユーザーID（users[0]）
          job_id: 1,  // 仮の求人ID
          application_id: review.id, // アプリケーションIDと一致させる
          reviewer_type: 'WORKER', // ワーカーが施設を評価
          rating: review.rating,
          good_points: review.goodPoints,
          improvements: review.improvements,
          created_at: new Date(review.createdAt),
        },
      });
      reviewCount++;
    } catch (error) {
      console.error(`❌ Failed to create review ${review.id}:`, error);
    }
  }
  console.log(`✅ Created ${reviewCount} reviews`);

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
