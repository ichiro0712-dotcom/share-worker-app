export interface FacilityAdmin {
  id: number;
  email: string;
  password: string; // 本番環境ではハッシュ化が必要
  facilityId: number; // 管理する施設のID
  name: string; // 管理者名
  phone?: string;
  role: 'admin'; // ユーザーと区別するためのロール
}
