/**
 * 出勤打刻の二重生成ガード（純粋関数）
 *
 * 背景: 出勤打刻の二度押し・QRコードの連続読み取り・退勤後の再出勤などにより、
 *       1つの応募(Application)に対して複数の勤怠(Attendance)が作られる不具合があった。
 *       サーバー側で既存勤怠の状態から「新規作成 / 既存返却 / ブロック」を判定する。
 *
 * 判定ロジックはDBアクセスから切り離し、ここで純粋関数として定義してユニットテスト可能にする。
 */

/** 判定に必要な既存勤怠の最小情報 */
export interface ExistingAttendanceLite {
  id: number;
  /** "CHECKED_IN" | "CHECKED_OUT" */
  status: string;
  check_out_time: Date | null;
}

/** 二重出勤判定の結果 */
export type CheckInDuplicateDecision =
  /** 新規に勤怠を作成してよい */
  | { action: 'CREATE' }
  /** 既に未退勤の勤怠がある。新規作成せず既存を返す（冪等） */
  | { action: 'RETURN_EXISTING'; attendanceId: number }
  /** 同一応募で退勤済み。二重出勤としてブロックする */
  | { action: 'BLOCK' };

/**
 * 既存勤怠の状態から出勤打刻時の挙動を判定する。
 *
 * @param existing   同一応募、または当日・同一施設の未退勤勤怠。存在しなければ null。
 * @param hasApplication 当日応募に紐付いているか（緊急番号で応募なしの場合は false）。
 */
export function decideCheckInDuplicate(
  existing: ExistingAttendanceLite | null,
  hasApplication: boolean
): CheckInDuplicateDecision {
  // 既存勤怠がなければ通常どおり新規作成
  if (!existing) {
    return { action: 'CREATE' };
  }

  // 未退勤(CHECKED_IN かつ check_out_time が未設定) → 既に出勤済みとみなし冪等化
  const isOpen = existing.status === 'CHECKED_IN' && existing.check_out_time === null;
  if (isOpen) {
    return { action: 'RETURN_EXISTING', attendanceId: existing.id };
  }

  // 退勤済み(CHECKED_OUT)
  //  - 応募に紐付いている場合: 同一応募の再出勤は二重勤務になるためブロック
  //  - 応募なし(緊急番号等)の場合: 呼び出し側は未退勤のみを渡す想定だが、
  //    退勤済みしか無いなら別勤務の可能性があるため作成を許可（安全側）
  if (hasApplication) {
    return { action: 'BLOCK' };
  }

  return { action: 'CREATE' };
}
