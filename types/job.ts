export type JobStatus =
  | 'draft'       // 下書き
  | 'published'   // 公開中
  | 'stopped'     // 停止中
  | 'working'     // 勤務中
  | 'completed'   // 完了
  | 'cancelled';  // キャンセル

export interface Job {
  id: number;
  facilityId: number;
  templateId?: number; // テンプレートID
  templateName?: string; // テンプレート名
  status: JobStatus;
  title: string;
  workDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakTime: string; // 例: "12:00-13:00"
  wage: number; // 日給
  hourlyWage: number; // 時給
  deadline: string; // ISO 8601
  tags: string[];
  address: string;
  prefecture?: string;
  city?: string;
  addressLine?: string;
  access: string;
  recruitmentCount: number; // 募集人数
  appliedCount: number; // 応募済み人数
  matchedCount?: number; // マッチング済み人数
  transportationFee: number;
  overview: string;
  workContent: string[];
  requiredQualifications: string[];
  requiredExperience: string[];
  dresscode: string[];
  belongings: string[];
  otherConditions: string[];
  managerName: string;
  managerMessage: string;
  managerAvatar: string;
  images: string[];
  badges: Array<{ text: string; type: 'yellow' | 'green' }>;
  // アクセス情報
  transportMethods: Array<{ name: string; available: boolean }>;
  parking: boolean;
  accessDescription: string;
  // 地図情報
  mapImage: string;
  // 特徴タグ（こだわり条件）
  featureTags?: string[];
  // マッチング方法
  requiresInterview?: boolean;
  // 求人種別
  jobType?: 'NORMAL' | 'ORIENTATION' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'OFFER';
  // 勤務日条件
  weeklyFrequency?: number | null; // 2-5回以上勤務条件
  effectiveWeeklyFrequency?: number | null; // 有効なN回以上勤務条件（応募可能日数がN未満なら単発扱いでnull）
  availableWorkDateCount?: number; // 応募可能な勤務日数
  // 募集終了フラグ（期限切れ・定員満了で通常検索から除外された求人）
  isExpired?: boolean;
}
