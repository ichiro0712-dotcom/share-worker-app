import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/src/lib/auth/email-verification';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: '認証トークンが指定されていません。' },
        { status: 400 }
      );
    }

    const result = await verifyEmailToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'メールアドレスの認証が完了しました。',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'システムエラーが発生しました。' },
      { status: 500 }
    );
  }
}
