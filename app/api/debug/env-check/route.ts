import { NextResponse } from 'next/server';

export async function GET() {
  // 環境変数の存在確認（値は表示しない）
  const envCheck = {
    GOOGLE_MAPS_API_KEY: !!process.env.GOOGLE_MAPS_API_KEY,
    GOOGLE_MAPS_API_KEY_LENGTH: process.env.GOOGLE_MAPS_API_KEY?.length || 0,
    GOOGLE_MAPS_API_KEY_PREFIX: process.env.GOOGLE_MAPS_API_KEY?.substring(0, 10) || 'NOT_SET',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };

  return NextResponse.json(envCheck);
}
