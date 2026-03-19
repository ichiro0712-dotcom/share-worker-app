import { NextRequest, NextResponse } from 'next/server';
import { verifyCode } from '@/src/lib/cpaasnow';
import { createPhoneVerificationToken } from '@/src/lib/auth/phone-verification';
import { isValidPhoneNumber } from '@/utils/inputValidation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, code } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: '電話番号を入力してください' },
        { status: 400 }
      );
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { success: false, error: '有効な日本の電話番号を入力してください' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string' || code.length < 4 || code.length > 12) {
      return NextResponse.json(
        { success: false, error: '認証コードを正しく入力してください' },
        { status: 400 }
      );
    }

    const result = await verifyCode(phoneNumber, code);

    if (!result.success) {
      // エラーコードに応じたメッセージ
      const errorMessages: Record<string, string> = {
        Expired: '認証コードの有効期限が切れました。再送信してください。',
        NotFound: '認証コードが見つかりません。再送信してください。',
        AlreadyVerified: 'この認証コードは既に使用済みです。',
        Invalid: '認証コードが正しくありません。',
      };

      const message = (result.errorCode && errorMessages[result.errorCode])
        || result.errorMessage
        || '認証に失敗しました';

      return NextResponse.json(
        {
          success: false,
          error: message,
          errorCode: result.errorCode,
        },
        { status: 200 } // クライアント側でエラーハンドリングしやすいよう200で返す
      );
    }

    // 認証成功 → JWTトークン発行
    const verificationToken = await createPhoneVerificationToken(phoneNumber);

    return NextResponse.json({
      success: true,
      verificationToken,
    });
  } catch (error) {
    console.error('[SMS Verify Code] Error:', error);
    return NextResponse.json(
      { success: false, error: '認証処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
