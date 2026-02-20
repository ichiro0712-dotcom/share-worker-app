import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'ワーカーID',
  '登録日',
  '姓',
  '名',
  'セイ',
  'メイ',
  '生年月日',
  '年齢',
  '性別',
  '電話番号',
  'メールアドレス',
  '住所',
  '資格',
  '現在の働き方',
  '転職意向',
  '希望日数',
  '希望曜日',
  '総勤務回数',
  '総合評価',
  'キャンセル率',
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

/**
 * 名前を姓・名に分割
 */
function splitName(name: string): { lastName: string; firstName: string } {
  const parts = name.trim().split(/[\s　]+/);
  if (parts.length >= 2) {
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  }
  return { lastName: name, firstName: '' };
}

/**
 * 生年月日から年齢を計算
 */
function calculateAge(birthDate: Date | null): string {
  if (!birthDate) return '';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return String(age);
}

/**
 * 住所を組み立て
 */
function buildAddress(user: { prefecture?: string | null; city?: string | null; address_line?: string | null; building?: string | null }): string {
  return [user.prefecture, user.city, user.address_line, user.building]
    .filter(Boolean)
    .join('');
}

/**
 * 総合評価を計算（レビューの平均）
 */
function calculateAverageRating(reviews: { rating: number }[]): string {
  if (reviews.length === 0) return '';
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return avg.toFixed(1);
}

/**
 * キャンセル率を計算
 */
function calculateCancelRate(applications: { status: string }[]): string {
  if (applications.length === 0) return '0%';
  const cancelled = applications.filter(a =>
    a.status === 'CANCELLED_BY_WORKER' || a.status === 'CANCELLED'
  ).length;
  const rate = (cancelled / applications.length) * 100;
  return `${rate.toFixed(1)}%`;
}

function workerToRow(user: any): (string | number | null)[] {
  const { lastName, firstName } = splitName(user.name || '');

  return [
    user.id,
    user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
    lastName,
    firstName,
    user.last_name_kana || '',
    user.first_name_kana || '',
    user.birth_date ? new Date(user.birth_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
    calculateAge(user.birth_date),
    user.gender || '',
    user.phone_number || '',
    user.email || '',
    buildAddress(user),
    (user.qualifications || []).join('、'),
    user.current_work_style || '',
    user.job_change_desire || '',
    user.desired_work_days_week || '',
    (user.desired_work_days || []).join('、'),
    user._count?.attendances ?? 0,
    calculateAverageRating(user.reviews || []),
    calculateCancelRate(user.applications || []),
  ];
}

export async function GET(request: NextRequest) {
  const session = await getSystemAdminSessionData();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const name = url.searchParams.get('name');
  const email = url.searchParams.get('email');
  const phoneNumber = url.searchParams.get('phoneNumber');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  // WHERE条件を構築
  const where: any = {
    deleted_at: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone_number: { contains: search } },
    ];
  }
  if (name) {
    where.name = { contains: name, mode: 'insensitive' };
  }
  if (email) {
    where.email = { contains: email, mode: 'insensitive' };
  }
  if (phoneNumber) {
    where.phone_number = { contains: phoneNumber };
  }
  if (dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(dateFrom) };
  }
  if (dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(dateTo + 'T23:59:59') };
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
            select: {
              id: true,
              created_at: true,
              name: true,
              last_name_kana: true,
              first_name_kana: true,
              birth_date: true,
              gender: true,
              phone_number: true,
              email: true,
              prefecture: true,
              city: true,
              address_line: true,
              building: true,
              qualifications: true,
              current_work_style: true,
              job_change_desire: true,
              desired_work_days_week: true,
              desired_work_days: true,
              reviews: {
                select: { rating: true },
              },
              applications: {
                select: { status: true },
              },
              _count: {
                select: { attendances: true },
              },
            },
            orderBy: { created_at: 'desc' },
            skip: processed,
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          for (const user of batch) {
            const row = workerToRow(user);
            controller.enqueue(encoder.encode(formatRow(row)));
          }

          processed += batch.length;
        }

        console.log(`[worker-csv] Completed: ${processed} records exported`);
        controller.close();
      } catch (error) {
        console.error('[worker-csv] Stream error:', error);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = encodeURIComponent(`ワーカー情報_${dateStr}_${timeStr}.csv`);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-cache',
    },
  });
}
