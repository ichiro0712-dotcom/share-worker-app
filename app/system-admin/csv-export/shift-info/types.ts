/**
 * 案件シフト表(代理)出力の型定義
 * CROSSNAVI連携用CSV出力
 */

/**
 * シフト情報一覧表示用アイテム
 */
export interface ShiftInfoItem {
  id: number;
  createdAt: Date;
  workDate: Date;
  jobId: number;
  jobTitle: string;
  facilityName: string;
  corporationName: string;
  recruitmentCount: number;
  startTime: string;
  endTime: string;
}

/**
 * シフト情報フィルター条件
 */
export interface ShiftInfoFilter {
  search: string;
  jobTitle: string;
  facilityName: string;
  workDateFrom: string;
  workDateTo: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * シフト情報一覧取得パラメータ
 */
export interface GetShiftInfoListParams {
  page: number;
  limit: number;
  filters: ShiftInfoFilter;
}

/**
 * シフト情報一覧取得結果
 */
export interface GetShiftInfoListResult {
  items: ShiftInfoItem[];
  total: number;
}

/**
 * CSV出力結果
 */
export interface ExportCsvResult {
  success: boolean;
  csvData?: string;
  count?: number;
  error?: string;
}

/**
 * CSV出力用のシフトデータ（Job/Facility情報含む）
 */
export interface ShiftWithJobAndFacility {
  id: number;
  created_at: Date;
  work_date: Date;
  recruitment_count: number;
  job: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    break_time: string;
    facility: {
      id: number;
      facility_name: string;
      corporation_name: string;
    };
  };
}
