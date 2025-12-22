/**
 * デバッグ用時刻管理ユーティリティ（サーバーサイド専用）
 *
 * APIルートからのみ使用される。
 * グローバル変数に設定を保存して永続化。
 */

// サーバーサイド用のグローバル変数（Next.jsのホットリロードでも保持される）
declare global {
  // eslint-disable-next-line no-var
  var debugTimeSettings: { enabled: boolean; time: string | null } | undefined;
}

/**
 * サーバーサイドでデバッグ時刻を設定（API経由で呼ばれる）
 */
export function setServerDebugTime(settings: { enabled: boolean; time: string | null }): void {
  global.debugTimeSettings = settings;
}

/**
 * サーバーサイドのデバッグ時刻設定を取得
 */
export function getServerDebugTime(): { enabled: boolean; time: string | null } {
  return global.debugTimeSettings || { enabled: false, time: null };
}
