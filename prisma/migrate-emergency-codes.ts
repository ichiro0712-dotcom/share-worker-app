/**
 * 既存施設に緊急時出退勤番号とQRトークンを付与するマイグレーションスクリプト
 *
 * 実行方法:
 *   npx tsx prisma/migrate-emergency-codes.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * 全施設でユニークな4桁の緊急時出退勤番号を生成（ローカル使用済みセット対応版）
 */
async function generateUniqueEmergencyCodeLocal(usedCodes: Set<string>): Promise<string> {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 0000〜9999のランダムな4桁番号を生成
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    // 既に使用されていないか確認
    if (!usedCodes.has(code)) {
      // DB内で使用されていないか確認
      const existing = await prisma.facility.findFirst({
        where: { emergency_attendance_code: code },
      });

      if (!existing) {
        usedCodes.add(code);
        return code;
      }
    }
  }

  throw new Error('ユニークな緊急時出退勤番号を生成できませんでした');
}

/**
 * 新しいQRコードシークレットトークンを生成
 */
function generateQRSecretTokenLocal(): string {
  return randomBytes(32).toString('hex');
}

async function main() {
  console.log('=== 既存施設への緊急時出退勤番号付与を開始 ===\n');

  // 緊急時出退勤番号が未設定の施設を取得
  const facilitiesWithoutCode = await prisma.facility.findMany({
    where: {
      emergency_attendance_code: null,
    },
    select: {
      id: true,
      facility_name: true,
    },
  });

  console.log(`対象施設数: ${facilitiesWithoutCode.length}件\n`);

  if (facilitiesWithoutCode.length === 0) {
    console.log('全ての施設に緊急時出退勤番号が設定済みです。');
    return;
  }

  // 既に使用されている番号を取得
  const existingCodes = await prisma.facility.findMany({
    where: {
      emergency_attendance_code: { not: null },
    },
    select: {
      emergency_attendance_code: true,
    },
  });

  const usedCodes = new Set<string>(
    existingCodes
      .map((f) => f.emergency_attendance_code)
      .filter((code): code is string => code !== null)
  );

  console.log(`既存番号数: ${usedCodes.size}件\n`);

  // 各施設に番号を付与
  let successCount = 0;
  let errorCount = 0;

  for (const facility of facilitiesWithoutCode) {
    try {
      const emergencyCode = await generateUniqueEmergencyCodeLocal(usedCodes);
      const qrSecretToken = generateQRSecretTokenLocal();

      await prisma.facility.update({
        where: { id: facility.id },
        data: {
          emergency_attendance_code: emergencyCode,
          qr_secret_token: qrSecretToken,
          qr_generated_at: new Date(),
        },
      });

      console.log(`✓ 施設ID: ${facility.id}, 名前: ${facility.facility_name}, 番号: ${emergencyCode}`);
      successCount++;
    } catch (error) {
      console.error(`✗ 施設ID: ${facility.id} の処理でエラー:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== 処理完了 ===`);
  console.log(`成功: ${successCount}件`);
  console.log(`失敗: ${errorCount}件`);
}

main()
  .catch((e) => {
    console.error('マイグレーションエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
