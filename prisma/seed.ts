import { PrismaClient } from '@prisma/client';
import { facilities } from '../data/facilities';
import { users } from '../data/users';
import { admins } from '../data/admins';
import { reviews } from '../data/reviews';

const prisma = new PrismaClient();

// ========================================
// 資格パターン定義
// ========================================
const qualificationPatterns = {
  nursing: ['正看護師', '准看護師'],
  careWorker: ['介護福祉士'],
  beginner: ['初任者研修', '実務者研修'],
  none: [],
};

// ========================================
// 勤務時間パターン定義
// ========================================
const workTimePatterns = {
  day: { start: '09:00', end: '18:00', breakTime: '12:00-13:00' },
  dayEarly: { start: '07:00', end: '16:00', breakTime: '12:00-13:00' },
  dayLate: { start: '10:00', end: '19:00', breakTime: '13:00-14:00' },
  night: { start: '17:00', end: '09:00', breakTime: '01:00-02:00' },
  nightLate: { start: '21:00', end: '07:00', breakTime: '03:00-04:00' },
  short: { start: '10:00', end: '14:00', breakTime: 'なし' },
  shortMorning: { start: '08:00', end: '12:00', breakTime: 'なし' },
  shortEvening: { start: '14:00', end: '18:00', breakTime: 'なし' },
};

// ========================================
// 施設種別ごとの求人タイトルテンプレート
// ========================================
const titleTemplates: Record<string, string[]> = {
  'デイサービス': [
    '【デイサービス】日勤スタッフ募集！',
    '【デイサービス】レクリエーション担当',
    '【デイサービス】送迎補助スタッフ',
    '【デイサービス】入浴介助スタッフ',
  ],
  '訪問介護': [
    '【訪問介護】ヘルパー募集',
    '【訪問介護】生活援助スタッフ',
    '【訪問介護】身体介護スタッフ',
  ],
  '特別養護老人ホーム': [
    '【特養】日勤介護スタッフ',
    '【特養】夜勤専従スタッフ',
    '【特養】ユニットケアスタッフ',
  ],
  'グループホーム': [
    '【グループホーム】介護スタッフ',
    '【グループホーム】認知症ケアスタッフ',
    '【グループホーム】生活支援スタッフ',
  ],
  '有料老人ホーム': [
    '【有料老人ホーム】介護スタッフ',
    '【有料老人ホーム】夜勤スタッフ',
    '【有料老人ホーム】フロアスタッフ',
  ],
  'デイケア': [
    '【デイケア】リハビリ補助スタッフ',
    '【デイケア】介護スタッフ',
    '【デイケア】送迎ドライバー兼介護',
  ],
  '小規模多機能型居宅介護': [
    '【小規模多機能】介護スタッフ',
    '【小規模多機能】夜勤スタッフ',
    '【小規模多機能】日勤パート',
  ],
  '訪問入浴': [
    '【訪問入浴】入浴介助スタッフ',
    '【訪問入浴】オペレーター',
    '【訪問入浴】ヘルパー',
  ],
  'サービス付き高齢者向け住宅': [
    '【サ高住】生活相談員',
    '【サ高住】介護スタッフ',
    '【サ高住】夜間スタッフ',
  ],
  '介護老人保健施設': [
    '【老健】介護スタッフ',
    '【老健】リハビリ補助',
    '【老健】夜勤専従',
  ],
  'ショートステイ（短期入所生活介護）': [
    '【ショートステイ】介護スタッフ',
    '【ショートステイ】夜勤スタッフ',
    '【ショートステイ】送迎兼介護',
  ],
  '障がい者支援施設': [
    '【障がい者支援】生活支援員',
    '【障がい者支援】日中活動支援',
    '【障がい者支援】夜勤スタッフ',
  ],
  '軽費老人ホーム': [
    '【軽費老人ホーム】生活相談員',
    '【軽費老人ホーム】介護スタッフ',
  ],
  '看護小規模多機能型居宅介護': [
    '【看護小規模多機能】看護師募集',
    '【看護小規模多機能】介護スタッフ',
    '【看護小規模多機能】夜勤看護師',
  ],
};

// デフォルトテンプレート
const defaultTitles = [
  '介護スタッフ募集',
  '日勤スタッフ募集',
  '夜勤スタッフ募集',
];

// ========================================
// 看護系施設かどうかを判定
// ========================================
function isNursingFacility(facilityType: string): boolean {
  const nursingTypes = [
    '看護小規模多機能型居宅介護',
    '訪問看護',
    '介護医療院',
    '病院',
  ];
  return nursingTypes.some(t => facilityType.includes(t));
}

// ========================================
// ヘルパー関数
// ========================================
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 今日の日付を基準にする
const today = new Date();
function formatDate(daysFromToday: number): string {
  const date = new Date(today);
  date.setDate(today.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
}

function generateDeadline(hoursFromNow: number): Date {
  return new Date(today.getTime() + hoursFromNow * 60 * 60 * 1000);
}

// ========================================
// メイン処理
// ========================================
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
        password_hash: admin.password,
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
        password_hash: user.password,
        name: user.name,
        birth_date: null,
        phone_number: user.phone || '090-0000-0000',
        profile_image: null,
        qualifications: [user.occupation],
      },
    });
  }
  console.log(`✅ Created ${users.length} users`);

  // 4. 求人データの動的生成・投入
  console.log('💼 Seeding jobs...');
  let jobCount = 0;
  const totalJobs = 50;

  for (let i = 0; i < totalJobs; i++) {
    const jobId = i + 1;
    const facility = facilities[i % facilities.length];
    const facilityType = facility.type;

    // ========================================
    // タイトル生成（施設種別に基づく）
    // ========================================
    const titles = titleTemplates[facilityType] || defaultTitles;
    const title = titles[i % titles.length];

    // ========================================
    // 資格パターン決定
    // ========================================
    let qualifications: string[];
    if (isNursingFacility(facilityType)) {
      // 看護系施設は看護資格必須
      qualifications = qualificationPatterns.nursing;
    } else if (i % 4 === 0) {
      // 25%: 資格不問
      qualifications = qualificationPatterns.none;
    } else if (i % 4 === 1) {
      // 25%: 介護福祉士
      qualifications = qualificationPatterns.careWorker;
    } else if (i % 4 === 2) {
      // 25%: 初任者研修以上
      qualifications = qualificationPatterns.beginner;
    } else {
      // 25%: 介護福祉士または初任者研修
      qualifications = [...qualificationPatterns.careWorker, ...qualificationPatterns.beginner];
    }

    // ========================================
    // 勤務時間パターン決定
    // ========================================
    let workTime: { start: string; end: string; breakTime: string };
    if (i % 5 === 0) {
      // 20%: 夜勤
      workTime = getRandomItem([workTimePatterns.night, workTimePatterns.nightLate]);
    } else if (i % 5 === 1) {
      // 20%: 短時間（4時間以下）
      workTime = getRandomItem([workTimePatterns.short, workTimePatterns.shortMorning, workTimePatterns.shortEvening]);
    } else {
      // 60%: 日勤
      workTime = getRandomItem([workTimePatterns.day, workTimePatterns.dayEarly, workTimePatterns.dayLate]);
    }

    // ========================================
    // 時給・日給計算
    // ========================================
    const hourlyWage = getRandomInt(1200, 2000);
    const startHour = parseInt(workTime.start.split(':')[0]);
    const endHour = parseInt(workTime.end.split(':')[0]);
    let workHours = endHour >= startHour
      ? endHour - startHour
      : (24 - startHour) + endHour;
    // 休憩時間を引く（1時間）
    if (workTime.breakTime !== 'なし') {
      workHours -= 1;
    }
    const wage = hourlyWage * workHours;

    // ========================================
    // 締切日時（バリエーション）
    // ========================================
    let deadline: Date;
    if (i < 10) {
      // 最初の10件: 24時間以内
      deadline = generateDeadline(getRandomInt(3, 23));
    } else if (i < 25) {
      // 次の15件: 1-7日
      deadline = generateDeadline(getRandomInt(24, 168));
    } else {
      // 残り: 7-30日
      deadline = generateDeadline(getRandomInt(168, 720));
    }

    // ========================================
    // 移動手段フラグ（ランダム）
    // ========================================
    const allowCar = Math.random() > 0.3;
    const allowBike = Math.random() > 0.2;
    const allowBicycle = Math.random() > 0.2;
    const allowPublicTransit = Math.random() > 0.1;
    const hasParking = allowCar ? Math.random() > 0.3 : false;

    // ========================================
    // こだわり条件フラグ（ランダム）
    // ========================================
    const noBathingAssist = Math.random() > 0.6;
    const hasDriver = Math.random() > 0.8;
    const hairStyleFree = Math.random() > 0.7;
    const nailOk = Math.random() > 0.85;
    const uniformProvided = Math.random() > 0.4;
    const inexperiencedOk = qualifications.length === 0 || Math.random() > 0.5;
    const beginnerOk = Math.random() > 0.4;
    const facilityWithin5years = Math.random() > 0.85;

    // ========================================
    // 仕事内容（施設種別に応じて）
    // ========================================
    const baseWorkContent = ['見守り', '記録業務', '申し送り'];
    const additionalContent = noBathingAssist
      ? ['食事介助', '排泄介助', '移乗介助', 'レクリエーション']
      : ['食事介助', '排泄介助', '入浴介助', '移乗介助', 'レクリエーション'];
    const workContent = [...baseWorkContent, ...additionalContent];

    // ========================================
    // タグ生成
    // ========================================
    const tags: string[] = [];
    // 施設種別の短縮形をタグに追加
    if (facilityType.includes('デイサービス')) tags.push('デイ');
    if (facilityType.includes('特別養護')) tags.push('特養');
    if (facilityType.includes('グループホーム')) tags.push('GH');
    if (facilityType.includes('有料老人ホーム')) tags.push('有料');
    if (facilityType.includes('訪問')) tags.push('訪問');
    if (facilityType.includes('看護')) tags.push('看護');

    // 勤務形態タグ
    if (startHour >= 17 || startHour <= 4) tags.push('夜勤');
    if (workHours <= 4) tags.push('短時間');
    if (inexperiencedOk) tags.push('未経験OK');

    try {
      await prisma.job.create({
        data: {
          id: jobId,
          facility_id: facility.id,
          template_id: null,
          status: 'PUBLISHED',
          title: title,
          work_date: new Date(formatDate(getRandomInt(1, 14))),
          start_time: workTime.start,
          end_time: workTime.end,
          break_time: workTime.breakTime,
          wage: wage,
          hourly_wage: hourlyWage,
          transportation_fee: getRandomInt(500, 2000),
          deadline: deadline,
          tags: tags,
          address: facility.address,
          access: `最寄り駅から徒歩${getRandomInt(3, 15)}分`,
          recruitment_count: getRandomInt(1, 5),
          applied_count: getRandomInt(0, 3),
          overview: `${facility.name}（${facilityType}）での介護業務です。${inexperiencedOk ? '未経験の方も歓迎します。' : '経験者優遇。'}丁寧に指導しますので安心してご応募ください。`,
          work_content: workContent,
          required_qualifications: qualifications,
          required_experience: inexperiencedOk ? ['未経験OK'] : ['実務経験1年以上'],
          dresscode: uniformProvided ? ['制服貸与'] : ['動きやすい服装'],
          belongings: ['筆記用具', '上履き'],
          manager_name: getRandomItem(['田中', '佐藤', '鈴木', '高橋', '伊藤']) + ' ' + getRandomItem(['太郎', '花子', '一郎', '美咲']),
          manager_message: `${facility.name}で一緒に働きませんか？お待ちしています！`,
          manager_avatar: getRandomItem(['👨', '👩', '🧑']),
          images: ['/images/anken.png', '/images/anken.png', '/images/anken.png'],
          // 移動手段
          allow_car: allowCar,
          allow_bike: allowBike,
          allow_bicycle: allowBicycle,
          allow_public_transit: allowPublicTransit,
          has_parking: hasParking,
          // こだわり条件
          no_bathing_assist: noBathingAssist,
          has_driver: hasDriver,
          hair_style_free: hairStyleFree,
          nail_ok: nailOk,
          uniform_provided: uniformProvided,
          inexperienced_ok: inexperiencedOk,
          beginner_ok: beginnerOk,
          facility_within_5years: facilityWithin5years,
        },
      });
      jobCount++;
    } catch (error) {
      console.error(`❌ Failed to create job ${jobId}:`, error);
    }
  }
  console.log(`✅ Created ${jobCount} jobs`);

  // 5. アプリケーション（応募）データの投入
  console.log('📋 Seeding applications...');
  const applicationCount = reviews.length;
  for (let i = 0; i < applicationCount; i++) {
    await prisma.application.create({
      data: {
        id: i + 1,
        job_id: (i % totalJobs) + 1,
        user_id: (i % 3) + 1,
        status: 'COMPLETED_RATED',
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
      await prisma.review.create({
        data: {
          id: review.id,
          facility_id: review.facilityId,
          user_id: 1,
          job_id: 1,
          application_id: review.id,
          reviewer_type: 'WORKER',
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
