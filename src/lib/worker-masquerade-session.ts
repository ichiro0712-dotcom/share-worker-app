/**
 * ワーカーマスカレードセッション管理
 * 施設管理者セッション(lib/admin-session.ts)と同様の設計
 */

export interface WorkerMasqueradeSessionData {
    workerId: number;
    workerName: string;
    workerEmail: string;
    systemAdminId: number;
    createdAt: number;
    expiresAt: number;
}

const SESSION_KEY = 'worker_masquerade_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8時間（ミリ秒）

/**
 * マスカレードセッションを作成
 */
export function createWorkerMasqueradeSession(data: Omit<WorkerMasqueradeSessionData, 'createdAt' | 'expiresAt'>): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const sessionData: WorkerMasqueradeSessionData = {
        ...data,
        createdAt: now,
        expiresAt: now + SESSION_DURATION,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

    // 互換性のため既存キーも設定
    localStorage.setItem('masqueradeMode', 'worker');
    localStorage.setItem('masqueradeWorkerId', data.workerId.toString());
    localStorage.setItem('masqueradeWorkerName', data.workerName);
    localStorage.setItem('masqueradeWorkerEmail', data.workerEmail);
    localStorage.setItem('masqueradeSystemAdminId', data.systemAdminId.toString());
    localStorage.setItem('user', JSON.stringify({
        id: data.workerId,
        name: data.workerName,
        email: data.workerEmail,
        isMasquerade: true,
    }));
}

/**
 * マスカレードセッションを取得（有効期限チェック付き）
 */
export function getWorkerMasqueradeSession(): WorkerMasqueradeSessionData | null {
    if (typeof window === 'undefined') return null;

    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) {
        // 互換性: 旧形式のデータをチェック
        const masqueradeMode = localStorage.getItem('masqueradeMode');
        if (masqueradeMode === 'worker') {
            // 旧形式 → タイムアウトなしなのでそのまま返す（次回保存時に新形式に移行）
            const workerId = localStorage.getItem('masqueradeWorkerId');
            const workerName = localStorage.getItem('masqueradeWorkerName');
            const workerEmail = localStorage.getItem('masqueradeWorkerEmail');
            const systemAdminId = localStorage.getItem('masqueradeSystemAdminId');

            if (workerId && workerName) {
                return {
                    workerId: parseInt(workerId),
                    workerName,
                    workerEmail: workerEmail || '',
                    systemAdminId: systemAdminId ? parseInt(systemAdminId) : 0,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + SESSION_DURATION, // 新形式に移行時は8時間延長
                };
            }
        }
        return null;
    }

    try {
        const session: WorkerMasqueradeSessionData = JSON.parse(sessionStr);

        // 有効期限チェック
        if (Date.now() > session.expiresAt) {
            clearWorkerMasqueradeSession();
            return null;
        }

        return session;
    } catch {
        clearWorkerMasqueradeSession();
        return null;
    }
}

/**
 * マスカレードセッションをクリア
 */
export function clearWorkerMasqueradeSession(): void {
    if (typeof window === 'undefined') return;

    // 新形式
    localStorage.removeItem(SESSION_KEY);

    // 互換性のため旧キーもクリア
    localStorage.removeItem('masqueradeMode');
    localStorage.removeItem('masqueradeWorkerId');
    localStorage.removeItem('masqueradeWorkerName');
    localStorage.removeItem('masqueradeWorkerEmail');
    localStorage.removeItem('masqueradeSystemAdminId');
    localStorage.removeItem('user');
}

/**
 * マスカレードセッションが有効かチェック
 */
export function isWorkerMasqueradeSessionValid(): boolean {
    return getWorkerMasqueradeSession() !== null;
}

/**
 * セッションの残り時間を取得（分）
 */
export function getWorkerMasqueradeRemainingMinutes(): number {
    const session = getWorkerMasqueradeSession();
    if (!session) return 0;

    const remaining = session.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
}
