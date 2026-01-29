import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatDateForCsv } from '@/src/lib/csv-export/utils';

export const dynamic = 'force-dynamic';

// CROSSNAVI仕様の48項目ヘッダー
const HEADERS = [
  '自社スタッフ番号',
  '事業所',
  '登録日',
  'プールスタッフ氏名－姓',
  'プールスタッフ氏名－名',
  'プールスタッフ氏名カナ－セイ',
  'プールスタッフ氏名カナ－メイ',
  '生年月日',
  '性別',
  '電話番号１',
  '電話番号１－連絡可否',
  '電話番号２',
  '電話番号２－連絡可否',
  '連絡用E-Mail１',
  '連絡用E-Mail１－連絡可否',
  '連絡用E-Mail２',
  '連絡用E-Mail２－連絡可否',
  '口座情報－銀行コード',
  '口座情報－銀行支店コード',
  '口座情報－口座種別',
  '口座情報－口座番号',
  '口座情報－口座名義',
  '配偶者有無',
  '扶養対象者人数',
  '現住所－郵便番号',
  '現住所－都道府県',
  '現住所－市区町村',
  '現住所－住所',
  '現住所－アパート・マンション',
  '現住所カナ',
  '最寄り駅－線',
  '最寄り駅－駅',
  '連絡先住所－郵便番号',
  '連絡先住所－都道府県',
  '連絡先住所－市区町村',
  '連絡先住所－住所',
  '連絡先住所－アパート・マンション',
  '連絡先住所カナ',
  '連絡先住所－TEL',
  '連絡先住所－FAX',
  '連絡先住所－内線',
  '住民票住所－郵便番号',
  '住民票住所－都道府県',
  '住民票住所－市区町村',
  '住民票住所－住所',
  '住民票住所－アパート・マンション',
  '住民票住所カナ',
  '住民票住所カナ２',
];

const BATCH_SIZE = 100;

function escapeField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeField).join(',') + '\r\n';
}

function splitName(name: string): [string, string] {
  if (!name) return ['', ''];
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(' ')];
  return [name, ''];
}

function convertGender(gender: string | null): string {
  if (!gender) return '';
  if (gender === 'male' || gender === '男性') return '0';
  if (gender === 'female' || gender === '女性') return '1';
  return '';
}

function convertAccountType(accountType: string | null): string {
  if (!accountType) return '0';
  if (accountType === 'CURRENT') return '1';
  return '0';
}

function staffToRow(staff: any, bankAccount: any): (string | number)[] {
  const [lastName, firstName] = splitName(staff.name);

  return [
    staff.id,
    '渋谷事業所',
    formatDateForCsv(staff.created_at),
    lastName,
    firstName,
    staff.last_name_kana || '',
    staff.first_name_kana || '',
    formatDateForCsv(staff.birth_date),
    convertGender(staff.gender),
    staff.phone_number || '',
    '1',
    '',
    '',
    staff.email || '',
    '1',
    '',
    '',
    bankAccount?.bank_code || '',
    bankAccount?.branch_code || '',
    bankAccount ? convertAccountType(bankAccount.account_type) : '',
    bankAccount?.account_number || '',
    bankAccount?.account_holder_name || '',
    '2',
    '0',
    staff.postal_code || '',
    staff.prefecture || '',
    staff.city || '',
    staff.address_line || '',
    staff.building || '',
    '',
    '',
    '',
    staff.postal_code || '',
    staff.prefecture || '',
    staff.city || '',
    staff.address_line || '',
    staff.building || '',
    '',
    '',
    '',
    '',
    staff.postal_code || '',
    staff.prefecture || '',
    staff.city || '',
    staff.address_line || '',
    staff.building || '',
    '',
    '',
  ];
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const staffId = url.searchParams.get('staffId');
  const name = url.searchParams.get('name');
  const phoneNumber = url.searchParams.get('phoneNumber');
  const email = url.searchParams.get('email');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  const where: any = { role: 'worker' };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone_number: { contains: search } },
    ];
  }
  if (staffId) where.id = parseInt(staffId, 10) || 0;
  if (name) where.name = { contains: name };
  if (phoneNumber) where.phone_number = { contains: phoneNumber };
  if (email) where.email = { contains: email };
  if (dateFrom || dateTo) {
    where.created_at = {};
    if (dateFrom) where.created_at.gte = new Date(dateFrom);
    if (dateTo) where.created_at.lte = new Date(dateTo);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('\uFEFF' + formatRow(HEADERS)));

        const totalCount = await prisma.user.count({ where });
        let processed = 0;

        while (processed < totalCount) {
          const batch = await prisma.user.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: processed,
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          // バッチ内のユーザーIDで銀行口座情報を一括取得
          const userIds = batch.map((u) => u.id);
          const bankAccounts = await prisma.bankAccount.findMany({
            where: { userId: { in: userIds } },
          });
          const bankAccountMap = new Map(bankAccounts.map((ba) => [ba.userId, ba]));

          for (const staff of batch) {
            const bankAccount = bankAccountMap.get(staff.id);
            controller.enqueue(encoder.encode(formatRow(staffToRow(staff, bankAccount))));
          }

          processed += batch.length;
        }

        controller.close();
      } catch (error) {
        console.error('[staff-csv] Stream error:', error);
        controller.error(error);
      }
    },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = encodeURIComponent(`プールスタッフ情報_${dateStr}_${timeStr}.csv`);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-cache',
    },
  });
}
