/**
 * 求人の必要資格とワーカーの保有資格をマッチング判定するヘルパー
 *
 * 仕様（クライアント確定 2026-06-01）:
 * - 求人の required_qualifications が空配列: 資格不問。全ワーカー応募可
 * - required_qualifications に '無資格可' を含む: 全ワーカー応募可
 * - それ以外: 求人作成時に選択された資格を「完全一致」で1つ以上保有していれば応募可
 *   （選択された資格を持っていないワーカーは応募不可）
 *
 * 別名（同一視する資格）:
 * - '正看護師' は '看護師' と同一視（現行の資格選択肢に '正看護師' は存在しないが、
 *   旧データに残っている可能性があるため救済する）
 *
 * 別物として扱う資格（マッピングしない・クライアント明示）:
 * - 'ヘルパー2級' と '初任者研修'
 * - 'ヘルパー1級' と '実務者研修'
 */

/** 資格不問を表す特別値 */
export const NO_QUALIFICATION_REQUIRED = '無資格可';

/**
 * 別名グループ。同一グループ内の資格は同一視する。
 * 完全一致を原則とするため、最小限の別名のみ定義する。
 */
const QUALIFICATION_ALIAS_GROUPS: string[][] = [
  ['看護師', '正看護師'],
];

/** 資格名を正規化（別名は代表名へ寄せる） */
function normalizeQualification(qualification: string): string {
  for (const group of QUALIFICATION_ALIAS_GROUPS) {
    if (group.includes(qualification)) return group[0];
  }
  return qualification;
}

/**
 * ある資格名と同一視される資格名の一覧を返す（自分自身を含む）。
 * Prisma の hasSome フィルタ用に、別名を展開する目的で使用。
 */
export function expandQualificationAliases(qualification: string): string[] {
  for (const group of QUALIFICATION_ALIAS_GROUPS) {
    if (group.includes(qualification)) return [...group];
  }
  return [qualification];
}

/**
 * ワーカーの保有資格リストを、求人マッチング用に別名展開する。
 * 検索フィルタ（hasSome）で使用。
 */
export function expandUserQualificationsForJobMatch(
  userQualifications: string[]
): string[] {
  const expanded = userQualifications.flatMap(expandQualificationAliases);
  return Array.from(new Set(expanded));
}

/**
 * 個別求人 vs ワーカー保有資格の応募可否判定
 * 詳細ページ・応募サーバーアクションで使用
 */
export function canApplyByQualification(
  requiredQualifications: string[] | null | undefined,
  userQualifications: string[] | null | undefined
): { allowed: boolean; reason?: string } {
  const required = requiredQualifications ?? [];

  // 資格不問（空配列 or 無資格可）は全員応募可
  if (required.length === 0) return { allowed: true };
  if (required.includes(NO_QUALIFICATION_REQUIRED)) return { allowed: true };

  const userSet = new Set((userQualifications ?? []).map(normalizeQualification));
  const allowed = required.some(
    (req) => userSet.has(normalizeQualification(req))
  );

  if (allowed) return { allowed: true };

  return {
    allowed: false,
    reason: `この求人は「${required.join('、')}」のいずれかの資格が必要なため応募できません`,
  };
}
