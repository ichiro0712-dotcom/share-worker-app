import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// CROSSNAVI仕様の28項目ヘッダー
const HEADERS = [
  '取引先番号',
  '法人番号',
  '法人名称',
  '法人名称カナ',
  '自社名称',
  '自社名称カナ',
  '郵便番号',
  '都道府県',
  '市区町村',
  '住所',
  '代表者名',
  '代表電話番号',
  '代表FAX番号',
  'URL',
  '銀行コード',
  '支店コード',
  '口座番号',
  '口座名義人',
  '振込依頼人番号',
  '受動喫煙防止措置',
  '事業所番号',
  '事業所名称',
  '郵便番号',
  '都道府県／市区町村',
  '住所',
  '電話番号',
  '担当者氏',
  '担当者名',
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

function facilityToRow(f: any): (string | number)[] {
  const representativeName = [f.representative_last_name, f.representative_first_name]
    .filter(Boolean)
    .join(' ');
  const prefectureCity = [f.prefecture, f.city].filter(Boolean).join('／');

  return [
    '',
    f.corporation_number || '',
    f.corporation_name || '',
    '',
    f.corporation_name || '',
    '',
    f.corp_postal_code || '',
    f.corp_prefecture || '',
    f.corp_city || '',
    f.corp_address_line || '',
    representativeName,
    f.phone_number || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    f.smoking_measure || '',
    '',
    f.facility_name || '',
    f.postal_code || '',
    prefectureCity,
    f.address_line || '',
    f.phone_number || '',
    f.contact_person_last_name || '',
    f.contact_person_first_name || '',
  ];
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const corporationNumber = url.searchParams.get('corporationNumber');
  const corporationName = url.searchParams.get('corporationName');
  const facilityName = url.searchParams.get('facilityName');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  const where: any = {};

  if (search) {
    where.OR = [
      { corporation_name: { contains: search, mode: 'insensitive' } },
      { facility_name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (corporationNumber) {
    where.corporation_number = { contains: corporationNumber };
  }
  if (corporationName) {
    where.corporation_name = { contains: corporationName, mode: 'insensitive' };
  }
  if (facilityName) {
    where.facility_name = { contains: facilityName, mode: 'insensitive' };
  }
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

        const totalCount = await prisma.facility.count({ where });
        let processed = 0;

        while (processed < totalCount) {
          const batch = await prisma.facility.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: processed,
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          for (const facility of batch) {
            controller.enqueue(encoder.encode(formatRow(facilityToRow(facility))));
          }

          processed += batch.length;
        }

        controller.close();
      } catch (error) {
        console.error('[client-csv] Stream error:', error);
        controller.error(error);
      }
    },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = encodeURIComponent(`取引先情報_${dateStr}_${timeStr}.csv`);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-cache',
    },
  });
}
