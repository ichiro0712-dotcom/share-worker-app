import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📝 テンプレートを追加中...');

  // 施設IDを取得（最初の5施設）
  const facilities = await prisma.facility.findMany({
    take: 5,
    orderBy: { id: 'asc' },
  });

  if (facilities.length < 5) {
    console.error('❌ 施設が5件以上必要です');
    return;
  }

  const templateData = [
    {
      facility_id: facilities[0].id,
      name: '日勤スタッフ（デイサービス）',
      title: '【デイサービス】日勤スタッフ募集',
      start_time: '09:00',
      end_time: '18:00',
      break_time: 60,
      hourly_wage: 1500,
      transportation_fee: 1000,
      recruitment_count: 2,
      qualifications: ['介護福祉士', '初任者研修'],
      description: 'デイサービスでの日勤業務です。入浴介助、食事介助、レクリエーションなどを担当していただきます。明るく元気に利用者様と接していただける方を募集しています。',
      skills: ['介護経験1年以上', 'コミュニケーション能力'],
      dresscode: ['動きやすい服装', '運動靴'],
      belongings: ['筆記用具', '上履き'],
      images: ['/images/anken.png'],
      notes: '初めての方も丁寧に指導します',
      tags: ['入浴介助なし', '制服貸与', 'SWORK初心者歓迎', '車'],
    },
    {
      facility_id: facilities[1].id,
      name: '訪問看護スタッフ（日勤）',
      title: '【訪問看護】日勤スタッフ募集',
      start_time: '08:30',
      end_time: '17:30',
      break_time: 60,
      hourly_wage: 2000,
      transportation_fee: 1200,
      recruitment_count: 2,
      qualifications: ['正看護師', '准看護師'],
      description: '訪問看護ステーションでのお仕事です。利用者様のご自宅を訪問し、医療的ケアや健康管理を行います。在宅医療に興味のある方、ブランクのある方も歓迎します。',
      skills: ['訪問看護経験者歓迎', '普通自動車免許'],
      dresscode: ['清潔感のある服装', 'スニーカー'],
      belongings: ['筆記用具', '運転免許証', 'マスク'],
      images: ['/images/anken.png'],
      notes: '訪問用の車両は施設で用意します',
      tags: ['送迎ドライバーあり', '髪型・髪色自由', '介護業務未経験歓迎', '車', '公共交通機関'],
    },
    {
      facility_id: facilities[3].id,
      name: 'グループホーム日勤',
      title: '【グループホーム】日勤介護スタッフ募集',
      start_time: '07:00',
      end_time: '16:00',
      break_time: 60,
      hourly_wage: 1400,
      transportation_fee: 800,
      recruitment_count: 3,
      qualifications: ['初任者研修', '実務者研修', '介護福祉士'],
      description: 'アットホームな雰囲気のグループホームです。認知症の方のケアに興味がある方、少人数でじっくり関わりたい方にぴったりのお仕事です。調理補助や生活支援がメインとなります。',
      skills: ['認知症ケア経験者歓迎', '調理補助可能な方'],
      dresscode: ['動きやすい服装', 'エプロン'],
      belongings: ['筆記用具', '上履き', 'エプロン'],
      images: ['/images/anken.png'],
      notes: 'まかない付き。未経験者でも研修制度が充実しています',
      tags: ['入浴介助なし', '制服貸与', 'ネイルOK', 'SWORK初心者歓迎', '自転車', '公共交通機関'],
    },
  ];

  // 既存のテンプレートを削除せず、追加
  for (const template of templateData) {
    // 同名のテンプレートがあるかチェック
    const existing = await prisma.jobTemplate.findFirst({
      where: {
        facility_id: template.facility_id,
        name: template.name,
      },
    });

    if (!existing) {
      await prisma.jobTemplate.create({ data: template });
      console.log(`✅ テンプレート「${template.name}」を作成しました`);
    } else {
      // 既存のテンプレートを更新
      await prisma.jobTemplate.update({
        where: { id: existing.id },
        data: template,
      });
      console.log(`🔄 テンプレート「${template.name}」を更新しました`);
    }
  }

  console.log('\n✅ テンプレートの追加が完了しました！');
}

main()
  .catch((e) => {
    console.error('❌ エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
