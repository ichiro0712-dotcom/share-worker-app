/**
 * 本番 Supabase に schema.prisma 上の追加テーブルが反映済みかチェック
 * 実行: npx tsx scripts/check-prod-tables.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const TABLES_TO_CHECK = [
  // Advisor 10 個 (P1 完了時点)
  'advisor_chat_sessions',
  'advisor_chat_messages',
  'advisor_audit_logs',
  'advisor_knowledge_cache',
  'advisor_knowledge_sync_logs',
  'advisor_saved_prompts',
  'advisor_usage_daily',
  'advisor_report_drafts',
  'advisor_settings',
  'advisor_report_versions',
  // 派生 7 個 (本ブランチ含む過去セッションで追加)
  'recommended_jobs',
  'public_job_page_views',
  'job_search_page_views',
  'job_detail_page_views',
  'registration_page_views',
  'application_click_events',
  'form_destinations',
];

async function main() {
  const dsn = process.env.ADVISOR_DATA_DATABASE_URL;
  if (!dsn) {
    console.error('ADVISOR_DATA_DATABASE_URL not set');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    log: ['error'],
    datasources: { db: { url: dsn } },
  });

  try {
    console.log('本番 Supabase で各テーブルの存在を確認...\n');
    const result = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      TABLES_TO_CHECK
    );
    const existing = new Set(result.map((r) => r.table_name));

    let missing = 0;
    for (const t of TABLES_TO_CHECK) {
      if (existing.has(t)) {
        console.log(`  ✅ ${t}`);
      } else {
        console.log(`  ❌ ${t}  ← 本番未反映`);
        missing += 1;
      }
    }
    console.log(`\n合計: ${TABLES_TO_CHECK.length} テーブル中 ${TABLES_TO_CHECK.length - missing} が反映済み、${missing} が未反映`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`エラー: ${msg}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
