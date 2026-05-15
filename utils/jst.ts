/**
 * JST（日本標準時, UTC+9）基準の日時操作ヘルパー
 *
 * Vercel サーバーは UTC で動作するため、new Date() や toLocaleString() を
 * タイムゾーン指定なしで使うと JST と最大9時間ズレる。本ファイルのヘルパーを
 * 経由することで、サーバー環境に依存しないJST基準の値が取得できる。
 *
 * 使用方針（CLAUDE.md 参照）:
 *   - 「現在時刻のJST時刻文字列」が必要な箇所 → getJSTTimeString()
 *   - 「日付の表示文字列」が必要な箇所 → formatJSTDate()
 *   - 「日時の表示文字列」が必要な箇所 → formatJSTDateTime()
 *   - 「JSTの日付文字列（YYYY-MM-DD）」が必要な箇所 → toJSTDateString()
 *   - 「今日のJST 0:00」が必要な箇所 → getTodayJSTStart()
 *
 * 禁止パターン:
 *   - new Date().toLocaleTimeString('en-US', { ... })  ← timeZone 指定なしはUTCになる
 *   - new Date().getHours() で「現在JST時刻」を取得しようとする  ← UTC値が返る
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Date を JST の日付文字列（YYYY-MM-DD）に変換
 */
export function toJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 今日の JST 00:00:00 を Date で返す
 */
export function getTodayJSTStart(): Date {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET_MS,
  );
}

/**
 * Date を JST の時刻文字列（HH:MM、24時間表記）に変換
 * status-updater 等で「JST現在時刻」と「求人の start_time / end_time」を文字列比較する用途
 */
export function getJSTTimeString(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

/**
 * Date を JST の日付表示文字列に変換（ja-JP ロケール）
 * options を指定して曜日付き等の表示も可能
 *
 * @param date 変換対象の Date
 * @param options Intl.DateTimeFormatOptions（timeZone は自動で 'Asia/Tokyo' になる）
 */
export function formatJSTDate(
  date: Date,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  return date.toLocaleDateString('ja-JP', {
    ...options,
    timeZone: 'Asia/Tokyo',
  });
}

/**
 * Date を JST の日時表示文字列に変換（ja-JP ロケール）
 *
 * @param date 変換対象の Date
 * @param options Intl.DateTimeFormatOptions（timeZone は自動で 'Asia/Tokyo' になる）
 */
export function formatJSTDateTime(
  date: Date,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  return date.toLocaleString('ja-JP', {
    ...options,
    timeZone: 'Asia/Tokyo',
  });
}
