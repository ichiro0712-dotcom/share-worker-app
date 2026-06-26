/**
 * 勤務実績なしワーカーの応募求人数制限
 *
 * 仕様詳細: docs/beginner-application-limit-plan-2026-0616.md
 *
 * 制限ルール:
 * - 「勤務実績なし」= Application.worker_review_status === 'COMPLETED' が 0 件
 * - 同時応募の上限 (BEGINNER_APPLICATION_LIMIT, default 2)
 * - 1件完了で恒久解除
 * - オファー・限定求人 (OFFER / LIMITED_WORKED / LIMITED_FAVORITE / ORIENTATION) は対象外
 * - weekly_frequency >= 2 の求人には初心者は応募不可
 */

export const BEGINNER_LIMIT_EXEMPT_JOB_TYPES = [
  'OFFER',
  'LIMITED_WORKED',
  'LIMITED_FAVORITE',
  'ORIENTATION',
] as const;

export type BeginnerLimitExemptJobType = (typeof BEGINNER_LIMIT_EXEMPT_JOB_TYPES)[number];

/**
 * 求人が初心者上限の判定対象か（true: 判定する / false: 例外として判定しない）
 */
export function isJobSubjectToBeginnerLimit(jobType: string | null | undefined): boolean {
  if (!jobType) return true;
  return !BEGINNER_LIMIT_EXEMPT_JOB_TYPES.includes(jobType as BeginnerLimitExemptJobType);
}

export interface BeginnerLimitCheckArgs {
  /** 勤務実績なしフラグ（worker_review_status='COMPLETED' が 0 件で true） */
  isBeginner: boolean;
  /** 現在の有効応募件数（APPLIED/SCHEDULED/WORKING/COMPLETED_PENDING） */
  ongoingCount: number;
  /** 上限値（SystemSetting BEGINNER_APPLICATION_LIMIT） */
  limit: number;
  /** 対象求人の weekly_frequency（N回以上勤務条件付きなら 2-5、なければ null） */
  jobWeeklyFrequency: number | null;
}

export interface BeginnerLimitCheckResult {
  allowed: boolean;
  reason?: string;
  /** 不可理由の分類（UI 側で文言差し替えやアイコン分岐に使える） */
  errorKind?: 'WEEKLY_FREQUENCY' | 'LIMIT_REACHED';
}

/**
 * 初心者応募上限の判定（純粋関数・DB アクセスなし）
 *
 * 呼び出し側で {isBeginner, ongoingCount, limit, jobWeeklyFrequency} を用意して渡す。
 */
export function canApplyByBeginnerLimit(
  args: BeginnerLimitCheckArgs
): BeginnerLimitCheckResult {
  if (!args.isBeginner) {
    return { allowed: true };
  }

  if (args.jobWeeklyFrequency != null && args.jobWeeklyFrequency >= 2) {
    return {
      allowed: false,
      errorKind: 'WEEKLY_FREQUENCY',
      reason: '勤務実績のあるワーカーのみ応募可能な求人です。初回勤務後にご応募ください。',
    };
  }

  if (args.ongoingCount >= args.limit) {
    return {
      allowed: false,
      errorKind: 'LIMIT_REACHED',
      reason: `勤務実績のないワーカーは同時${args.limit}件まで応募可能です。1件勤務完了後（施設へのレビュー送信後）に解除されます。`,
    };
  }

  return { allowed: true };
}
