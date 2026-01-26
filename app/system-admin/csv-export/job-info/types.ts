/**
 * 案件情報(代理)出力の型定義
 * CROSSNAVI連携用CSV出力
 */

/**
 * 案件情報一覧表示用アイテム
 */
export interface JobInfoItem {
  id: number;
  createdAt: Date;
  title: string;
  facilityId: number;
  facilityName: string;
  corporationName: string;
  hourlyWage: number;
  status: string;
}

/**
 * 案件情報フィルター条件
 */
export interface JobInfoFilter {
  search: string;
  jobTitle: string;
  facilityName: string;
  corporationName: string;
  dateFrom: string;
  dateTo: string;
  status: string;
}

/**
 * 案件情報一覧取得パラメータ
 */
export interface GetJobInfoListParams {
  page: number;
  limit: number;
  filters: JobInfoFilter;
}

/**
 * 案件情報一覧取得結果
 */
export interface GetJobInfoListResult {
  items: JobInfoItem[];
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
 * CSV出力用の案件データ（Facility情報含む）
 */
export interface JobWithFacility {
  id: number;
  created_at: Date;
  title: string;
  start_time: string;
  end_time: string;
  break_time: string;
  hourly_wage: number;
  transportation_fee: number;
  overview: string;
  work_content: string[];
  status: string;
  facility: {
    id: number;
    facility_name: string;
    corporation_name: string;
    postal_code: string | null;
    prefecture: string | null;
    city: string | null;
    address_line: string | null;
    phone_number: string | null;
    contact_person_last_name: string | null;
    contact_person_first_name: string | null;
    manager_last_name: string | null;
    manager_first_name: string | null;
    smoking_measure: string | null;
    // 法人住所
    corp_postal_code: string | null;
    corp_prefecture: string | null;
    corp_city: string | null;
    corp_address_line: string | null;
  };
}
