/**
 * 勤怠情報出力 型定義
 * CROSSNAVI仕様（35項目）に準拠
 */

/**
 * 勤怠情報一覧アイテム（テーブル表示用）
 */
export interface AttendanceInfoItem {
  id: number;
  workDate: Date;
  userName: string;
  userId: number;
  facilityName: string;
  jobTitle: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  status: string;
}

/**
 * 勤怠情報フィルター
 */
export interface AttendanceInfoFilter {
  search: string;
  userName: string;
  facilityName: string;
  workDateFrom: string;
  workDateTo: string;
  status: string;
}

/**
 * 勤怠情報一覧取得パラメータ
 */
export interface GetAttendanceInfoListParams {
  page: number;
  limit: number;
  filters: AttendanceInfoFilter;
}

/**
 * 勤怠情報一覧取得結果
 */
export interface GetAttendanceInfoListResult {
  items: AttendanceInfoItem[];
  total: number;
}

/**
 * CSV出力用勤怠情報
 */
export interface AttendanceWithDetails {
  id: number;
  user_id: number;
  check_in_time: Date;
  check_out_time: Date | null;
  actual_start_time: Date | null;
  actual_end_time: Date | null;
  actual_break_time: number | null;
  status: string;
  user: {
    id: number;
    name: string;
  };
  job: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    break_time: string;
    transportation_fee: number;
    hourly_wage: number;  // 時給（深夜・残業計算に必要）
  } | null;
  facility: {
    id: number;
    facility_name: string;
  };
}
