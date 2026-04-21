/**
 * TasLink 向けワーカー情報 CSV エクスポートスクリプト
 *
 * TasLink 側が提供するインポートテンプレート（40列）に `img_url` 列を加えた
 * 41列のCSVを出力する。本番DBに格納されている既存ワーカーを
 * TasLink 側に一括取り込みしてもらうためのデータ受け渡し用途。
 *
 * 使い方:
 *   # 退会していない全ワーカーを出力（scripts/exports/ 配下にタイムスタンプ付きファイル）
 *   npx tsx scripts/export-workers-for-taslink.ts
 *
 *   # 件数を制限してリハーサル
 *   npx tsx scripts/export-workers-for-taslink.ts --limit=3
 *
 *   # 出力先を指定
 *   npx tsx scripts/export-workers-for-taslink.ts --output=/tmp/workers.csv
 *
 * 環境変数:
 *   DATABASE_URL - 対象DBの接続文字列（.env.local から読み込む）
 *
 * 注意:
 *   本番DBに対する実行は、プロジェクトルールに従いユーザー自身が行う。
 *   Claude Code は本番DBへ直接アクセスしない。
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

// ===== 引数パース =====

function parseArg(flag: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`));
  return arg ? arg.split('=')[1] : undefined;
}

const limit = parseArg('--limit') ? parseInt(parseArg('--limit')!, 10) : undefined;
const outputArg = parseArg('--output');

// ===== CSV ヘッダー（テンプレート準拠 + img_url） =====

const CSV_HEADERS = [
  '姓', '名', '姓カナ', '名カナ', '性別', '生年月日',
  '電話番号', '電話番号2', 'メール',
  '郵便番号', '都道府県', '市区町村', '住所', '最寄駅',
  '所有資格', '経験年数', '希望時給',
  '勤務希望', '週の勤務回数', '勤務可能曜日', 'シフト',
  '通勤可能手段', '勤務開始可能日', '登録経路', '備考',
  '経歴1_施設形態', '経歴1_雇用形態', '経歴1_期間',
  '経歴2_施設形態', '経歴2_雇用形態', '経歴2_期間',
  '経歴3_施設形態', '経歴3_雇用形態', '経歴3_期間',
  '経歴4_施設形態', '経歴4_雇用形態', '経歴4_期間',
  '経歴5_施設形態', '経歴5_雇用形態', '経歴5_期間',
  'img_url',
] as const;

// ===== ユーティリティ =====

/** name を姓名に分割（全角・半角スペース対応）。splitName in src/lib/taslink.ts と同ロジック */
function splitName(name: string): { lastName: string; firstName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { lastName: '', firstName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  }
  return { lastName: parts[0], firstName: '' };
}

/** Date を JST 基準の YYYY/MM/DD に変換（テンプレートの表記に合わせる） */
function toJSTDateSlash(date: Date | null | undefined): string {
  if (!date) return '';
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

/** gender をテンプレート形式（男性/女性/その他/空）に正規化 */
function normalizeGender(gender: string | null | undefined): string {
  if (!gender) return '';
  const map: Record<string, string> = {
    '男性': '男性',
    '女性': '女性',
    'その他': 'その他',
    MALE: '男性',
    FEMALE: '女性',
    OTHER: 'その他',
  };
  return map[gender] ?? '';
}

/** base64 data URL か否か */
function isDataUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('data:');
}

/** profile_image を img_url 列用の文字列に変換 */
function resolveImgUrl(profileImage: string | null | undefined, userId: number): string {
  if (!profileImage) return '';
  if (isDataUrl(profileImage)) {
    console.warn(`[export] user ${userId} の profile_image が base64 data URL のため空欄にします`);
    return '';
  }
  return profileImage;
}

/** CSV フィールドのエスケープ。カンマ/ダブルクォート/改行を含む場合は `"..."` で囲む */
function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 住所 = address_line + building（buildingがあればスペース区切りで付与） */
function buildAddress(addressLine: string | null | undefined, building: string | null | undefined): string {
  const a = (addressLine ?? '').trim();
  const b = (building ?? '').trim();
  if (a && b) return `${a} ${b}`;
  return a || b || '';
}

/** work_histories を 5セット × (施設形態/雇用形態/期間) の15フィールドに展開 */
function expandWorkHistories(histories: string[] | null | undefined): string[] {
  const fields: string[] = [];
  const list = histories ?? [];
  for (let i = 0; i < 5; i++) {
    const entry = (list[i] ?? '').trim();
    // 先頭列（施設形態）に全文、他2列は空欄
    fields.push(entry);
    fields.push('');
    fields.push('');
  }
  return fields;
}

// ===== メイン処理 =====

async function main() {
  const { PrismaClient } = require('@prisma/client');

  // Supabase pooler 対策
  let dbUrl = process.env.DATABASE_URL!;
  const separator = dbUrl.includes('?') ? '&' : '?';
  if (!dbUrl.includes('pgbouncer=true')) {
    dbUrl += `${separator}pgbouncer=true&connect_timeout=30`;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  // 対象取得
  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      name: { not: '' },
    },
    select: {
      id: true,
      name: true,
      last_name_kana: true,
      first_name_kana: true,
      gender: true,
      birth_date: true,
      phone_number: true,
      email: true,
      postal_code: true,
      prefecture: true,
      city: true,
      address_line: true,
      building: true,
      qualifications: true,
      desired_work_style: true,
      desired_work_days_week: true,
      desired_work_days: true,
      self_pr: true,
      work_histories: true,
      profile_image: true,
    },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log('======================================');
  console.log('TasLink 向けワーカー CSV エクスポート');
  console.log('======================================');
  console.log(`対象DB       : ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`件数上限     : ${limit ?? '無制限'}`);
  console.log(`対象件数     : ${users.length}`);
  console.log('======================================\n');

  // 出力先決定
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultDir = path.resolve(process.cwd(), 'scripts/exports');
  const outputPath = outputArg
    ? path.resolve(outputArg)
    : path.join(defaultDir, `workers-for-taslink-${timestamp}.csv`);

  // 出力ディレクトリが無ければ作成
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // CSV 構築
  const lines: string[] = [];
  // UTF-8 BOM は Buffer として別途書き込み
  lines.push(CSV_HEADERS.map(csvEscape).join(','));

  for (const user of users) {
    const { lastName, firstName } = splitName(user.name);
    const qualifications = (user.qualifications ?? []).join(',');
    const desiredWorkDays = (user.desired_work_days ?? []).join(',');
    const workHistoryFields = expandWorkHistories(user.work_histories);
    const imgUrl = resolveImgUrl(user.profile_image, user.id);

    const row = [
      lastName,                                          // 姓
      firstName,                                         // 名
      user.last_name_kana ?? '',                         // 姓カナ
      user.first_name_kana ?? '',                        // 名カナ
      normalizeGender(user.gender),                      // 性別
      toJSTDateSlash(user.birth_date),                   // 生年月日
      user.phone_number ?? '',                           // 電話番号
      '',                                                // 電話番号2（DBなし）
      user.email ?? '',                                  // メール
      user.postal_code ?? '',                            // 郵便番号
      user.prefecture ?? '',                             // 都道府県
      user.city ?? '',                                   // 市区町村
      buildAddress(user.address_line, user.building),    // 住所
      '',                                                // 最寄駅（DBなし）
      qualifications,                                    // 所有資格
      '',                                                // 経験年数（DBなし）
      '',                                                // 希望時給（DBなし）
      user.desired_work_style ?? '',                     // 勤務希望
      user.desired_work_days_week ?? '',                 // 週の勤務回数
      desiredWorkDays,                                   // 勤務可能曜日
      '',                                                // シフト（DBなし）
      '',                                                // 通勤可能手段（DBなし）
      '',                                                // 勤務開始可能日（DBなし）
      'ジョブマッチング',                                  // 登録経路（TasLink API registrationSource と同じ）
      user.self_pr ?? '',                                // 備考
      ...workHistoryFields,                              // 経歴1〜5 × 3列 = 15列
      imgUrl,                                            // img_url
    ];

    if (row.length !== CSV_HEADERS.length) {
      throw new Error(
        `列数不一致 (user ${user.id}): row=${row.length}, headers=${CSV_HEADERS.length}`
      );
    }

    lines.push(row.map(csvEscape).join(','));
  }

  // UTF-8 BOM + 本体
  const BOM = '﻿';
  const content = BOM + lines.join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf-8');

  console.log(`\n✓ CSV 出力完了: ${outputPath}`);
  console.log(`  行数: ${users.length + 1} (ヘッダー含む)`);
  console.log(`  列数: ${CSV_HEADERS.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
