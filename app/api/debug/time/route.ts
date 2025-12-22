import { NextRequest, NextResponse } from 'next/server';
import { setServerDebugTime, getServerDebugTime } from '@/utils/debugTime.server';

// 開発環境のみで動作
export const dynamic = 'force-dynamic';

/**
 * デバッグ時刻設定を取得
 */
export async function GET() {
  const settings = getServerDebugTime();
  return NextResponse.json(settings);
}

/**
 * デバッグ時刻設定を更新
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, time } = body;

    const settings = {
      enabled: Boolean(enabled),
      time: time || null
    };

    setServerDebugTime(settings);

    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
