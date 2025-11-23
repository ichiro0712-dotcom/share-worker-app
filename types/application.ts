export type WorkerStatus =
  | 'applied'           // 応募（施設承認待ち）
  | 'scheduled'         // 勤務予定（施設が承認済み）
  | 'working'           // 勤務中
  | 'completed_pending' // 完了・評価待ち
  | 'completed_rated'   // 評価完了
  | 'cancelled';        // キャンセル

export type ReviewStatus = 'pending' | 'completed';

export interface Application {
  id: number;
  job_id: number;
  user_id: number;
  status: WorkerStatus;
  worker_review_status: ReviewStatus;    // ワーカー→施設の評価状態
  facility_review_status: ReviewStatus;  // 施設→ワーカーの評価状態
  message?: string;
  created_at: string;
  updated_at: string;
}
