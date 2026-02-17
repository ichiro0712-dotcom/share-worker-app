/**
 * Google Indexing API ユーティリティ
 *
 * 求人の公開・更新・削除時にGoogleに通知し、
 * Google for Jobs への反映を高速化する（数分〜数時間）。
 *
 * 環境変数:
 *   GOOGLE_INDEXING_CLIENT_EMAIL - サービスアカウントのメールアドレス
 *   GOOGLE_INDEXING_PRIVATE_KEY  - サービスアカウントの秘密鍵（PEM形式）
 *
 * セットアップ手順:
 * 1. Google Cloud Console で Indexing API を有効化
 * 2. サービスアカウントを作成し、JSON鍵をダウンロード
 * 3. Google Search Console でサービスアカウントのメールを「所有者」として追加
 * 4. JSON鍵の client_email と private_key を環境変数に設定
 */

const INDEXING_API_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

type IndexingAction = 'URL_UPDATED' | 'URL_DELETED';

/**
 * Google OAuth2 アクセストークンを取得
 * JWT (JSON Web Token) を自前で生成してトークンエンドポイントに送信
 */
async function getAccessToken(): Promise<string | null> {
    const clientEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        return null;
    }

    try {
        // JWT Header
        const header = {
            alg: 'RS256',
            typ: 'JWT',
        };

        // JWT Payload
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: clientEmail,
            scope: 'https://www.googleapis.com/auth/indexing',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        };

        // Base64url encode
        const base64url = (obj: object) =>
            Buffer.from(JSON.stringify(obj))
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

        const unsignedToken = `${base64url(header)}.${base64url(payload)}`;

        // Sign with RSA-SHA256 using Node.js crypto
        const crypto = await import('crypto');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(unsignedToken);
        const signature = sign
            .sign(privateKey, 'base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const jwt = `${unsignedToken}.${signature}`;

        // Exchange JWT for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        if (!tokenResponse.ok) {
            console.error('[GoogleIndexing] Token request failed:', tokenResponse.status);
            return null;
        }

        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
    } catch (error) {
        console.error('[GoogleIndexing] Failed to get access token:', error);
        return null;
    }
}

/**
 * Google Indexing API にURL通知を送信
 */
async function notifyGoogle(url: string, action: IndexingAction): Promise<boolean> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        // 環境変数未設定の場合はスキップ（開発環境では正常）
        console.log('[GoogleIndexing] Skipped: credentials not configured');
        return false;
    }

    try {
        const response = await fetch(INDEXING_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                url,
                type: action,
            }),
        });

        if (response.ok) {
            console.log(`[GoogleIndexing] ${action} success: ${url}`);
            return true;
        } else {
            const errorBody = await response.text();
            console.error(`[GoogleIndexing] ${action} failed (${response.status}): ${errorBody}`);
            return false;
        }
    } catch (error) {
        console.error(`[GoogleIndexing] ${action} error for ${url}:`, error);
        return false;
    }
}

/**
 * 求人公開URLのベースURLを取得
 */
function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://tastas.work';
}

/**
 * 求人が公開・更新されたことをGoogleに通知
 * 非同期で実行し、失敗しても求人操作に影響しない
 */
export function notifyJobUpdated(jobId: number): void {
    const url = `${getBaseUrl()}/public/jobs/${jobId}`;
    notifyGoogle(url, 'URL_UPDATED').catch(() => {});
}

/**
 * 求人が削除されたことをGoogleに通知
 * 非同期で実行し、失敗しても求人操作に影響しない
 */
export function notifyJobDeleted(jobId: number): void {
    const url = `${getBaseUrl()}/public/jobs/${jobId}`;
    notifyGoogle(url, 'URL_DELETED').catch(() => {});
}

/**
 * 複数の求人を一括で通知
 */
export function notifyJobsUpdated(jobIds: number[]): void {
    for (const jobId of jobIds) {
        notifyJobUpdated(jobId);
    }
}

/**
 * 複数の求人の削除を一括で通知
 */
export function notifyJobsDeleted(jobIds: number[]): void {
    for (const jobId of jobIds) {
        notifyJobDeleted(jobId);
    }
}
