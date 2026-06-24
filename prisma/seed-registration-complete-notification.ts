/**
 * 会員登録完了メール（WORKER_REGISTRATION_COMPLETE）の通知テンプレートを
 * 本番／ステージングDBへ冪等に投入するスクリプト。
 *
 * 背景：NotificationSetting は seed.ts / コード変更だけでは既存DBに反映されないため
 *       （通知テンプレートのDB同期ギャップ）、デプロイ時に本スクリプトで upsert する。
 *
 * 実行（⚠️ ユーザーが対象環境の .env を読み込んだ上で直接実行）:
 *   npx tsx prisma/seed-registration-complete-notification.ts
 *
 * - スキーマ変更なし（マイグレーション不要）
 * - 何度実行しても同じ結果（upsert）
 * - 既に存在する場合は文面を最新の初期値で更新する
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_REGISTRATION_NOTIFICATION_SETTING } from '../src/lib/auth/registration-email-content';

const prisma = new PrismaClient();

// 文面の真実源は src/lib/auth/registration-email-content.ts（コード送信側と完全一致）
const setting = DEFAULT_REGISTRATION_NOTIFICATION_SETTING;

async function main() {
  const result = await prisma.notificationSetting.upsert({
    where: { notification_key: setting.notification_key },
    update: setting,
    create: setting,
  });
  console.log(`✅ upserted NotificationSetting: ${result.notification_key} (id=${result.id})`);
}

main()
  .catch((e) => {
    console.error('❌ failed to upsert notification setting:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
