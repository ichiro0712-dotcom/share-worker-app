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

const prisma = new PrismaClient();

const setting = {
  notification_key: 'WORKER_REGISTRATION_COMPLETE',
  name: '会員登録完了（メール認証）',
  description:
    '新規登録のSMS認証完了後に送る会員登録完了メール。認証リンク＋ログイン導線を含む（メールアドレス確認メールを兼ねる）',
  target_type: 'WORKER',
  chat_enabled: false,
  email_enabled: true,
  push_enabled: false,
  chat_message: null,
  email_subject: '【+タスタス】会員登録が完了しました',
  email_body: `{{worker_name}} 様

タスタスへのご登録ありがとうございます。
会員登録が完了しました。

下記のURLからログインし、求人をご確認ください。
{{verification_url}}

※上記リンクからアクセスすると、メールアドレスの確認も同時に完了します（有効期限：24時間）。
※有効期限が過ぎた場合は、こちらのログインページからいつでもログインいただけます。
{{login_url}}

今後ともタスタスをよろしくお願いいたします。

※本メールは送信専用です。
※ご不明点等ございましたら、タスタス運営事務局（sharework@careergift.co.jp）までご連絡ください。`,
  push_title: null,
  push_body: null,
};

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
