/**
 * ワーカー情報出力 型定義
 */

/**
 * ワーカー情報一覧アイテム（テーブル表示用）
 */
export interface WorkerInfoItem {
  id: number;
  createdAt: Date;
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
}

/**
 * ワーカー情報フィルター
 */
export interface WorkerInfoFilter {
  search: string;
  name: string;
  email: string;
  phoneNumber: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * ワーカー情報一覧取得パラメータ
 */
export interface GetWorkerInfoListParams {
  page: number;
  limit: number;
  filters: WorkerInfoFilter;
}

/**
 * ワーカー情報一覧取得結果
 */
export interface GetWorkerInfoListResult {
  items: WorkerInfoItem[];
  total: number;
}
