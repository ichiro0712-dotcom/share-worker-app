export type WorkerStatus = 'applied' | 'scheduled' | 'working' | 'completed_pending' | 'completed_rated';
export type ProfessionType = 'nursing' | 'care' | 'pharmacy';

export interface WorkerApplication {
  id: number;
  workerId: number;
  jobId: number;
  jobTitle: string;
  jobDate: string;
  facilityName: string;
  status: WorkerStatus;
  appliedAt: string;
  completedAt?: string;
  ratedAt?: string;
  lastWorkDate?: string; // 最終勤務日（応募以外）
  isFavorite?: boolean; // お気に入り
  isBlocked?: boolean; // ブロック
  isClipped?: boolean; // クリップ（後で見る）応募ワーカーのみ
  isRead?: boolean; // 既読フラグ
}

export interface WorkerProfile {
  id: number;
  name: string;
  photoUrl?: string;
  age: string;
  gender: string;
  prefecture: string;
  city: string;
  address?: string;
  phone: string;
  email: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };

  // 資格・経験
  profession: ProfessionType; // 職種
  qualifications: string[];
  careExperience: string;
  nursingExperience?: string;
  specialSkills: string[];

  // 希望条件
  preferredServiceTypes: string[];
  preferredWorkTimes: string[];
  transportation: string[];

  // 評価関連
  overallRating: number; // 総合評価（0-5）
  ratingBreakdown: {
    skill: number; // 技術力
    attitude: number; // 態度
    punctuality: number; // 時間厳守
    communication: number; // コミュニケーション
  };
  totalReviews: number;

  // 勤務実績
  totalWorkDays: number;
  cancelRate: number; // キャンセル率（%）
  lastMinuteCancelRate: number; // 直前キャンセル率（%）
}

export interface WorkHistory {
  id: number;
  workerId: number;
  facilityId: number;
  facilityName: string;
  workCount: number; // 勤務回数
  averageRating: number; // その施設での平均評価
  lastWorkDate: string;
}

export interface WorkerEvaluation {
  id: number;
  workerId: number;
  facilityId: number;
  facilityName: string;
  jobDate: string;
  skill: number;
  attitude: number;
  punctuality: number;
  communication: number;
  comment?: string;
  createdAt: string;
}
