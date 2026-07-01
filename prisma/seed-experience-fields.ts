/**
 * 経験分野マスタ専用シード（スタンドアロン）
 *
 * 用途:
 *   - 経験分野マスタ（experience_field_categories / experience_fields）だけを
 *     正しいUTF-8で投入し直すためのスクリプト。
 *   - SQLエディタ経由での投入で文字化け（二重エンコード）が起きた場合の復旧に使用。
 *
 * 実行:
 *   npx tsx prisma/seed-experience-fields.ts
 *
 * 接続先:
 *   .env の DATABASE_URL（= 実行者の環境の対象DB）。ステージング/本番で実行する場合は
 *   接続先を必ず確認すること。full seed（prisma/seed.ts）ではなく、この2テーブルのみ触る。
 *
 * 挙動:
 *   既存の経験分野マスタを全削除してから投入し直す（＝冪等）。
 *   ワーカーの登録データ（Profile.experience_fields）は施設名の「文字列」で別保持されており、
 *   このテーブルへのFKは存在しないため、削除・再作成しても既存ワーカーの登録内容には影響しない。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const experienceFieldMaster: { category: string; fields: string[] }[] = [
  {
    category: '介護施設',
    fields: [
      '特別養護老人ホーム',
      '介護老人保健施設',
      'グループホーム',
      'デイサービス',
      '訪問介護',
      '有料老人ホーム',
      'サービス付き高齢者向け住宅',
    ],
  },
  {
    category: '病院',
    fields: [
      '病院（急性期）',
      '病院（回復期）',
      '病院（地域包括ケア）',
      '病院（療養）',
      '病院（精神）',
      '病院（外来）',
      '病院（ICU・HCU）',
      '病院（オペ室）',
      '病院（その他）',
    ],
  },
  {
    category: 'クリニック',
    fields: [
      'クリニック（無床）',
      'クリニック（有床）',
    ],
  },
  {
    category: 'その他',
    fields: [
      '施設内健診',
      '保育園',
      'その他',
    ],
  },
];

async function main() {
  console.log('🏥 経験分野マスタを投入し直します（既存を全削除 → 再作成）...');

  // 既存を全削除（FK: fields → categories は Cascade。念のため fields から削除）
  const deletedFields = await prisma.experienceField.deleteMany({});
  const deletedCats = await prisma.experienceFieldCategory.deleteMany({});
  console.log(`  🧹 既存削除: カテゴリ ${deletedCats.count}件 / 項目 ${deletedFields.count}件`);

  let catCount = 0;
  let fieldCount = 0;

  for (let ci = 0; ci < experienceFieldMaster.length; ci++) {
    const { category, fields } = experienceFieldMaster[ci];
    const categoryRecord = await prisma.experienceFieldCategory.create({
      data: {
        name: category,
        sort_order: ci,
        is_published: true,
        updated_by_type: 'SYSTEM_ADMIN',
      },
    });
    catCount++;

    for (let fi = 0; fi < fields.length; fi++) {
      await prisma.experienceField.create({
        data: {
          category_id: categoryRecord.id,
          name: fields[fi],
          sort_order: fi,
          is_published: true,
          updated_by_type: 'SYSTEM_ADMIN',
        },
      });
      fieldCount++;
    }
  }

  console.log(`✅ 投入完了: カテゴリ ${catCount}件 / 項目 ${fieldCount}件`);

  // 検証出力（文字化けしていないか目視確認用）
  console.log('\n--- 投入結果 ---');
  const cats = await prisma.experienceFieldCategory.findMany({
    include: { fields: { orderBy: { sort_order: 'asc' } } },
    orderBy: { sort_order: 'asc' },
  });
  for (const c of cats) {
    console.log(`[${c.sort_order}] ${c.name}（${c.fields.length}項目）: ${c.fields.map((f) => f.name).join(' / ')}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ 経験分野マスタの投入に失敗しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
