/**
 * 取引先情報出力の型定義
 */

/**
 * 取引先情報一覧表示用アイテム
 */
export interface ClientInfoItem {
  id: number;
  createdAt: Date;
  corporationNumber: string | null;
  corporationName: string;
  facilityName: string;
}

/**
 * 取引先情報フィルター条件
 */
export interface ClientInfoFilter {
  search: string;
  corporationNumber: string;
  corporationName: string;
  facilityName: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * 取引先情報一覧取得パラメータ
 */
export interface GetClientInfoListParams {
  page: number;
  limit: number;
  filters: ClientInfoFilter;
}

/**
 * 取引先情報一覧取得結果
 */
export interface GetClientInfoListResult {
  items: ClientInfoItem[];
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
