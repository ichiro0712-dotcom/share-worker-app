/**
 * プールスタッフ情報出力 型定義
 * CROSSNAVI仕様（48項目）に準拠
 */

/**
 * スタッフ情報一覧アイテム（テーブル表示用）
 */
export interface StaffInfoItem {
  id: number;
  createdAt: Date;
  name: string;
  phoneNumber: string;
  email: string;
  prefecture: string | null;
  city: string | null;
}

/**
 * スタッフ情報フィルター
 */
export interface StaffInfoFilter {
  search: string;
  staffId: string;
  name: string;
  phoneNumber: string;
  email: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * スタッフ情報一覧取得パラメータ
 */
export interface GetStaffInfoListParams {
  page: number;
  limit: number;
  filters: StaffInfoFilter;
}

/**
 * スタッフ情報一覧取得結果
 */
export interface GetStaffInfoListResult {
  items: StaffInfoItem[];
  total: number;
}

/**
 * CSV出力用スタッフ情報（銀行口座含む）
 */
export interface StaffWithBankAccount {
  id: number;
  created_at: Date;
  name: string;
  phone_number: string;
  email: string;
  birth_date: Date | null;
  gender: string | null;
  last_name_kana: string | null;
  first_name_kana: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line: string | null;
  building: string | null;
  bankAccount: {
    bankCode: string;
    branchCode: string;
    accountType: string;
    accountNumber: string;
    accountHolderName: string;
  } | null;
}
