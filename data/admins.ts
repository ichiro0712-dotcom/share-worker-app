import { FacilityAdmin } from '@/types/admin';

// テスト用の施設管理者データ
export const admins: FacilityAdmin[] = [
  {
    id: 1,
    email: 'admin1@example.com',
    password: 'admin123',
    facilityId: 1, // さくら介護ホーム
    name: '山田 太郎',
    phone: '03-1234-5678',
    role: 'admin'
  },
  {
    id: 2,
    email: 'admin2@example.com',
    password: 'admin123',
    facilityId: 26, // みどり総合病院
    name: '鈴木 花子',
    phone: '03-2345-6789',
    role: 'admin'
  },
  {
    id: 3,
    email: 'admin3@example.com',
    password: 'admin123',
    facilityId: 2, // もみじ訪問看護ステーション
    name: '佐藤 次郎',
    phone: '03-3456-7890',
    role: 'admin'
  },
];
