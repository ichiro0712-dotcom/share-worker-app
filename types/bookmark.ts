export type BookmarkType = 'favorite' | 'watch_later';
export type BookmarkEntity = 'job' | 'worker';

export interface Bookmark {
  id: number;
  user_id?: number;        // ワーカーID（ワーカーが保存した場合）
  facility_id?: number;    // 施設ID（施設が保存した場合）
  entity_type: BookmarkEntity;
  entity_id: number;       // job_id または worker_id
  type: BookmarkType;      // お気に入り または あとで見る
  created_at: string;
}
