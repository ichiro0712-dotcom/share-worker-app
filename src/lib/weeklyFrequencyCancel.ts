/**
 * N回以上勤務（weekly_frequency）求人の「振替キャンセル」判定
 *
 * 仕様詳細: docs/weekly-frequency-cancel-swap-plan-2026-0616.md
 *
 * ルール:
 * - weekly_frequency が設定された求人は、ワーカーは最低 N 日まとめて応募する必要がある（既存仕様）
 * - キャンセルで有効応募日数が N を下回る場合、単独キャンセルは不可
 *   → 別日程への「振替（キャンセル＋別日への新規応募）」が必要
 * - 振替できる別日程が無い場合はキャンセル不可（案A: 施設へ個別相談）
 *
 * 判定式: (activeCount - cancelCount + swapCount) >= weeklyFrequency
 */

export interface WeeklyFrequencyCancelArgs {
  /** 対象求人の weekly_frequency（N回以上勤務条件付きなら 2-5、なければ null） */
  weeklyFrequency: number | null;
  /** 現在この求人で有効な（CANCELLED 以外）応募日数 */
  activeCount: number;
  /** 今回キャンセルする件数（通常 1） */
  cancelCount: number;
  /** 今回振替で新規応募する件数（振替しない場合は 0） */
  swapCount: number;
}

export interface WeeklyFrequencyCancelResult {
  /** キャンセル（または振替キャンセル）を実行してよいか */
  allowed: boolean;
  /**
   * 振替が必要か。
   * - true: 単独キャンセルは条件を割るため、別日程への振替が必要
   * - false: 条件を割らない（または条件なし求人）ため単独キャンセル可
   */
  requiresSwap: boolean;
  reason?: string;
}

/**
 * 振替キャンセルの可否判定（純粋関数・DB アクセスなし）
 */
export function canCancelWeeklyFrequency(
  args: WeeklyFrequencyCancelArgs
): WeeklyFrequencyCancelResult {
  const { weeklyFrequency, activeCount, cancelCount, swapCount } = args;

  // 条件なし求人は従来どおり自由にキャンセル可
  if (weeklyFrequency == null || weeklyFrequency < 2) {
    return { allowed: true, requiresSwap: false };
  }

  const remaining = activeCount - cancelCount + swapCount;

  // 条件を満たす（振替込みで N 以上を維持できる）
  if (remaining >= weeklyFrequency) {
    // 振替なしで足りているか、振替込みで足りているか
    return { allowed: true, requiresSwap: swapCount > 0 };
  }

  // 条件を割る → 単独キャンセル不可。振替が必要
  return {
    allowed: false,
    requiresSwap: true,
    reason: `この求人は${weeklyFrequency}回以上の勤務が条件です。単独でキャンセルする場合は、代わりに別の勤務日を選んで振り替えてください。`,
  };
}
