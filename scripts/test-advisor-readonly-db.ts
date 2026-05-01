/**
 * Advisor 本番Supabase 読み取り専用接続テスト
 * 実行: npx tsx scripts/test-advisor-readonly-db.ts
 *
 * 確認事項:
 *   1. ADVISOR_DATA_DATABASE_URL でログインできるか
 *   2. SET TRANSACTION READ ONLY が効くか
 *   3. SELECT が成功するか
 *   4. 万一 INSERT を試みたら Postgres レベルで弾かれるか (二重防御)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

async function main() {
  const dsn = process.env.ADVISOR_DATA_DATABASE_URL;
  if (!dsn) {
    console.error('ADVISOR_DATA_DATABASE_URL is not set');
    process.exit(1);
  }
  const url = new URL(dsn);
  console.log(`Connecting to: ${url.host}/${url.pathname.slice(1)} as ${url.username}`);

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: dsn } },
  });

  try {
    // 1. 接続 & 簡単な SELECT
    console.log('\n[1/4] 接続確認 + 軽い SELECT...');
    const ping = await prisma.$queryRawUnsafe<Array<{ version: string }>>('SELECT version() as version');
    console.log(`  ✅ 接続成功. Postgres: ${ping[0]?.version?.slice(0, 60)}...`);

    // 2. 既存テーブル数の確認
    console.log('\n[2/4] public スキーマのテーブル数を確認...');
    const tables = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint as count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log(`  ✅ public スキーマ: ${tables[0]?.count} テーブル`);

    // 3. READ ONLY transaction の挙動確認
    console.log('\n[3/4] SET TRANSACTION READ ONLY ラップ内での SELECT...');
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const userCount = await tx.user.count();
      const jobCount = await tx.job.count();
      return { userCount, jobCount };
    });
    console.log(`  ✅ User 件数: ${result.userCount}`);
    console.log(`  ✅ Job 件数: ${result.jobCount}`);

    // 4. 二重防御の確認: READ ONLY 内で UPDATE が弾かれるか
    // (実在テーブルに対して where=不可能条件 で UPDATE すれば、行は触らないが書き込み試行扱い)
    console.log('\n[4/4] READ ONLY ラップ内で UPDATE が拒否されるかテスト...');
    let writeBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        // 実在テーブル User を where 0=1 で UPDATE (1 行も該当しないが書き込み権限が必要)
        await tx.$executeRawUnsafe(`UPDATE users SET email = email WHERE 1 = 0`);
      });
      console.error('  ❌ 危険: UPDATE が通ってしまった!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('read-only transaction') ||
        msg.includes('permission denied') ||
        msg.includes('cannot execute UPDATE')
      ) {
        console.log(`  ✅ 拒否確認: ${msg.split('\n').find((l) => l.includes('Message:')) ?? msg.slice(0, 150)}`);
        writeBlocked = true;
      } else {
        console.log(`  ⚠️  別の理由で失敗: ${msg.slice(0, 200)}`);
      }
    }

    if (!writeBlocked) {
      console.error('\n❌ 二重防御の確認に失敗しました。コード/権限を再確認してください。');
      process.exit(1);
    }

    console.log('\n✅ 全テスト PASSED. 本番Supabase 読み取り専用接続が正しく動作しています。');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n❌ エラー: ${msg}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
