/**
 * CPaaS NOW API クライアント
 * SMS認証コード送信・検証のためのサーバーサイドモジュール
 */

const API_URL = process.env.CPAAS_NOW_API_URL || 'https://sandbox.cpaasnow.com';
const API_TOKEN = process.env.CPAAS_NOW_API_TOKEN;

// SMS本文テンプレート
// {{verification_code}}: 認証コードに置換、{{expiration_minutes}}: 有効期限(分)に置換
const SMS_TEMPLATE = '【タスタス】認証コード: {{verification_code}}\r\n有効期限: 7日間';

export interface SendCodeResult {
  success: boolean;
  deliveryOrderId?: number;
  error?: string;
}

export interface VerifyCodeResult {
  success: boolean;
  status?: 'succeeded' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 認証コードをSMSで送信
 */
export async function sendVerificationCode(phoneNumber: string): Promise<SendCodeResult> {
  if (!API_TOKEN) {
    console.error('[CPaaS NOW] API token not configured. CPAAS_NOW_API_URL:', API_URL);
    return { success: false, error: `SMS送信の設定が完了していません（CPAAS_NOW_API_TOKEN未設定, URL=${API_URL}）` };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/verification_codes/deliveries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        channel: 'sms',
        message: SMS_TEMPLATE,
        code_type: 'numeric',
        code_size: 6,
        expiration_minutes: 10080, // 7日間（60分 × 24時間 × 7日）
      }),
    });

    if (response.status === 202) {
      const data = await response.json();
      console.log('[CPaaS NOW] Verification code sent:', { phoneNumber, deliveryOrderId: data.delivery_order_id });
      return {
        success: true,
        deliveryOrderId: data.delivery_order_id,
      };
    }

    if (response.status === 429) {
      console.warn('[CPaaS NOW] Rate limited:', phoneNumber);
      return { success: false, error: 'SMS送信の制限に達しました。しばらくしてからお試しください。' };
    }

    const errorBody = await response.text();
    console.error('[CPaaS NOW] Send failed:', { status: response.status, body: errorBody, url: `${API_URL}/api/v1/verification_codes/deliveries` });
    return { success: false, error: `SMS送信に失敗しました（${response.status}）: ${errorBody.slice(0, 200)}` };
  } catch (error) {
    console.error('[CPaaS NOW] Network error:', error);
    return { success: false, error: `SMS送信に失敗しました（ネットワークエラー）: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * 認証コードを検証
 */
export async function verifyCode(phoneNumber: string, code: string): Promise<VerifyCodeResult> {
  if (!API_TOKEN) {
    console.error('[CPaaS NOW] API token not configured');
    return { success: false, errorCode: 'ConfigError', errorMessage: 'SMS認証の設定が完了していません' };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/verification_codes/verifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        verification_code: code,
      }),
    });

    if (response.status === 202) {
      const data = await response.json();

      if (data.status === 'succeeded') {
        console.log('[CPaaS NOW] Verification succeeded:', phoneNumber);
        return { success: true, status: 'succeeded' };
      }

      // 認証失敗（期限切れ、不正コード等）
      const errorCode = data.error?.code || 'Unknown';
      const errorMessage = data.error?.message || '認証に失敗しました';
      console.warn('[CPaaS NOW] Verification failed:', { phoneNumber, errorCode });
      return {
        success: false,
        status: 'failed',
        errorCode,
        errorMessage,
      };
    }

    if (response.status === 429) {
      return { success: false, errorCode: 'TooManyRequests', errorMessage: '認証の試行回数が制限に達しました。しばらくしてからお試しください。' };
    }

    const errorBody = await response.text();
    console.error('[CPaaS NOW] Verify request failed:', { status: response.status, body: errorBody });
    return { success: false, errorCode: 'ServerError', errorMessage: '認証処理に失敗しました。しばらくしてからお試しください。' };
  } catch (error) {
    console.error('[CPaaS NOW] Network error:', error);
    return { success: false, errorCode: 'NetworkError', errorMessage: '認証処理に失敗しました。ネットワーク接続を確認してください。' };
  }
}
