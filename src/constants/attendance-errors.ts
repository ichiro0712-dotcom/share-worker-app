/**
 * QRコード勤怠管理機能 - エラーコード定義
 */

export const ATTENDANCE_ERROR_CODES = {
  /** QRコードが無効です */
  ATT001: 'ATT001',
  /** 緊急時番号が一致しません */
  ATT002: 'ATT002',
  /** 出勤記録が見つかりません */
  ATT003: 'ATT003',
  /** 本日の勤務予定がありません */
  ATT004: 'ATT004',
  /** 緊急番号入力がロックされました */
  ATT005: 'ATT005',
  /** 勤怠変更申請は既に存在します */
  ATT006: 'ATT006',
  /** この申請は承認権限がありません */
  ATT007: 'ATT007',
  /** 認証エラー */
  ATT008: 'ATT008',
  /** 施設が見つかりません */
  ATT009: 'ATT009',
  /** 退勤時間が出勤時間より前です */
  ATT010: 'ATT010',
} as const;

export type AttendanceErrorCode = typeof ATTENDANCE_ERROR_CODES[keyof typeof ATTENDANCE_ERROR_CODES];

/** エラーメッセージ定義 */
export const ATTENDANCE_ERROR_MESSAGES: Record<AttendanceErrorCode, string> = {
  [ATTENDANCE_ERROR_CODES.ATT001]: 'QRコードが無効です。施設に再発行を依頼してください。',
  [ATTENDANCE_ERROR_CODES.ATT002]: '緊急時番号が一致しません。正しい番号を確認してください。',
  [ATTENDANCE_ERROR_CODES.ATT003]: '出勤記録が見つかりません。先に出勤処理を行ってください。',
  [ATTENDANCE_ERROR_CODES.ATT004]: '本日の勤務予定がありません。マッチング済みの勤務を確認してください。',
  [ATTENDANCE_ERROR_CODES.ATT005]: '緊急番号入力がロックされました。施設に連絡してください。',
  [ATTENDANCE_ERROR_CODES.ATT006]: '勤怠変更申請は既に存在します。既存の申請を確認してください。',
  [ATTENDANCE_ERROR_CODES.ATT007]: 'この申請は承認権限がありません。別の管理者に依頼してください。',
  [ATTENDANCE_ERROR_CODES.ATT008]: '認証エラーが発生しました。再度ログインしてください。',
  [ATTENDANCE_ERROR_CODES.ATT009]: '施設が見つかりません。',
  [ATTENDANCE_ERROR_CODES.ATT010]: '退勤時間は出勤時間より後である必要があります。',
};

/** エラーレスポンス型 */
export interface AttendanceErrorResponse {
  success: false;
  error: {
    code: AttendanceErrorCode;
    message: string;
    details?: string;
  };
}

/** エラーレスポンス生成ヘルパー */
export function createAttendanceError(
  code: AttendanceErrorCode,
  details?: string
): AttendanceErrorResponse {
  return {
    success: false,
    error: {
      code,
      message: ATTENDANCE_ERROR_MESSAGES[code],
      details,
    },
  };
}

/** 緊急番号入力制限 */
export const EMERGENCY_CODE_MAX_ERRORS = 5;

/** 勤怠変更申請の最大再申請回数 */
export const MAX_RESUBMIT_COUNT = 3;
