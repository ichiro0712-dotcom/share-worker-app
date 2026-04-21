/**
 * 希望勤務曜日の正規化
 *
 * DB カラム `User.desired_work_days` は String[]。
 * 「特になし」と曜日（月〜日）が混在した場合は「特になし」を優先して ['特になし'] を返す。
 *
 * - UI 側（登録フォーム / プロフィール編集）の排他制御と同じルール
 * - 登録 API と updateUserProfile の両方で呼ぶことで、API 層での整合性を担保
 */

const NONE_LABEL = '特になし';
const WEEK_DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;
const VALID_LABELS = new Set<string>([...WEEK_DAY_LABELS, NONE_LABEL]);

export function normalizeDesiredWorkDays(
  raw: readonly string[] | null | undefined
): string[] {
  if (!raw || raw.length === 0) return [];

  // 入力を有効ラベルだけに絞る（未知の文字列を捨てる）
  const filtered = raw.filter((v) => VALID_LABELS.has(v));
  if (filtered.length === 0) return [];

  // 「特になし」が含まれていれば、他をすべて捨てる（排他制御）
  if (filtered.includes(NONE_LABEL)) return [NONE_LABEL];

  // 曜日の順序を月〜日に揃え、重複も排除
  const seen = new Set(filtered);
  return WEEK_DAY_LABELS.filter((d) => seen.has(d));
}
