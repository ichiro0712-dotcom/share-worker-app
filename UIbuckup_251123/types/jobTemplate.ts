export interface JobTemplate {
  id: number;
  facility_id: number;      // 施設ID（テンプレートは施設に紐づく）
  name: string;             // テンプレート名
  title: string;            // 求人タイトル
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  break_time: number;       // 休憩時間（分）
  hourly_wage: number;      // 時給
  transportation_fee: number;
  recruitment_count: number; // 募集人数
  qualifications: string[]; // 必要資格
  description: string;      // 仕事内容
  skills: string[];         // スキル・経験（5件まで）
  dresscode: string[];      // 服装・身だしなみ（5件まで）
  belongings: string[];     // 持ち物・その他（5件まで）
  images: string[];         // デフォルト画像（この施設のデフォルト画像として使用）
  notes: string;            // 備考
  tags: string[];
  created_at: string;
  updated_at: string;
}
