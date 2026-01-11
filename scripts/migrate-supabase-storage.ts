/**
 * Supabase Storage 移行スクリプト
 *
 * 旧Supabase (ziaunavcbawzorrwwnos) から新Supabase (qcovuuqxyihbpjlgccxz) への移行
 *
 * 実行方法:
 * 1. .env.local に以下を追加:
 *    OLD_SUPABASE_URL=https://ziaunavcbawzorrwwnos.supabase.co
 *    OLD_SUPABASE_SERVICE_ROLE_KEY=（旧プロジェクトのService Role Key）
 *
 * 2. 実行:
 *    npx tsx scripts/migrate-supabase-storage.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local を読み込み
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

// 設定
const OLD_PROJECT_ID = 'ziaunavcbawzorrwwnos';
const NEW_PROJECT_ID = 'qcovuuqxyihbpjlgccxz';
const BUCKET_NAME = 'uploads';

// 環境変数チェック
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_SERVICE_ROLE_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 環境変数が不足しています:');
  console.error('   OLD_SUPABASE_URL=https://ziaunavcbawzorrwwnos.supabase.co');
  console.error('   OLD_SUPABASE_SERVICE_ROLE_KEY=（旧プロジェクトのService Role Key）');
  process.exit(1);
}

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 新Supabaseの環境変数が不足しています');
  process.exit(1);
}

// クライアント初期化
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY);
const prisma = new PrismaClient();

// 統計
let stats = {
  filesFound: 0,
  filesUploaded: 0,
  filesFailed: 0,
  dbUpdates: 0,
};

/**
 * バケット内の全ファイルを再帰的に取得
 */
async function listAllFiles(
  supabase: SupabaseClient,
  bucket: string,
  path: string = ''
): Promise<string[]> {
  const allFiles: string[] = [];

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path, { limit: 1000 });

  if (error) {
    console.error(`❌ ファイル一覧取得エラー (${path}):`, error.message);
    return allFiles;
  }

  for (const item of data || []) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    if (item.id === null) {
      // フォルダの場合は再帰的に探索
      const subFiles = await listAllFiles(supabase, bucket, fullPath);
      allFiles.push(...subFiles);
    } else {
      // ファイルの場合
      allFiles.push(fullPath);
    }
  }

  return allFiles;
}

/**
 * ファイルを旧→新にコピー
 */
async function copyFile(filePath: string): Promise<boolean> {
  try {
    // 旧Supabaseからダウンロード
    const { data: downloadData, error: downloadError } = await oldSupabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (downloadError) {
      console.error(`  ❌ ダウンロード失敗: ${filePath}`, downloadError.message);
      return false;
    }

    // 新Supabaseにアップロード
    const { error: uploadError } = await newSupabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, downloadData, {
        upsert: true, // 既存ファイルは上書き
        contentType: downloadData.type,
      });

    if (uploadError) {
      console.error(`  ❌ アップロード失敗: ${filePath}`, uploadError.message);
      return false;
    }

    console.log(`  ✅ ${filePath}`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ コピー失敗: ${filePath}`, error.message);
    return false;
  }
}

/**
 * データベース内のURL参照を更新
 */
async function updateDatabaseUrls(): Promise<void> {
  console.log('\n📝 データベースのURL参照を更新中...\n');

  const oldPattern = `https://${OLD_PROJECT_ID}.supabase.co`;
  const newPattern = `https://${NEW_PROJECT_ID}.supabase.co`;

  // 単一カラムの更新
  const singleColumnUpdates = [
    { table: 'User', column: 'profile_image' },
    { table: 'User', column: 'id_document' },
    { table: 'User', column: 'bank_book_image' },
    { table: 'Facility', column: 'map_image' },
    { table: 'Facility', column: 'staff_photo' },
    { table: 'Job', column: 'manager_avatar' },
    { table: 'LaborDocument', column: 'pdf_path' },
    { table: 'LaborDocumentDownloadToken', column: 'zip_path' },
  ];

  for (const { table, column } of singleColumnUpdates) {
    try {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE "${table}"
        SET "${column}" = REPLACE("${column}", '${oldPattern}', '${newPattern}')
        WHERE "${column}" LIKE '%${OLD_PROJECT_ID}%'
      `);
      if (result > 0) {
        console.log(`  ✅ ${table}.${column}: ${result}件更新`);
        stats.dbUpdates += result;
      }
    } catch (error: any) {
      console.error(`  ⚠️  ${table}.${column}: スキップ (${error.message})`);
    }
  }

  // 配列カラムの更新 (PostgreSQL array_to_string/string_to_array を使用)
  const arrayColumnUpdates = [
    { table: 'Facility', column: 'images' },
    { table: 'Facility', column: 'dresscode_images' },
    { table: 'JobTemplate', column: 'images' },
    { table: 'JobTemplate', column: 'dresscode_images' },
    { table: 'JobTemplate', column: 'attachments' },
    { table: 'Job', column: 'images' },
    { table: 'Job', column: 'dresscode_images' },
    { table: 'Job', column: 'attachments' },
    { table: 'Message', column: 'attachments' },
  ];

  for (const { table, column } of arrayColumnUpdates) {
    try {
      // PostgreSQLで配列内の文字列を置換
      const result = await prisma.$executeRawUnsafe(`
        UPDATE "${table}"
        SET "${column}" = (
          SELECT array_agg(REPLACE(elem, '${oldPattern}', '${newPattern}'))
          FROM unnest("${column}") AS elem
        )
        WHERE array_to_string("${column}", ',') LIKE '%${OLD_PROJECT_ID}%'
      `);
      if (result > 0) {
        console.log(`  ✅ ${table}.${column}[]: ${result}件更新`);
        stats.dbUpdates += result;
      }
    } catch (error: any) {
      console.error(`  ⚠️  ${table}.${column}[]: スキップ (${error.message})`);
    }
  }

  // JSONカラムの更新 (qualification_certificates)
  try {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "qualification_certificates" = REPLACE(
        "qualification_certificates"::text,
        '${oldPattern}',
        '${newPattern}'
      )::jsonb
      WHERE "qualification_certificates"::text LIKE '%${OLD_PROJECT_ID}%'
    `);
    if (result > 0) {
      console.log(`  ✅ User.qualification_certificates (JSON): ${result}件更新`);
      stats.dbUpdates += result;
    }
  } catch (error: any) {
    console.error(`  ⚠️  User.qualification_certificates: スキップ (${error.message})`);
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('========================================');
  console.log('  Supabase Storage 移行スクリプト');
  console.log('========================================\n');
  console.log(`旧: ${OLD_PROJECT_ID}`);
  console.log(`新: ${NEW_PROJECT_ID}`);
  console.log(`バケット: ${BUCKET_NAME}\n`);

  // Step 1: ファイル一覧取得
  console.log('📂 旧Supabaseのファイル一覧を取得中...\n');
  const files = await listAllFiles(oldSupabase, BUCKET_NAME);
  stats.filesFound = files.length;

  if (files.length === 0) {
    console.log('ℹ️  移行対象のファイルがありません\n');
  } else {
    console.log(`📁 ${files.length}個のファイルを発見\n`);

    // Step 2: ファイルコピー
    console.log('📤 ファイルを新Supabaseにコピー中...\n');
    for (const file of files) {
      const success = await copyFile(file);
      if (success) {
        stats.filesUploaded++;
      } else {
        stats.filesFailed++;
      }
    }
  }

  // Step 3: データベース更新
  await updateDatabaseUrls();

  // 結果表示
  console.log('\n========================================');
  console.log('  移行完了');
  console.log('========================================');
  console.log(`📁 ファイル発見: ${stats.filesFound}`);
  console.log(`✅ アップロード成功: ${stats.filesUploaded}`);
  console.log(`❌ アップロード失敗: ${stats.filesFailed}`);
  console.log(`📝 DB更新: ${stats.dbUpdates}件`);
  console.log('========================================\n');

  if (stats.filesFailed > 0) {
    console.log('⚠️  一部ファイルの移行に失敗しました。ログを確認してください。\n');
  }

  console.log('次のステップ:');
  console.log('1. 画像が正しく表示されることを確認');
  console.log('2. next.config.mjs から旧ホスト名を削除');
  console.log('3. Vercelに再デプロイ\n');
}

main()
  .catch((error) => {
    console.error('❌ 移行エラー:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
