import { NextRequest, NextResponse } from 'next/server';
import { resendVerificationEmail } from '@/src/lib/auth/email-verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスを入力してください。' },
        { status: 400 }
      );
    }

    const result = await resendVerificationEmail(email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // セキュリティのため、ユーザーの存在有無に関わらず成功メッセージを返す
    return NextResponse.json({
      success: true,
      message: '確認メールを送信しました。',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'システムエラーが発生しました。' },
      { status: 500 }
    );
  }
}
