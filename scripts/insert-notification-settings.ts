
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting notification settings...');

    // WORKER_NEARBY_NEW_JOB
    await prisma.$executeRaw`
    INSERT INTO notification_settings (
      notification_key, name, description, target_type,
      chat_enabled, email_enabled, push_enabled, dashboard_enabled,
      chat_message, push_title, push_body,
      alert_thresholds, created_at, updated_at
    ) VALUES (
      'WORKER_NEARBY_NEW_JOB',
      '近くの新規求人',
      '登録住所付近で新しい求人が公開されたときに通知',
      'WORKER',
      true, true, true, false,
      '【新着求人】{{facility_name}}で新しい求人が公開されました。{{job_title}} - {{work_date}}',
      '近くで新着求人',
      '{{facility_name}}で新しい求人があります',
      '{"distance_km": 10, "max_notifications_per_day": 5, "note": "※現在国土地理院APIを利用しています。精度向上には有料のGoogle Geocoding APIが必要です"}',
      NOW(), NOW()
    ) ON CONFLICT (notification_key) DO NOTHING;
  `;

    // WORKER_NEARBY_CANCEL_AVAILABLE
    await prisma.$executeRaw`
    INSERT INTO notification_settings (
      notification_key, name, description, target_type,
      chat_enabled, email_enabled, push_enabled, dashboard_enabled,
      chat_message, push_title, push_body,
      alert_thresholds, created_at, updated_at
    ) VALUES (
      'WORKER_NEARBY_CANCEL_AVAILABLE',
      '近くのキャンセル発生',
      '登録住所付近の求人でキャンセルが発生し、枠が空いたときに通知',
      'WORKER',
      true, true, true, false,
      '【空き発生】{{facility_name}}の求人でキャンセルが発生しました。{{job_title}} - {{work_date}}',
      '近くで空きが発生',
      '{{facility_name}}の求人に空きが出ました',
      '{"distance_km": 10, "max_notifications_per_day": 5, "note": "※現在国土地理院APIを利用しています。精度向上には有料のGoogle Geocoding APIが必要です"}',
      NOW(), NOW()
    ) ON CONFLICT (notification_key) DO NOTHING;
  `;

    console.log('Notification settings inserted successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
