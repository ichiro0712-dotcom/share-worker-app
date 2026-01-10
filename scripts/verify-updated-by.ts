/**
 * updated_by フィールド検証スクリプト
 * E2Eテスト後にDBの updated_by_type, updated_by_id が正しく設定されているか検証
 *
 * 使用方法:
 *   npx tsx scripts/verify-updated-by.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationResult {
  table: string;
  total: number;
  withUpdatedBy: number;
  withoutUpdatedBy: number;
  recentRecords: {
    id: number;
    updated_by_type: string | null;
    updated_by_id: number | null;
    updated_at: Date;
  }[];
  status: 'OK' | 'WARNING' | 'ERROR';
}

async function verifyTable(
  tableName: string,
  queryFn: () => Promise<any[]>,
  idField: string = 'id'
): Promise<VerificationResult> {
  const records = await queryFn();

  const withUpdatedBy = records.filter(
    (r) => r.updated_by_type !== null && r.updated_by_id !== null
  );
  const withoutUpdatedBy = records.filter(
    (r) => r.updated_by_type === null || r.updated_by_id === null
  );

  // 最新10件を取得
  const recentRecords = records
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10)
    .map((r) => ({
      id: r[idField],
      updated_by_type: r.updated_by_type,
      updated_by_id: r.updated_by_id,
      updated_at: r.updated_at,
    }));

  // ステータス判定
  let status: 'OK' | 'WARNING' | 'ERROR' = 'OK';
  if (withoutUpdatedBy.length > 0 && withUpdatedBy.length === 0) {
    status = 'ERROR';
  } else if (withoutUpdatedBy.length > 0) {
    status = 'WARNING';
  }

  return {
    table: tableName,
    total: records.length,
    withUpdatedBy: withUpdatedBy.length,
    withoutUpdatedBy: withoutUpdatedBy.length,
    recentRecords,
    status,
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('updated_by フィールド検証レポート');
  console.log('実行日時:', new Date().toLocaleString('ja-JP'));
  console.log('='.repeat(60));
  console.log('');

  const results: VerificationResult[] = [];

  // Application テーブル
  results.push(
    await verifyTable('Application', () =>
      prisma.application.findMany({
        select: {
          id: true,
          updated_by_type: true,
          updated_by_id: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 100,
      })
    )
  );

  // Job テーブル
  results.push(
    await verifyTable('Job', () =>
      prisma.job.findMany({
        select: {
          id: true,
          updated_by_type: true,
          updated_by_id: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 100,
      })
    )
  );

  // Message テーブル
  results.push(
    await verifyTable('Message', () =>
      prisma.message.findMany({
        select: {
          id: true,
          updated_by_type: true,
          updated_by_id: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 100,
      })
    )
  );

  // User テーブル
  results.push(
    await verifyTable('User', () =>
      prisma.user.findMany({
        select: {
          id: true,
          updated_by_type: true,
          updated_by_id: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 100,
      })
    )
  );

  // JobWorkDate テーブル
  results.push(
    await verifyTable('JobWorkDate', () =>
      prisma.jobWorkDate.findMany({
        select: {
          id: true,
          updated_by_type: true,
          updated_by_id: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 100,
      })
    )
  );

  // サマリー表示
  console.log('【サマリー】');
  console.log('-'.repeat(60));
  console.log(
    'テーブル名'.padEnd(20) +
      '合計'.padStart(8) +
      '設定済'.padStart(8) +
      '未設定'.padStart(8) +
      'ステータス'.padStart(12)
  );
  console.log('-'.repeat(60));

  let hasIssues = false;
  for (const result of results) {
    const statusIcon =
      result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      result.table.padEnd(20) +
        String(result.total).padStart(8) +
        String(result.withUpdatedBy).padStart(8) +
        String(result.withoutUpdatedBy).padStart(8) +
        `${statusIcon} ${result.status}`.padStart(12)
    );
    if (result.status !== 'OK') hasIssues = true;
  }
  console.log('-'.repeat(60));
  console.log('');

  // 詳細（最新レコード）
  console.log('【最新レコード詳細】');
  for (const result of results) {
    if (result.recentRecords.length === 0) continue;

    console.log('');
    console.log(`■ ${result.table} (最新${result.recentRecords.length}件)`);
    console.log(
      'ID'.padEnd(8) +
        'updated_by_type'.padEnd(18) +
        'updated_by_id'.padEnd(15) +
        'updated_at'
    );
    for (const record of result.recentRecords.slice(0, 5)) {
      const typeStr = record.updated_by_type || '(null)';
      const idStr = record.updated_by_id !== null ? String(record.updated_by_id) : '(null)';
      const dateStr = record.updated_at.toLocaleString('ja-JP');
      console.log(
        String(record.id).padEnd(8) +
          typeStr.padEnd(18) +
          idStr.padEnd(15) +
          dateStr
      );
    }
  }

  console.log('');
  console.log('='.repeat(60));
  if (hasIssues) {
    console.log('⚠️  一部のレコードで updated_by が未設定です');
    console.log('   古いレコードは設定なしで正常です（新規追加後のもののみ対象）');
  } else {
    console.log('✅ 全てのテーブルで updated_by が正しく設定されています');
  }
  console.log('='.repeat(60));

  await prisma.$disconnect();

  // 終了コード（CI用）
  process.exit(hasIssues ? 1 : 0);
}

main().catch((e) => {
  console.error('検証エラー:', e);
  process.exit(1);
});
