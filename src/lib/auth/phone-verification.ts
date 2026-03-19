/**
 * 電話番号認証用JWT生成・検証ユーティリティ
 * CPaaS NOWでのSMS認証成功後に短期トークンを発行し、
 * 登録・プロフィール更新時にサーバー側で検証する
 */
import { SignJWT, jwtVerify } from 'jose';

const TOKEN_EXPIRY = '10m'; // 10分有効

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  // phone-verification用のサブキーとして、プレフィックスを付与して差別化
  return new TextEncoder().encode(`phone-verify:${secret}`);
}

/**
 * 電話番号認証成功後にJWTトークンを生成
 */
export async function createPhoneVerificationToken(phone: string): Promise<string> {
  const secret = getSecret();

  return new SignJWT({
    phone,
    verifiedAt: Date.now(),
    purpose: 'phone-verification',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * 電話番号認証JWTトークンを検証
 * @param token JWTトークン
 * @param expectedPhone 期待する電話番号（リクエストの電話番号と一致するか確認）
 * @returns 検証成功ならtrue
 */
export async function validatePhoneVerificationToken(
  token: string,
  expectedPhone: string
): Promise<boolean> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    // 電話番号の一致を確認
    if (payload.phone !== expectedPhone) {
      console.warn('[Phone Verification] Phone mismatch:', {
        expected: expectedPhone,
        got: payload.phone,
      });
      return false;
    }

    // purpose の確認
    if (payload.purpose !== 'phone-verification') {
      console.warn('[Phone Verification] Invalid purpose:', payload.purpose);
      return false;
    }

    return true;
  } catch (error) {
    // JWTの期限切れ、署名不正等
    console.warn('[Phone Verification] Token validation failed:', error);
    return false;
  }
}
