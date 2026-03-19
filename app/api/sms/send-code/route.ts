import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCode } from '@/src/lib/cpaasnow';
import { isValidPhoneNumber } from '@/utils/inputValidation';

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
