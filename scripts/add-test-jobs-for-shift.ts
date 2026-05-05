/**
 * シフトビューのテスト用求人データを追加するスクリプト
 *
 * 実行方法:
 * npx tsx scripts/add-test-jobs-for-shift.ts
 */

import { PrismaClient, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

// 今日の日付を基準
const today = new Date();
today.setHours(0, 0, 0, 0);

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ランダム選択ヘルパー
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🚀 シフトビューテスト用の求人データを追加します...');

  // 施設を取得
  const facility = await prisma.facility.findFirst({
    orderBy: { id: 'asc' },
  });

  if (!facility) {
    console.error('❌ 施設が見つかりません。先にseedを実行してください。');
    process.exit(1);
  }

  console.log(`📍 施設: ${facility.facility_name} (ID: ${facility.id})`);

  // 求人のバリエーション
  const jobTitles = [
    '介護スタッフ（日勤）',
    '夜勤専従スタッフ',
    '送迎ドライバー',
    '調理補助',
    '清掃スタッフ',
    '看護助手',
    'リハビリ補助',
    '配膳スタッフ',
    'レクリエーション補助',
    '入浴介助スタッフ',
  ];

  const workContents = [
    ['入浴介助', '食事介助', '排泄介助'],
    ['レクリエーション', '見守り', '生活支援'],
    ['送迎', '車両管理'],
    ['調理', '配膳', '片付け'],
    ['清掃', '環境整備'],
    ['看護師補助', 'バイタル測定補助'],
  ];

  const qualifications = [
    ['介護福祉士'],
    ['初任者研修'],
    ['実務者研修'],
    ['ドライバー(運転免許証)'],
    ['無資格可'],
    ['看護師'],
    ['准看護師'],
  ];

  const timePatterns = [
    { start: '06:00', end: '15:00' },
    { start: '07:00', end: '16:00' },
    { start: '08:00', end: '17:00' },
    { start: '09:00', end: '18:00' },
    { start: '10:00', end: '19:00' },
    { start: '14:00', end: '22:00' },
    { start: '16:00', end: '翌01:00' },
    { start: '17:00', end: '翌02:00' },
    { start: '22:00', end: '翌07:00' },
  ];

  const createdJobs: any[] = [];
  const createdWorkDates: any[] = [];

  // 今日から30日間にわたって求人を作成
  for (let dayOffset = -3; dayOffset <= 30; dayOffset++) {
    const targetDate = addDays(today, dayOffset);
    const dayOfWeek = targetDate.getDay();

    // 土日は多め（2-4件）、平日は少なめ（0-2件）
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const jobCount = isWeekend ? getRandomInt(2, 4) : getRandomInt(0, 2);

    for (let i = 0; i < jobCount; i++) {
      const title = getRandomItem(jobTitles);
      const time = getRandomItem(timePatterns);
      const quals = getRandomItem(qualifications);
      const content = getRandomItem(workContents);
      const recruitmentCount = getRandomInt(1, 4);
      const hourlyWage = getRandomInt(1100, 1600);

      // 過去の日付は完了、それ以外は公開中
      const status = dayOffset < 0 ? JobStatus.COMPLETED : JobStatus.PUBLISHED;

      // 求人を作成
      const job = await prisma.job.create({
        data: {
          facility_id: facility.id,
          title: `【${facility.facility_type}】${title}`,
          status,
          start_time: time.start,
          end_time: time.end,
          break_time: '60',
          wage: hourlyWage * 8,
          hourly_wage: hourlyWage,
          transportation_fee: getRandomInt(0, 1) * 500,
          work_content: content,
          required_qualifications: quals,
          required_experience: [],
          dresscode: [],
          dresscode_images: [],
          belongings: [],
          attachments: [],
          tags: [],
          images: [],
          requires_interview: getRandomInt(0, 1) === 1,
          overview: `${facility.facility_name}での${title}のお仕事です。`,
          address: facility.address,
          access: '最寄り駅から徒歩5分',
          recruitment_count: recruitmentCount,
          manager_name: '担当者',
        },
      });

      createdJobs.push(job);

      // 勤務日を作成
      const deadline = new Date(targetDate);
      deadline.setDate(deadline.getDate() - 1);
      const workDate = await prisma.jobWorkDate.create({
        data: {
          job_id: job.id,
          work_date: targetDate,
          deadline: deadline,
          recruitment_count: recruitmentCount,
          applied_count: 0,
          matched_count: 0,
        },
      });

      createdWorkDates.push(workDate);
    }
  }

  console.log(`\n✅ 完了!`);
  console.log(`   - 作成した求人: ${createdJobs.length}件`);
  console.log(`   - 作成した勤務日: ${createdWorkDates.length}件`);
  console.log(`\n📅 期間: ${addDays(today, -3).toLocaleDateString('ja-JP')} 〜 ${addDays(today, 30).toLocaleDateString('ja-JP')}`);
  console.log(`\n🔍 確認方法:`);
  console.log(`   1. npm run dev でサーバー起動`);
  console.log(`   2. http://localhost:3000/admin/applications にアクセス`);
  console.log(`   3. 「シフトから」タブをクリック`);
}

main()
  .catch((e) => {
    console.error('❌ エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
