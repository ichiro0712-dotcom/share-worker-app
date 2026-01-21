/**
 * QRコード勤怠管理機能 - 型定義
 */

// ================== 基本型 ==================

/** 打刻方法 */
export type AttendanceMethod = 'QR' | 'EMERGENCY_CODE';

/** 退勤タイプ */
export type CheckOutType = 'ON_TIME' | 'MODIFICATION_REQUIRED';

/** 勤怠変更申請ステータス */
export type ModificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';

/** 出勤状態 */
export type AttendanceStatus = 'CHECKED_IN' | 'CHECKED_OUT';

// ================== API リクエスト/レスポンス ==================

/** 出退勤打刻リクエスト */
export interface AttendanceRecordRequest {
  type: 'check_in' | 'check_out';
  method: AttendanceMethod;

  // QRコードの場合
  facilityId?: number;
  qrToken?: string;

  // 緊急時番号の場合
  emergencyCode?: string;

  // 位置情報
  latitude?: number;
  longitude?: number;

  // 退勤の場合
  checkOutType?: CheckOutType;

  // 自動紐付け用
  applicationId?: number;
}

/** 出退勤打刻レスポンス */
export interface AttendanceRecordResponse {
  success: boolean;
  attendanceId?: number;
  message: string;

  // 退勤時の追加情報
  requiresModification?: boolean;
  isLate?: boolean;
  scheduledTime?: {
    startTime: string;
    endTime: string;
    breakTime: number;
  };
}

/** 出勤状態確認レスポンス */
export interface CheckInStatusResponse {
  isCheckedIn: boolean;
  attendanceId?: number;
  checkInTime?: string;
  isLate?: boolean;
  usedEmergencyCode?: boolean;
  facilityName?: string;
  applicationId?: number;
  /** 本日の勤務予定があるか（出勤ボタン表示判定用） */
  hasTodayJob?: boolean;
}

/** 勤怠変更申請作成リクエスト */
export interface CreateModificationRequest {
  attendanceId: number;
  requestedStartTime: string;  // ISO 8601
  requestedEndTime: string;    // ISO 8601
  requestedBreakTime: number;  // 分
  workerComment: string;
}

/** 勤怠変更申請作成レスポンス */
export interface CreateModificationResponse {
  success: boolean;
  modificationId?: number;
  originalAmount?: number;
  requestedAmount?: number;
  difference?: number;
  message?: string;
}

/** 勤怠変更申請更新（再申請）リクエスト */
export interface UpdateModificationRequest {
  requestedStartTime: string;
  requestedEndTime: string;
  requestedBreakTime: number;
  workerComment: string;
}

/** 承認/却下リクエスト */
export interface ApproveRejectRequest {
  adminComment: string;
}

/** 承認/却下レスポンス */
export interface ApproveRejectResponse {
  success: boolean;
  message: string;
}

// ================== データ型 ==================

/** 勤怠記録（詳細） */
export interface AttendanceDetail {
  id: number;
  userId: number;
  facilityId: number;
  applicationId: number | null;
  jobId: number | null;

  checkInTime: Date;
  checkOutTime: Date | null;

  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;

  checkInMethod: AttendanceMethod;
  checkOutMethod: AttendanceMethod | null;
  checkOutType: CheckOutType | null;

  status: AttendanceStatus;

  actualStartTime: Date | null;
  actualEndTime: Date | null;
  actualBreakTime: number | null;
  calculatedWage: number | null;

  createdAt: Date;
  updatedAt: Date;

  // リレーション
  user?: {
    id: number;
    name: string;
    email: string;
    profileImage: string | null;
  };
  facility?: {
    id: number;
    facilityName: string;
  };
  application?: {
    id: number;
    workDate: {
      workDate: Date;
      job: {
        id: number;
        title: string;
        startTime: string;
        endTime: string;
        breakTime: string;
        hourlyWage: number;
        transportationFee: number;
      };
    };
  };
  modificationRequest?: ModificationRequestDetail | null;
}

/** 勤怠変更申請（詳細） */
export interface ModificationRequestDetail {
  id: number;
  attendanceId: number;

  requestedStartTime: Date;
  requestedEndTime: Date;
  requestedBreakTime: number;
  workerComment: string;

  status: ModificationStatus;

  adminComment: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;

  originalAmount: number;
  requestedAmount: number;

  resubmitCount: number;

  createdAt: Date;
  updatedAt: Date;

  // リレーション
  attendance?: AttendanceDetail;
}

/** 勤怠履歴アイテム（一覧用） */
export interface AttendanceHistoryItem {
  id: number;
  checkInTime: Date;
  checkOutTime: Date | null;
  status: AttendanceStatus;
  facilityName: string;
  jobTitle: string;
  workDate: Date;
  hasModificationRequest: boolean;
  modificationStatus: ModificationStatus | null;
  calculatedWage: number | null;
}

/** 施設管理者向け承認待ちアイテム */
export interface PendingModificationItem {
  id: number;
  attendanceId: number;
  workerName: string;
  workerId: number;
  jobId: number;
  jobTitle: string;
  workDate: Date;
  status: ModificationStatus;
  requestedStartTime: Date;
  requestedEndTime: Date;
  requestedBreakTime: number;
  originalAmount: number;
  requestedAmount: number;
  workerComment: string;
  createdAt: Date;
  resubmitCount: number;
}

// ================== QRコード関連 ==================

/** QRコードデータ */
export interface QRCodeData {
  facilityId: number;
  secretToken: string;
  generatedAt: string;
}

/** QRコード再発行レスポンス */
export interface RegenerateQRResponse {
  success: boolean;
  qrToken?: string;
  generatedAt?: string;
  message?: string;
}

// ================== フィルター/ソート ==================

/** 勤怠一覧フィルター */
export interface AttendanceFilter {
  facilityId?: number;
  workerId?: number;
  status?: AttendanceStatus;
  modificationStatus?: ModificationStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

/** ソートオプション */
export interface AttendanceSortOption {
  field: 'checkInTime' | 'createdAt' | 'workDate';
  direction: 'asc' | 'desc';
}

// ================== CSV出力 ==================

/** CSV出力フィルター */
export interface AttendanceExportFilter {
  facilityId?: number;
  dateFrom: Date;
  dateTo: Date;
  includeModificationRequests?: boolean;
}

/** CSV出力行 */
export interface AttendanceExportRow {
  workDate: string;
  workerName: string;
  workerId: number;
  facilityName: string;
  jobTitle: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  scheduledBreakTime: number;
  actualStartTime: string;
  actualEndTime: string;
  actualBreakTime: number;
  checkInMethod: string;
  checkOutMethod: string;
  calculatedWage: number;
  modificationStatus: string;
}
