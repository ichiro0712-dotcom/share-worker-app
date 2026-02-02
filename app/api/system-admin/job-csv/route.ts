import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatTimeForCsv, calculateWorkingHours } from '@/src/lib/csv-export/utils';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

// CROSSNAVI仕様の223項目ヘッダー
const HEADERS = [
  '取引先ID', '取引先番号', '取引先案件番号', '案件名称', '取引先事業所',
  '取引先担当窓口－担当者名', '取引先担当窓口－所属', '取引先担当窓口－TEL', '取引先担当窓口－FAX', '取引先担当窓口－E-Mail',
  '取引先請求担当－担当者名', '取引先請求担当－所属', '取引先請求担当－郵便番号', '取引先請求担当－住所', '取引先請求担当－TEL',
  '取引先請求担当－FAX', '取引先請求担当－E-Mail', '勤務先－名称', '勤務先－郵便番号', '勤務先－住所',
  '勤務先－建物', '勤務先－最寄り駅', '勤務先－TEL', '勤務先責任者－氏名', '勤務先責任者－TEL',
  '勤務先責任者－携帯', '勤務先責任者－E-Mail', '雇用形態', '職種', '業務内容',
  '受動喫煙防止措置', '解雇の事由', 'Web勤怠', '時刻丸め－出勤', '時刻丸め－退勤',
  '早出可否', '雇用期間', '契約期間－開始日', '契約期間－終了日', '給与形態',
  '時給単価', '日給単価', '月給単価', '交通費区分', '交通費－固定金額',
  '交通費－上限金額', '交通費－実費計算方法', '労災保険区分', '社会保険区分', '雇用保険区分',
  '支払方法', '支払期間',
  '日々課税手当1－名称', '日々課税手当1－金額', '日々課税手当2－名称', '日々課税手当2－金額',
  '日々課税手当3－名称', '日々課税手当3－金額', '日々課税手当4－名称', '日々課税手当4－金額',
  '日々課税手当5－名称', '日々課税手当5－金額', '日々課税手当6－名称', '日々課税手当6－金額',
  '日々課税手当7－名称', '日々課税手当7－金額', '日々課税手当8－名称', '日々課税手当8－金額',
  '日々課税手当9－名称', '日々課税手当9－金額', '日々課税手当10－名称', '日々課税手当10－金額',
  '日々非課税手当1－名称', '日々非課税手当1－金額', '日々非課税手当2－名称', '日々非課税手当2－金額',
  '日々非課税手当3－名称', '日々非課税手当3－金額', '日々非課税手当4－名称', '日々非課税手当4－金額',
  '日々非課税手当5－名称', '日々非課税手当5－金額', '日々非課税手当6－名称', '日々非課税手当6－金額',
  '日々非課税手当7－名称', '日々非課税手当7－金額', '日々非課税手当8－名称', '日々非課税手当8－金額',
  '日々非課税手当9－名称', '日々非課税手当9－金額', '日々非課税手当10－名称', '日々非課税手当10－金額',
  '期間課税手当1－名称', '期間課税手当1－金額', '期間課税手当2－名称', '期間課税手当2－金額',
  '期間課税手当3－名称', '期間課税手当3－金額', '期間課税手当4－名称', '期間課税手当4－金額',
  '期間課税手当5－名称', '期間課税手当5－金額', '期間課税手当6－名称', '期間課税手当6－金額',
  '期間課税手当7－名称', '期間課税手当7－金額', '期間課税手当8－名称', '期間課税手当8－金額',
  '期間課税手当9－名称', '期間課税手当9－金額', '期間課税手当10－名称', '期間課税手当10－金額',
  '期間非課税手当1－名称', '期間非課税手当1－金額', '期間非課税手当2－名称', '期間非課税手当2－金額',
  '期間非課税手当3－名称', '期間非課税手当3－金額', '期間非課税手当4－名称', '期間非課税手当4－金額',
  '期間非課税手当5－名称', '期間非課税手当5－金額', '期間非課税手当6－名称', '期間非課税手当6－金額',
  '期間非課税手当7－名称', '期間非課税手当7－金額', '期間非課税手当8－名称', '期間非課税手当8－金額',
  '期間非課税手当9－名称', '期間非課税手当9－金額', '期間非課税手当10－名称', '期間非課税手当10－金額',
  '割増－所定外（時間外）', '割増－所定外（深夜）', '割増－所定外（休日）', '割増－45時間超',
  '割増－60時間超', '割増－法定休日', '割増－法定外休日', '割増－深夜',
  '割増－深夜休日', '割増－所定外深夜', '割増－45時間超深夜', '割増－60時間超深夜',
  '時給別単価1－職種', '時給別単価1－時給', '時給別単価2－職種', '時給別単価2－時給',
  '時給別単価3－職種', '時給別単価3－時給', '時給別単価4－職種', '時給別単価4－時給',
  '時給別単価5－職種', '時給別単価5－時給', '時給別単価6－職種', '時給別単価6－時給',
  '時給別単価7－職種', '時給別単価7－時給', '時給別単価8－職種', '時給別単価8－時給',
  '時給別単価9－職種', '時給別単価9－時給', '時給別単価10－職種', '時給別単価10－時給',
  '控除1－名称', '控除1－金額', '控除2－名称', '控除2－金額',
  '控除3－名称', '控除3－金額', '控除4－名称', '控除4－金額',
  '控除5－名称', '控除5－金額', '控除6－名称', '控除6－金額',
  '控除7－名称', '控除7－金額', '控除8－名称', '控除8－金額',
  '控除9－名称', '控除9－金額', '控除10－名称', '控除10－金額',
  '請求根拠区分', '請求－時給単価', '請求－日給単価', '請求－月給単価',
  '紹介手数料形態', '紹介手数料－率', '紹介手数料－金額', '請求－交通費',
  '請求－日々課税手当1－名称', '請求－日々課税手当1－金額',
  '請求－日々課税手当2－名称', '請求－日々課税手当2－金額',
  '請求－日々課税手当3－名称', '請求－日々課税手当3－金額',
  '請求－日々課税手当4－名称', '請求－日々課税手当4－金額',
  '請求－日々課税手当5－名称', '請求－日々課税手当5－金額',
  '請求－日々非課税手当1－名称', '請求－日々非課税手当1－金額',
  '請求－日々非課税手当2－名称', '請求－日々非課税手当2－金額',
  '請求－日々非課税手当3－名称', '請求－日々非課税手当3－金額',
  '請求－日々非課税手当4－名称', '請求－日々非課税手当4－金額',
  '請求－日々非課税手当5－名称', '請求－日々非課税手当5－金額',
  '自社事業所', '自社担当窓口－担当者名', '自社担当窓口－所属', '自社担当窓口－TEL',
  '自社担当窓口－FAX', '自社担当窓口－E-Mail', 'プールスタッフ担当窓口－担当者名',
  '求職受付手数料対象業務', '求職者手数料対象業務', '備考', 'メモ',
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

function jobToRow(job: any): (string | number)[] {
  const f = job.facility;
  const contactPerson = [f.contact_person_last_name, f.contact_person_first_name].filter(Boolean).join(' ');
  const managerName = [f.manager_last_name, f.manager_first_name].filter(Boolean).join(' ');
  const corpAddress = [f.corp_prefecture, f.corp_city, f.corp_address_line].filter(Boolean).join(' ');
  const facilityAddress = [f.prefecture, f.city, f.address_line].filter(Boolean).join(' ');
  const workContent = job.work_content?.join('\n') || job.overview || '';

  // 223項目の配列を生成（大部分が空欄または固定値）
  const row: (string | number)[] = [
    '', '', '', job.title, f.facility_name,
    contactPerson, '', f.phone_number || '', '', '',
    '', '', f.corp_postal_code || '', corpAddress, f.phone_number || '',
    '', '', f.facility_name, f.postal_code || '', facilityAddress,
    '', '', f.phone_number || '', managerName, '',
    '', '', '2', '', workContent,
    f.smoking_measure || '', '', '0', '1', '1',
    '0', '0', '', '', '0',
    String(job.hourly_wage || 0), '', '', '1', String(job.transportation_fee || 0),
    '', '', '1', '0', '0',
    '0', '0',
  ];

  // 日々課税手当1-10 (20項目)
  for (let i = 0; i < 10; i++) row.push('', '0');
  // 日々非課税手当1-10 (20項目)
  for (let i = 0; i < 10; i++) row.push('', '0');
  // 期間課税手当1-10 (20項目)
  for (let i = 0; i < 10; i++) row.push('', '0');
  // 期間非課税手当1-10 (20項目)
  for (let i = 0; i < 10; i++) row.push('', '0');
  // 割増 (12項目)
  for (let i = 0; i < 12; i++) row.push('');
  // 時給別単価1-10 (20項目)
  for (let i = 0; i < 10; i++) row.push('', '');
  // 控除1-10 (20項目)
  for (let i = 0; i < 10; i++) row.push('', '0');
  // 請求関連
  row.push('1', '', '', '', '0', '', '', '');
  // 請求課税手当1-5 (10項目)
  for (let i = 0; i < 5; i++) row.push('', '0');
  // 請求非課税手当1-5 (10項目)
  for (let i = 0; i < 5; i++) row.push('', '0');
  // 自社情報
  row.push('渋谷事業所', '大東 晃', '', '', '', '', '大東 晃');
  // 手数料対象業務・備考
  row.push('対象外', '対象外', '', '');

  return row;
}

export async function GET(request: NextRequest) {
  // システム管理者認証チェック
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const jobTitle = url.searchParams.get('jobTitle');
  const facilityName = url.searchParams.get('facilityName');
  const corporationName = url.searchParams.get('corporationName');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const status = url.searchParams.get('status');

  const where: any = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { facility: { facility_name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (jobTitle) where.title = { contains: jobTitle, mode: 'insensitive' };
  if (facilityName) where.facility = { ...where.facility, facility_name: { contains: facilityName, mode: 'insensitive' } };
  if (corporationName) where.facility = { ...where.facility, corporation_name: { contains: corporationName, mode: 'insensitive' } };
  if (dateFrom || dateTo) {
    where.created_at = {};
    if (dateFrom) where.created_at.gte = new Date(dateFrom);
    if (dateTo) where.created_at.lte = new Date(dateTo);
  }
  if (status) where.status = status;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('\uFEFF' + formatRow(HEADERS)));

        const totalCount = await prisma.job.count({ where });
        let processed = 0;

        while (processed < totalCount) {
          const batch = await prisma.job.findMany({
            where,
            include: { facility: true },
            orderBy: { created_at: 'desc' },
            skip: processed,
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          for (const job of batch) {
            controller.enqueue(encoder.encode(formatRow(jobToRow(job))));
          }

          processed += batch.length;
        }

        controller.close();
      } catch (error) {
        console.error('[job-csv] Stream error:', error);
        controller.error(error);
      }
    },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = encodeURIComponent(`案件情報_${dateStr}_${timeStr}.csv`);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-cache',
    },
  });
}
