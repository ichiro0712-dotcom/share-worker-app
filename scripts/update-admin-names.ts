import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 固定の管理者名リスト（施設ごとに1名）
const adminNames = [
  '木村 一郎',     // admin1 - ひかり介護センター
  '山田 健太',     // admin2 - あおぞら訪問看護ステーション
  '佐藤 大輔',     // admin3 - さくらの里特別養護老人ホーム
  '田中 直樹',     // admin4 - グループホームみどりの家
  '高橋 翔太',     // admin5 - ゆうわ老人保健施設
  '伊藤 和也',     // admin6 - けやきデイサービス
  '渡辺 雄介',     // admin7 - つばさ小規模多機能ホーム
  '中村 俊介',     // admin8 - はなみずき有料老人ホーム
  '小林 拓也',     // admin9 - あすなろサービス付き高齢者向け住宅
  '加藤 太郎',     // admin10 - わかばショートステイ
  '吉田 健太',     // admin11 - こすもす訪問介護ステーション
  '松本 一郎',     // admin12 - すみれデイケアセンター
  '井上 大輔',     // admin13 - たんぽぽ病院併設老健
  '山本 直樹',     // admin14 - ひまわりグループホーム
  '鈴木 翔太',     // admin15 - オリーブ有料老人ホーム
];

async function updateAdminNames() {
  console.log('施設管理者の名前を更新します...');

  for (let i = 0; i < adminNames.length; i++) {
    const email = `admin${i + 1}@facility.com`;
    const name = adminNames[i];

    const admin = await prisma.facilityAdmin.findUnique({
      where: { email },
      include: { facility: true },
    });

    if (admin) {
      await prisma.facilityAdmin.update({
        where: { email },
        data: { name },
      });
      console.log(`${email}: ${admin.name} → ${name} (${admin.facility?.facility_name})`);
    } else {
      console.log(`${email}: 見つかりません`);
    }
  }

  console.log('\n完了!');
}

updateAdminNames()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
