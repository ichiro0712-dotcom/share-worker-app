import { NextRequest, NextResponse } from 'next/server';

// 開発環境のみで動作
export const dynamic = 'force-dynamic';

/**
 * 本番環境でのアクセスを拒否
 */
function rejectInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug API is disabled in production' },
      { status: 403 }
    );
  }
  return null;
}

const DEBUG_TIME_COOKIE_NAME = 'debugTimeSettings';

interface DebugTimeSettings {
  enabled: boolean;
  time: string | null;
}

/**
 * デバッグ時刻設定を取得
 */
export async function GET(request: NextRequest) {
  const rejected = rejectInProduction();
  if (rejected) return rejected;

  try {
    const cookie = request.cookies.get(DEBUG_TIME_COOKIE_NAME);

    if (cookie?.value) {
      const decoded = decodeURIComponent(cookie.value);
      const settings = JSON.parse(decoded) as DebugTimeSettings;
      return NextResponse.json(settings);
    }
  } catch (error) {
    console.error('[GET /api/debug/time] Error:', error);
  }

  return NextResponse.json({ enabled: false, time: null });
}

/**
 * デバッグ時刻設定を更新
 */
export async function POST(request: NextRequest) {
  const rejected = rejectInProduction();
  if (rejected) return rejected;

  try {
    const body = await request.json();
    const { enabled, time } = body;

    const settings: DebugTimeSettings = {
      enabled: Boolean(enabled),
      time: time || null
    };

    const cookieValue = encodeURIComponent(JSON.stringify(settings));

    const response = NextResponse.json({
      success: true,
      settings
    });

    // Cookieに設定を保存
    response.cookies.set(DEBUG_TIME_COOKIE_NAME, cookieValue, {
      httpOnly: false, // クライアントからも読み取れるようにする
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24時間
    });

    return response;
  } catch (error) {
    console.error('[POST /api/debug/time] Error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 500 }
    );
  }
}
