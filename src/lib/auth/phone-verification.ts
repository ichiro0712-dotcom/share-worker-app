/**
 * 電話番号認証用JWT生成・検証ユーティリティ
 * CPaaS NOWでのSMS認証成功後に短期トークンを発行し、
 * 登録・プロフィール更新時にサーバー側で検証する
 *
 * 入力の表記ゆれ（ハイフン・全角数字など）で検証結果が変わらないよう、
 * 発行・検証の両方で digits-only に正規化してから一致比較する。
 */
import { SignJWT, jwtVerify } from 'jose';
import { normalizePhoneDigits } from '@/src/lib/auth/identifier';

const TOKEN_EXPIRY = '7d'; // 7日間有効

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
    // payload は正規化後の digits-only で保存
    phone: normalizePhoneDigits(phone),
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
 * @param expectedPhone 期待する電話番号（正規化前後どちらでも可）
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
    // 後方互換: 旧トークン（payload.phone が raw 形式）も受けるため両側 normalize して比較
    const expectedNormalized = normalizePhoneDigits(expectedPhone);
    const payloadPhone = typeof payload.phone === 'string' ? payload.phone : '';
    const payloadNormalized = normalizePhoneDigits(payloadPhone);
    if (payloadNormalized !== expectedNormalized) {
      console.warn('[Phone Verification] Phone mismatch:', {
        expected: expectedNormalized,
        got: payloadPhone,
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
