/**
 * Actions Module - Barrel Export
 *
 * このファイルは @/src/lib/actions からのエクスポートを提供します。
 * 現在は後方互換性のため、すべてのアクションを ../actions.ts から再エクスポートしています。
 *
 * 将来的にはドメイン別に分割したファイルから直接エクスポートする予定:
 * - jobs.ts: 求人関連 (getJobs, getJobById, createJobs, updateJob, deleteJobs, etc.)
 * - applications.ts: 応募関連 (applyForJob, getMyApplications, updateApplicationStatus, etc.)
 * - users.ts: ユーザー関連 (getUserProfile, updateUserProfile, etc.)
 * - bookmarks.ts: ブックマーク関連 (addJobBookmark, removeJobBookmark, etc.)
 * - messages.ts: メッセージ関連 (getConversations, getMessages, sendMessage, etc.)
 * - reviews.ts: レビュー関連 (submitReview, getMyReviews, etc.)
 * - notifications.ts: 通知関連 (getUserNotifications, markNotificationAsRead, etc.)
 * - facilities.ts: 施設関連 (getFacilityById, getFacilityInfo, etc.)
 * - admin.ts: 管理者関連 (authenticateFacilityAdmin, getAdminDashboardStats, etc.)
 * - templates.ts: テンプレート関連 (getAdminJobTemplates, createJobTemplate, etc.)
 * - workers.ts: ワーカー管理関連 (getWorkerDetail, getWorkerListForFacility, etc.)
 */

// ヘルパー関数と型定義
export {
  getAuthenticatedUser,
  formatDate,
  formatDateWithDay,
  formatMessageTime,
  calculateAgeGroup,
  type JobSearchParams,
  type CreateJobInput,
  type WorkerListItem,
  type WorkerListSearchParams,
  type WorkerListStatus,
} from './helpers';

export * from './auth';
export * from './job-worker';
export * from './job-management';
export * from './job-template';
export * from './application-worker';
export * from './application-admin';
export * from './facility-info';
export * from './facility-account';
export * from './user-profile';
export * from './notification';
export * from './message';
export * from './review-worker';
export * from './review-admin';
export * from './labor-document-shift';
