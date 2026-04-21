/**
 * TasLink 一括同期スクリプト
 *
 * 既存ワーカーの本番データを TasLink に一括取り込みするためのツール。
 * 通常フロー（登録/プロフィール更新）と同じ mapUserToTasLinkPayload +
 * syncWorkerToTasLink を再利用するため、挙動は個別同期と完全一致する。
 *
 * 使い方:
 *   # 対象件数の確認のみ（APIは叩かない）
 *   npx tsx scripts/taslink-bulk-sync.ts --dry-run
 *
 *   # 少数件でリハーサル（例: 5件）
 *   npx tsx scripts/taslink-bulk-sync.ts --execute --limit=5
 *
 *   # 全件実行
 *   npx tsx scripts/taslink-bulk-sync.ts --execute
 *
 *   # 未同期ユーザーのみ（taslink_id が NULL）を対象にする
 *   npx tsx scripts/taslink-bulk-sync.ts --execute --only-unsynced
 *
 *   # 送信間隔を変更（デフォルト 200ms）
 *   npx tsx scripts/taslink-bulk-sync.ts --execute --interval=500
 *
 * 環境変数:
 *   DATABASE_URL      - 対象DBの接続文字列（.env.local から読み込む）
 *   TASLINK_API_URL   - TasLink APIのベースURL
 *   TASLINK_API_KEY   - TasLink APIのAPIキー
 *
 * 出力:
 *   scripts/taslink-bulk-sync-<timestamp>.csv に結果を保存
 *   （user_id, email, name, status, taslink_id, error）
 *
 * ⚠️ 本番DBを対象にする場合は、本プロジェクトのルールに従い
 *    ユーザー自身がローカルから実行すること（Claude Code は実行しない）
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// .env.local を自動読み込み（既存の環境変数も上書き）
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath, override: true });

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL が設定されていません (読み込み元: ${envPath})`);
}

if (!process.env.TASLINK_API_URL || !process.env.TASLINK_API_KEY) {
  throw new Error(
    'TASLINK_API_URL または TASLINK_API_KEY が設定されていません。\n' +
    '.env.local または環境変数を確認してください。'
  );
}

// ===== 引数パース =====

function parseArg(flag: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`));
  return arg ? arg.split('=')[1] : undefined;
}

const isDryRun = process.argv.includes('--dry-run');
const isExecute = process.argv.includes('--execute');
const onlyUnsynced = process.argv.includes('--only-unsynced');
const limit = parseArg('--limit') ? parseInt(parseArg('--limit')!, 10) : undefined;
const intervalMs = parseArg('--interval') ? parseInt(parseArg('--interval')!, 10) : 200;

if (!isDryRun && !isExecute) {
  console.log('使い方:');
  console.log('  npx tsx scripts/taslink-bulk-sync.ts --dry-run');
  console.log('  npx tsx scripts/taslink-bulk-sync.ts --execute [--limit=N] [--only-unsynced] [--interval=200]');
  process.exit(1);
}

// ===== メイン処理 =====

async function main() {
  // dotenv 読み込み後に動的 import（環境変数の順序依存回避）
  const { PrismaClient } = require('@prisma/client');
  const { mapUserToTasLinkPayload, syncWorkerToTasLink } = require('../src/lib/taslink');

  // Supabase pooler 対策
  let dbUrl = process.env.DATABASE_URL!;
  const separator = dbUrl.includes('?') ? '&' : '?';
  if (!dbUrl.includes('pgbouncer=true')) {
    dbUrl += `${separator}pgbouncer=true&connect_timeout=30`;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  // 対象取得: 退会していない & 名前が入っている（TasLink の必須項目）
  const where: any = {
    deleted_at: null,
    name: { not: '' },
  };
  if (onlyUnsynced) {
    where.taslink_id = null;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      last_name_kana: true,
      first_name_kana: true,
      gender: true,
      birth_date: true,
      phone_number: true,
      postal_code: true,
      prefecture: true,
      city: true,
      address_line: true,
      qualifications: true,
      desired_work_days: true,
      desired_work_style: true,
      work_histories: true,
      self_pr: true,
      taslink_id: true,
    },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log('======================================');
  console.log('TasLink 一括同期');
  console.log('======================================');
  console.log(`モード       : ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`対象DB       : ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`TASLINK_URL  : ${process.env.TASLINK_API_URL}`);
  console.log(`フィルタ     : ${onlyUnsynced ? '未同期のみ (taslink_id IS NULL)' : '全ワーカー（名前あり・退会除く）'}`);
  console.log(`件数上限     : ${limit ?? '無制限'}`);
  console.log(`送信間隔     : ${intervalMs}ms`);
  console.log(`対象件数     : ${users.length}`);
  console.log('======================================\n');

  // ペイロード生成段階でのスキップ判定（名前分割失敗など）
  const skipped: Array<{ id: number; email: string; reason: string }> = [];
  const targets: Array<{ user: any; payload: any }> = [];

  for (const user of users) {
    const payload = mapUserToTasLinkPayload(user);
    if (!payload) {
      skipped.push({
        id: user.id,
        email: user.email,
        reason: 'payload生成失敗（氏名が不正）',
      });
      continue;
    }
    targets.push({ user, payload });
  }

  console.log(`同期対象     : ${targets.length}`);
  console.log(`スキップ     : ${skipped.length}\n`);

  if (skipped.length > 0) {
    console.log('--- スキップ対象（先頭10件） ---');
    skipped.slice(0, 10).forEach(s => {
      console.log(`  ID:${s.id} ${s.email} - ${s.reason}`);
    });
    console.log('');
  }

  if (isDryRun) {
    console.log('[DRY RUN] API呼び出しは行いません。--execute で実行してください。');
    console.log('\nサンプルペイロード（先頭1件）:');
    if (targets[0]) {
      console.log(JSON.stringify(targets[0].payload, null, 2));
    }
    await prisma.$disconnect();
    return;
  }

  // === 実行モード ===

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = path.resolve(process.cwd(), `scripts/taslink-bulk-sync-${timestamp}.csv`);
  const csvRows: string[] = ['user_id,email,name,status,taslink_id,error'];

  let successCount = 0;
  let failCount = 0;

  console.log(`同期開始 (${targets.length}件)...\n`);

  for (let i = 0; i < targets.length; i++) {
    const { user, payload } = targets[i];
    const prefix = `[${i + 1}/${targets.length}]`;

    try {
      const result = await syncWorkerToTasLink(user.id, payload);
      if (result.success) {
        console.log(`  ${prefix} ✓ ID:${user.id} ${user.email} → taslink_id=${result.tasLinkId ?? '(空)'}`);
        successCount++;
        csvRows.push(`${user.id},"${user.email}","${user.name}",success,${result.tasLinkId ?? ''},`);
      } else {
        const errMsg = result.error ?? 'unknown';
        console.log(`  ${prefix} ✗ ID:${user.id} ${user.email} - ${errMsg}`);
        failCount++;
        csvRows.push(`${user.id},"${user.email}","${user.name}",failed,,"${errMsg.replace(/"/g, '""')}"`);
      }
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      console.log(`  ${prefix} ✗ ID:${user.id} ${user.email} - 例外: ${errMsg}`);
      failCount++;
      csvRows.push(`${user.id},"${user.email}","${user.name}",exception,,"${errMsg.replace(/"/g, '""')}"`);
    }

    // スキップ分をCSVに記録（最後のループで一括）
    if (intervalMs > 0 && i < targets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // スキップ分もCSVに追記
  for (const s of skipped) {
    csvRows.push(`${s.id},"${s.email}","",skipped,,"${s.reason}"`);
  }

  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

  console.log('\n======================================');
  console.log(`結果: 成功 ${successCount}件 / 失敗 ${failCount}件 / スキップ ${skipped.length}件`);
  console.log(`結果CSV: ${csvPath}`);
  console.log('======================================');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
