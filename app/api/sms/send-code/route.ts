import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendVerificationCode } from '@/src/lib/cpaasnow';
import { isValidPhoneNumber } from '@/utils/inputValidation';
import { normalizePhoneDigits } from '@/src/lib/auth/identifier';

// インメモリレート制限: 電話番号あたり10分間で最大3回
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10分
const RATE_LIMIT_MAX = 3;

function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phoneNumber);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(phoneNumber, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: '電話番号を入力してください' },
        { status: 400 }
      );
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: '有効な日本の電話番号を入力してください' },
        { status: 400 }
      );
    }

    // 既に登録済みの電話番号には SMS を送信しない
    // （SMS 配信コストの無駄、UX 悪化防止）
    // DB 側も正規化比較（ハイフン・全角数字混在のレガシーデータ対応）
    // ログイン済みの場合は自分自身の既存レコードを除外（プロフィール編集での再認証に対応）
    const session = await getServerSession(authOptions);
    const selfUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
    const normalizedPhone = normalizePhoneDigits(phoneNumber);
    const existingUser = selfUserId
      ? await prisma.$queryRaw<{ id: number }[]>(
          Prisma.sql`SELECT id FROM users
            WHERE regexp_replace(translate(phone_number, '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g') = ${normalizedPhone}
            AND phone_verified = true
            AND deleted_at IS NULL
            AND id <> ${selfUserId}
            LIMIT 1`
        )
      : await prisma.$queryRaw<{ id: number }[]>(
          Prisma.sql`SELECT id FROM users
            WHERE regexp_replace(translate(phone_number, '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g') = ${normalizedPhone}
            AND phone_verified = true
            AND deleted_at IS NULL
            LIMIT 1`
        );
    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          error: 'この電話番号は既に登録されています。ログインページからログインしてください。',
          errorCode: 'PHONE_ALREADY_REGISTERED',
        },
        { status: 409 }
      );
    }

    // レート制限チェック
    if (!checkRateLimit(phoneNumber)) {
      return NextResponse.json(
        { error: 'SMS送信の制限に達しました。10分後にお試しください。' },
        { status: 429 }
      );
    }

    const result = await sendVerificationCode(phoneNumber);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SMS Send Code] Error:', error);
    return NextResponse.json(
      { error: 'SMS送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
