'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  UserCircle,
  Calendar,
  Users,
  Briefcase,
  Search,
  X,
  CheckCircle,
  Heart,
  Ban,
  FileText,
  CalendarDays
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useErrorToast } from '@/components/ui/PersistentErrorToast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import JobApplicationModal from '@/components/admin/JobApplicationModal';
import { MonthlyShiftView } from '@/components/admin/MonthlyShiftView';
import { useAuth } from '@/contexts/AuthContext';
import {
  getJobsWithApplications,
  getApplicationsByWorker,
  updateApplicationStatus,
  toggleWorkerFavorite,
  toggleWorkerBlock,
  markJobApplicationsAsViewed,
  markWorkerApplicationsAsViewed,
} from '@/src/lib/actions';
import { getQualificationAbbreviations } from '@/src/lib/content-actions';
import { Pagination } from '@/components/ui/Pagination';
import { useApplicationsByJob, useApplicationsByWorker } from '@/hooks/useApplications';
import { ApplicationsSkeleton } from '@/components/admin/ApplicationsSkeleton';

// 型定義
interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

interface Worker {
  id: number;
  name: string;
  profileImage: string | null;
  qualifications: string[];
}

interface Application {
  id: number;
  status: string;
  cancelledBy?: 'WORKER' | 'FACILITY' | null;
  createdAt: string | Date;
  worker: Worker;
  rating: number | null;
  reviewCount: number;
  lastMinuteCancelRate: number;
}

interface WorkDate {
  id: number;
  date: string;
  formattedDate: string;
  recruitmentCount: number;
  appliedCount: number;
  matchedCount: number;
  applications: Application[];
}

interface JobWithApplications {
  id: number;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  hourlyWage: number;
  transportationFee?: number;
  workContent: string[];
  requiredQualifications: string[];
  requiresInterview: boolean;
  totalRecruitment: number;
  totalApplied: number;
  totalMatched: number;
  dateRange: string;
  workDates: WorkDate[];
  unviewedCount: number; // 未確認応募数
}

// ワーカービュー用の型
interface WorkerWithApplications {
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location: string | null;
    rating: number | null;
    reviewCount: number;
    totalWorkDays: number;
    lastMinuteCancelRate: number;
    experienceFields: Array<{ field: string; years: string }>;
    isFavorite: boolean;
    isBlocked: boolean;
  };
  applications: {
    id: number;
    status: string;
    cancelledBy?: 'WORKER' | 'FACILITY' | null;
    createdAt: string;
    isUnviewed?: boolean; // 未確認フラグ
    job: {
      id: number;
      title: string;
      workDate: string;
      startTime: string;
      endTime: string;
      hourlyWage: number;
      requiresInterview: boolean;
    };
  }[];
  unviewedCount: number; // ワーカーごとの未確認応募数
}

// 経験職種の略称を取得するヘルパー関数
const getAbbreviation = (field: string) => {
  const map: Record<string, string> = {
    '特別養護老人ホーム': '特養',
    '介護老人保健施設': '老健',
    '介護付き有料老人ホーム': '有料',
    '住宅型有料老人ホーム': '住宅型',
    'サービス付き高齢者向け住宅': 'サ高住',
    'グループホーム': 'GH',
    'デイサービス': 'デイ',
    '訪問介護': '訪問',
    '小規模多機能型居宅介護': '小多機',
    '看護小規模多機能型居宅介護': '看多機',
  };
  return map[field] || field;
};

// 経験分野に応じた色を取得するヘルパー関数（ワーカー詳細ページと統一）
const getExperienceColorByField = (field: string): string => {
  const colors: Record<string, string> = {
    '特別養護老人ホーム': 'bg-blue-600',
    '介護老人保健施設': 'bg-indigo-600',
    '介護付き有料老人ホーム': 'bg-pink-600',
    '住宅型有料老人ホーム': 'bg-pink-500',
    'サービス付き高齢者向け住宅': 'bg-teal-600',
    'グループホーム': 'bg-purple-600',
    'デイサービス': 'bg-orange-500',
    '訪問介護': 'bg-green-600',
    '小規模多機能型居宅介護': 'bg-cyan-600',
    '看護小規模多機能型居宅介護': 'bg-emerald-600',
    '有料老人ホーム': 'bg-pink-600',
  };
  return colors[field] || 'bg-gray-500';
};

function ApplicationsContent() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  // タブ切り替え状態
  const [viewMode, setViewMode] = useState<'jobs' | 'workers' | 'shift'>('jobs');

  // フィルタ・検索状態
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'stopped' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  // 検索クエリのデバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // 検索条件変更時はページを1に戻す
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // フィルタ変更時にページをリセット
  useEffect(() => {
    setPage(1);
  }, [statusFilter, viewMode]);

  // モーダル状態
  const [selectedJob, setSelectedJob] = useState<JobWithApplications | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithApplications | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<number>>(new Set());

  // ワーカーの状態管理（お気に入り・ブロック）
  const [workerStates, setWorkerStates] = useState<Record<number, { isFavorite: boolean; isBlocked: boolean }>>({});


  // 資格略称マッピング
  const [qualificationAbbreviations, setQualificationAbbreviations] = useState<Record<string, string>>({});
  useEffect(() => {
    const fetchAbbreviations = async () => {
      try {
        const abbreviations = await getQualificationAbbreviations();
        setQualificationAbbreviations(abbreviations);
      } catch (error) {
        console.error('Failed to fetch abbreviations:', error);
      }
    };
    fetchAbbreviations();
  }, []);

  // URLパラメータからタブを復元
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'workers') {
      setViewMode('workers');
    } else if (tab === 'jobs') {
      setViewMode('jobs');
    } else if (tab === 'shift') {
      setViewMode('shift');
    }
  }, [searchParams]);

  // 認証チェック
  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // SWRでデータ取得
  const {
    jobs = [],
    pagination: jobsPagination,
    isLoading: isJobsLoading,
    mutate: mutateJobs,
  } = useApplicationsByJob({
    facilityId: admin?.facilityId,
    page: viewMode === 'jobs' ? page : 1,
    status: statusFilter,
    query: debouncedQuery,
  });

  const {
    workers = [],
    pagination: workersPagination,
    isLoading: isWorkersLoading,
    mutate: mutateWorkers,
  } = useApplicationsByWorker({
    facilityId: admin?.facilityId,
    page: viewMode === 'workers' ? page : 1,
    query: debouncedQuery,
  });

  const isLoading = isJobsLoading || isWorkersLoading;

  // タブバッジの計算
  const tabBadges = useMemo(() => ({
    byJob: jobs.reduce((sum, j) => sum + (j.unviewedCount || 0), 0),
    byWorker: workers.filter(w => (w.unviewedCount || 0) > 0).length,
  }), [jobs, workers]);

  // ワーカー状態の同期 (SWRの結果が更新された時に反映)
  useEffect(() => {
    if (workers.length > 0) {
      const initialStates: Record<number, { isFavorite: boolean; isBlocked: boolean }> = {};
      workers.forEach(w => {
        initialStates[w.worker.id] = {
          isFavorite: w.worker.isFavorite,
          isBlocked: w.worker.isBlocked
        };
      });
      setWorkerStates(initialStates);
    }
  }, [workers]);

  // 選択中のアイテム更新 (SWRの結果が更新された時に反映)
  useEffect(() => {
    if (selectedJob) {
      const updatedJob = jobs.find((j: any) => j.id === selectedJob.id);
      if (updatedJob) setSelectedJob(updatedJob);
    }
  }, [jobs]);

  useEffect(() => {
    if (selectedWorker) {
      const updatedWorker = workers.find((w: any) => w.worker.id === selectedWorker.worker.id);
      if (updatedWorker) setSelectedWorker(updatedWorker);
    }
  }, [workers]);

  // ステータス更新処理
  // ステータス更新処理
  const { showError } = useErrorToast();

  const handleStatusUpdate = async (applicationId: number, newStatus: string, confirmMessage?: string) => {
    if (!admin?.facilityId) return;
    if (confirmMessage && !confirm(confirmMessage)) return;

    // スナップショット保存
    const prevJobs = jobs;
    const prevWorkers = workers;
    const prevSelectedJob = selectedJob;
    const prevSelectedWorker = selectedWorker;

    // 楽観的更新関数
    const updateAppStatus = (apps: Application[]) =>
      apps.map(app => app.id === applicationId ? { ...app, status: newStatus } : app);

    // 1. Jobs更新
    const nextJobs = jobs.map(job => ({
      ...job,
      workDates: job.workDates.map(wd => ({
        ...wd,
        applications: updateAppStatus(wd.applications)
      }))
    }));
    // 楽観的更新
    if (jobsPagination) {
      mutateJobs({ data: nextJobs, pagination: jobsPagination }, false);
    }
    const nextWorkers = workers.map(w => ({
      ...w,
      applications: w.applications.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    }));
    if (workersPagination) {
      mutateWorkers({ data: nextWorkers, pagination: workersPagination }, false);
    }

    // 3. 選択中アイテム更新
    if (selectedJob) {
      setSelectedJob({
        ...selectedJob,
        workDates: selectedJob.workDates.map(wd => ({
          ...wd,
          applications: updateAppStatus(wd.applications)
        }))
      });
    }
    if (selectedWorker) {
      setSelectedWorker({
        ...selectedWorker,
        applications: selectedWorker.applications.map(app =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      });
    }

    // 完了メッセージ（楽観的）
    toast.success('ステータスを更新しました');
    setIsUpdating(applicationId); // ローディング表示は一瞬だけ出すか、あるいは出さないか。ここでは非同期処理中であることを示すために残す

    try {
      const result = await updateApplicationStatus(applicationId, newStatus as any, admin.facilityId);

      if (result.success) {
        // 成功時はバックグラウンドで最新データを取得（整合性確保）
        mutateJobs();
        mutateWorkers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: '応募ステータス更新',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { applicationId, newStatus, facilityId: admin.facilityId }
      });
      console.error('Failed to update status:', error);
      // ロールバック
      // ロールバック
      if (jobsPagination) {
        mutateJobs({ data: prevJobs, pagination: jobsPagination }, false);
      }
      if (workersPagination) {
        mutateWorkers({ data: prevWorkers, pagination: workersPagination }, false);
      }
      setSelectedJob(prevSelectedJob);
      setSelectedWorker(prevSelectedWorker);

      showError('MATCH_ERROR', '更新に失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  // 一括マッチング処理
  const handleMatchAll = async (workDateId: number, applications: Application[]) => {
    if (!admin?.facilityId) return;

    const targetApps = applications.filter(app => app.status === 'APPLIED');
    if (targetApps.length === 0) return;

    if (!confirm(`${targetApps.length}件の応募を一括でマッチングしますか？`)) return;

    let successCount = 0;

    // 並列処理だとDBロックの可能性があるため、直列で実行
    for (const app of targetApps) {
      setIsUpdating(app.id);
      try {
        const result = await updateApplicationStatus(app.id, 'SCHEDULED', admin.facilityId);
        if (result.success) successCount++;
      } catch (error) {
        const debugInfo = extractDebugInfo(error);
        showDebugError({
          type: 'update',
          operation: '一括マッチング(個別失敗)',
          message: debugInfo.message,
          details: debugInfo.details,
          stack: debugInfo.stack,
          context: { applicationId: app.id, facilityId: admin.facilityId }
        });
        console.error(`Failed to match app ${app.id}:`, error);
      }
    }

    setIsUpdating(null);
    toast.success(`${successCount}件のマッチングが完了しました`);
    mutateJobs();
    mutateWorkers();
  };

  // お気に入り切り替え
  const handleToggleFavorite = async (e: React.MouseEvent, workerId: number) => {
    e.stopPropagation();
    if (!admin?.facilityId) return;

    // 楽観的UI更新
    setWorkerStates(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        isFavorite: !prev[workerId]?.isFavorite
      }
    }));

    try {
      const result = await toggleWorkerFavorite(workerId, admin.facilityId);
      if (!result.success) {
        // 失敗したら戻す
        mutateWorkers();
        toast.error('お気に入りの更新に失敗しました');
      } else {
        toast.success(result.isFavorite ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
        mutateWorkers();
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: 'ワーカーお気に入りトグル',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { workerId, facilityId: admin?.facilityId }
      });
      console.error('Failed to toggle favorite:', error);
      // エラー時も戻す
      setWorkerStates(prev => ({
        ...prev,
        [workerId]: {
          ...prev[workerId],
          isFavorite: !prev[workerId]?.isFavorite
        }
      }));
    }
  };

  // ブロック切り替え
  const handleToggleBlock = async (e: React.MouseEvent, workerId: number) => {
    e.stopPropagation();
    if (!admin?.facilityId) return;

    if (!workerStates[workerId]?.isBlocked && !confirm('このワーカーをブロックしますか？\nブロックすると、今後このワーカーからの応募は受け付けられなくなります。')) {
      return;
    }

    // 楽観的UI更新
    setWorkerStates(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        isBlocked: !prev[workerId]?.isBlocked
      }
    }));

    try {
      const result = await toggleWorkerBlock(workerId, admin.facilityId);
      if (!result.success) {
        // 失敗したら戻す
        mutateWorkers();
        toast.error('ブロックの更新に失敗しました');
      } else {
        toast.success(result.isBlocked ? 'ブロックしました' : 'ブロックを解除しました');
        mutateWorkers();
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: 'ワーカーブロックトグル',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { workerId, facilityId: admin?.facilityId }
      });
      console.error('Failed to toggle block:', error);
      // エラー時も戻す
      setWorkerStates(prev => ({
        ...prev,
        [workerId]: {
          ...prev[workerId],
          isBlocked: !prev[workerId]?.isBlocked
        }
      }));
    }
  };

  // フィルタリング (サーバーサイドに移行したため、ここでは単純にデータを通す)
  const filteredJobs = jobs;
  const filteredWorkers = workers;

  // 日付ごとの展開切り替え
  const toggleDateExpand = (dateId: number) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateId)) {
        newSet.delete(dateId);
      } else {
        newSet.add(dateId);
      }
      return newSet;
    });
  };

  // 全ての日付を展開/折りたたみ
  const toggleAllDates = (expand: boolean) => {
    if (!selectedJob) return;
    if (expand) {
      setExpandedDates(new Set(selectedJob.workDates.map(wd => wd.id)));
    } else {
      setExpandedDates(new Set());
    }
  };

  if (!isAdmin || !admin) return null;

  if (isLoading && jobs.length === 0) {
    return (
      <div className="h-full bg-gray-50 flex flex-col p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
        <ApplicationsSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-x-auto">
      <div className="flex-1 overflow-y-auto p-6 min-w-[900px]">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">応募管理</h1>
          <p className="text-gray-500 mt-1">求人またはワーカーごとの応募状況を確認・管理できます</p>
        </div>

        {/* タブ切り替え */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 mb-6 inline-flex">
          <button
            onClick={() => setViewMode('jobs')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 ${viewMode === 'jobs'
              ? 'bg-admin-primary text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Briefcase className="w-4 h-4" />
            求人から
            {tabBadges.byJob > 0 && (
              <span className={`text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${viewMode === 'jobs' ? 'bg-white text-admin-primary' : 'bg-red-500 text-white'
                }`}>
                {tabBadges.byJob}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('workers')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 ${viewMode === 'workers'
              ? 'bg-admin-primary text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Users className="w-4 h-4" />
            ワーカーから
            {tabBadges.byWorker > 0 && (
              <span className={`text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${viewMode === 'workers' ? 'bg-white text-admin-primary' : 'bg-red-500 text-white'
                }`}>
                {tabBadges.byWorker}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('shift')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 ${viewMode === 'shift'
              ? 'bg-admin-primary text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <CalendarDays className="w-4 h-4" />
            シフトから
          </button>
        </div>

        {/* フィルタ・検索 - シフトビュー以外で表示 */}
        {viewMode !== 'shift' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
            {/* 求人ビューの場合はステータスフィルタを表示 */}
            {viewMode === 'jobs' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${statusFilter === 'all' ? 'bg-admin-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setStatusFilter('published')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${statusFilter === 'published' ? 'bg-gray-200 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  公開中
                </button>
                <button
                  onClick={() => setStatusFilter('stopped')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${statusFilter === 'stopped' ? 'bg-gray-200 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  停止中
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${statusFilter === 'completed' ? 'bg-gray-200 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  完了
                </button>
              </div>
            )}

            {/* ワーカービューの場合は件数を表示 */}
            {viewMode === 'workers' && (
              <div className="text-sm text-gray-600">
                応募ワーカー: {filteredWorkers.length}名
              </div>
            )}

            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={viewMode === 'jobs' ? '求人タイトルで検索...' : 'ワーカー名・資格で検索...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-primary"
              />
            </div>
          </div>
        )}

        {/* シフトビュー */}
        {viewMode === 'shift' && (
          <div className="h-[calc(100vh-220px)]">
            <MonthlyShiftView jobs={jobs as any} qualificationAbbreviations={qualificationAbbreviations} />
          </div>
        )}

        {/* 求人ビュー */}
        {viewMode === 'jobs' && (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200 text-gray-500">
                条件に一致する求人はありません
              </div>
            ) : (
              filteredJobs.map(job => {
                const applicationRate = job.totalRecruitment > 0
                  ? Math.round((job.totalMatched / job.totalRecruitment) * 100)
                  : 0;

                return (
                  <div
                    key={job.id}
                    onClick={async () => {
                      setSelectedJob(job);
                      // 初期状態で応募がある日付を展開
                      const activeDateIds = job.workDates
                        .filter(wd => wd.applications.length > 0)
                        .map(wd => wd.id);
                      setExpandedDates(new Set(activeDateIds));

                      // この求人の未確認応募を既読にする
                      if (admin?.facilityId && job.unviewedCount > 0) {
                        await markJobApplicationsAsViewed(admin.facilityId, job.id);
                        mutateJobs();
                      }
                    }}
                    className="bg-white rounded-admin-card border border-gray-200 p-5 hover:shadow-md hover:border-admin-primary transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${job.status === 'PUBLISHED' ? 'bg-blue-600 text-white' :
                            job.status === 'WORKING' ? 'bg-blue-800 text-white' :
                              job.status === 'COMPLETED' ? 'bg-blue-50 text-blue-300' :
                                'bg-blue-100 text-blue-400'
                            }`}>
                            {job.status === 'PUBLISHED' ? '公開中' :
                              job.status === 'WORKING' ? '勤務中' :
                                job.status === 'COMPLETED' ? '完了' :
                                  job.status === 'STOPPED' ? '停止中' : job.status}
                          </span>
                          {job.requiresInterview && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                              審査あり
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-admin-primary transition-colors">
                            {job.title}
                          </h3>
                          {/* 未確認応募バッジ */}
                          {job.unviewedCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                              新着 {job.unviewedCount}件
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{job.dateRange}</span>
                            <span className="text-gray-400">({job.startTime}〜{job.endTime})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">¥{job.hourlyWage.toLocaleString()}</span>
                            <span>/時</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {job.workContent.map((content, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {content}
                            </span>
                          ))}
                          {job.requiredQualifications.map((qual, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                              {qual}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 min-w-[180px]">
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">応募状況</div>
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-2xl font-bold text-gray-900">{job.totalApplied}</span>
                            <span className="text-sm text-gray-500">名応募</span>
                          </div>
                        </div>

                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${applicationRate >= 100 ? 'bg-green-500' :
                              applicationRate >= 50 ? 'bg-orange-500' : 'bg-blue-500'
                              }`}
                            style={{ width: `${Math.min(applicationRate, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 flex justify-between w-full">
                          <span>マッチング: {job.totalMatched}/{job.totalRecruitment}</span>
                          <span>{applicationRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}


            {/* ページネーション (Jobs) */}
            {jobsPagination && (
              <div className="mt-6 flex justify-center pb-8">
                <Pagination
                  currentPage={jobsPagination.currentPage}
                  totalPages={jobsPagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}

        {/* ワーカービュー（行形式リスト） */}
        {viewMode === 'workers' && (
          <div className="bg-white rounded-lg border border-gray-200">
            {filteredWorkers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                条件に一致するワーカーはいません
              </div>
            ) : (
              <div className="divide-y divide-gray-100 min-w-[900px]">
                {filteredWorkers.map((workerData) => {
                  const { worker, applications, unviewedCount } = workerData;
                  const pendingCount = applications.filter(a => a.status === 'APPLIED').length;
                  const totalCount = applications.length;

                  return (
                    <div
                      key={worker.id}
                      onClick={() => {
                        window.location.href = `/admin/workers/${worker.id}?returnTab=workers`;
                      }}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group relative"
                    >
                      {/* ワーカー情報（横並び: 顔写真 | 情報 | アクションエリア） */}
                      <div className="flex items-center gap-5">
                        {/* プロフィール写真 - 丸形 w-24 h-24 (1.5倍に拡大) */}
                        <div className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0 border-3 border-gray-200 shadow-md">
                          {worker.profileImage ? (
                            <Image src={worker.profileImage} alt={worker.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <UserCircle className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                          {/* 未確認応募バッジ（プロフィール写真の右上） */}
                          {unviewedCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md animate-pulse">
                              {unviewedCount}
                            </div>
                          )}
                        </div>

                        {/* メイン情報エリア */}
                        <div className="flex-1 min-w-0">
                          {/* 1行目: 名前・地域・評価・統計 */}
                          <div className="flex items-center gap-4 mb-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-lg group-hover:text-admin-primary transition-colors">
                              {worker.name}
                            </h3>
                            {/* 未確認応募バッジ（テキスト版） */}
                            {unviewedCount > 0 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                新着 {unviewedCount}件
                              </span>
                            )}
                            {worker.location && (
                              <span className="text-sm text-gray-500">{worker.location}</span>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              {/* 評価 */}
                              <div className="flex items-center gap-1">
                                <span className="text-yellow-500">★</span>
                                <span className="font-bold text-gray-900">{worker.rating ? worker.rating.toFixed(1) : '-'}</span>
                                <span className="text-gray-400">({worker.reviewCount})</span>
                              </div>
                              <span className="text-gray-300">|</span>
                              {/* 勤務日数 */}
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">勤務</span>
                                <span className="font-bold text-gray-900">{worker.totalWorkDays}日</span>
                              </div>
                              <span className="text-gray-300">|</span>
                              {/* 直前キャンセル率 */}
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">直前CN</span>
                                <span className={`font-bold ${worker.lastMinuteCancelRate > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                  {worker.lastMinuteCancelRate.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 2行目: 資格バッジ */}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {worker.qualifications.map((qual, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">
                                {qual}
                              </span>
                            ))}
                          </div>

                          {/* 3行目: 経験分野アイコン */}
                          {worker.experienceFields && worker.experienceFields.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {worker.experienceFields.slice(0, 8).map((exp, i) => (
                                <div
                                  key={i}
                                  className={`group/exp relative px-2 py-1 ${getExperienceColorByField(exp.field)} text-white rounded-md cursor-help shadow-sm text-xs font-medium`}
                                >
                                  {getAbbreviation(exp.field)} {exp.years.replace('年以上', '+').replace('年未満', '-').replace('〜', '-')}
                                  {/* ホバーツールチップ */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/exp:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg">
                                    {exp.field}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              ))}
                              {worker.experienceFields.length > 8 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs font-medium">
                                  +{worker.experienceFields.length - 8}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 右側: 3段構成アクションエリア */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {/* 上段: お気に入り・ブロックボタン */}
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => handleToggleFavorite(e, worker.id)}
                              className={`p-2 rounded-full transition-all ${workerStates[worker.id]?.isFavorite
                                ? 'bg-pink-500 text-white hover:bg-pink-600'
                                : 'bg-gray-100 text-gray-400 hover:bg-pink-50 hover:text-pink-500'
                                }`}
                              title={workerStates[worker.id]?.isFavorite ? 'お気に入り解除' : 'お気に入り追加'}
                            >
                              <Heart className={`w-4 h-4 ${workerStates[worker.id]?.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => handleToggleBlock(e, worker.id)}
                              className={`p-2 rounded-full transition-all ${workerStates[worker.id]?.isBlocked
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
                                }`}
                              title={workerStates[worker.id]?.isBlocked ? 'ブロック解除' : 'ブロック'}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>

                          {/* 中段: 未対応バッジ */}
                          {pendingCount > 0 && (
                            <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">
                              未対応 {pendingCount}
                            </span>
                          )}

                          {/* 下段: 応募一覧ボタン */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSelectedWorker(workerData);

                              // このワーカーの未確認応募を既読にする
                              if (admin?.facilityId && unviewedCount > 0) {
                                await markWorkerApplicationsAsViewed(admin.facilityId, worker.id);
                                mutateWorkers();
                              }
                            }}
                            className="px-4 py-2 bg-admin-primary text-white rounded-lg text-sm font-medium hover:bg-admin-primary/90 transition-colors flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            応募一覧({totalCount})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* ページネーション (Workers) */}
            {workersPagination && (
              <div className="mt-6 flex justify-center pb-8">
                <Pagination
                  currentPage={workersPagination.currentPage}
                  totalPages={workersPagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 詳細モーダル（共有コンポーネント使用） */}
      {
        selectedJob && (
          <JobApplicationModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onStatusUpdate={handleStatusUpdate}
            onMatchAll={handleMatchAll}
            isUpdating={isUpdating}
          />
        )
      }

      {/* ワーカー詳細モーダル */}
      {
        selectedWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
              {/* モーダルヘッダー */}
              <div className="p-6 border-b border-gray-200 flex items-start justify-between bg-gray-50">
                <div className="flex items-center gap-4">
                  <Link href={`/admin/workers/${selectedWorker.worker.id}?returnTab=workers`} className="block relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 hover:opacity-80">
                    {selectedWorker.worker.profileImage ? (
                      <Image src={selectedWorker.worker.profileImage} alt={selectedWorker.worker.name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <UserCircle className="w-10 h-10 text-gray-400" />
                      </div>
                    )}
                  </Link>
                  <div>
                    <Link href={`/admin/workers/${selectedWorker.worker.id}?returnTab=workers`} className="text-xl font-bold text-gray-900 hover:text-admin-primary">
                      {selectedWorker.worker.name}
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      <div className="flex items-center gap-1">
                        ★ <span className="text-yellow-500 font-bold">{selectedWorker.worker.rating?.toFixed(1) || '-'}</span>
                        <span className="text-gray-400">({selectedWorker.worker.reviewCount})</span>
                      </div>
                      <span className="text-gray-300">|</span>
                      <span>勤務: {selectedWorker.worker.totalWorkDays}日</span>
                      <span className="text-gray-300">|</span>
                      <span className={selectedWorker.worker.lastMinuteCancelRate > 0 ? 'text-red-500' : ''}>
                        直前CN: {selectedWorker.worker.lastMinuteCancelRate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedWorker.worker.qualifications.map((qual, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                          {qual}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWorker(null)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* 応募一覧 */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3">応募一覧（{selectedWorker.applications.length}件）</h3>
                <div className="space-y-3">
                  {selectedWorker.applications.map(app => (
                    <div key={app.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">{app.job.title}</div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(app.job.workDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                            </span>
                            <span>{app.job.startTime}〜{app.job.endTime}</span>
                            <span className="font-bold text-gray-700">¥{app.job.hourlyWage.toLocaleString()}/時</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.status === 'APPLIED' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(app.id, 'SCHEDULED')}
                                disabled={isUpdating === app.id}
                                className="px-3 py-1.5 bg-admin-primary text-white text-xs font-medium rounded-admin-button hover:bg-admin-primary-dark transition-colors disabled:opacity-50"
                              >
                                マッチング
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(app.id, 'CANCELLED', app.job.requiresInterview ? 'この応募を不採用にしますか？' : 'この応募をキャンセルしますか？')}
                                disabled={isUpdating === app.id}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                              >
                                {app.job.requiresInterview ? '不採用' : 'キャンセル'}
                              </button>
                            </>
                          )}
                          {app.status === 'SCHEDULED' && (
                            <>
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                マッチング済
                              </span>
                              <button
                                onClick={() => handleStatusUpdate(app.id, 'CANCELLED', 'このマッチングをキャンセルしますか？')}
                                disabled={isUpdating === app.id}
                                className="text-xs text-gray-400 hover:text-red-500 underline"
                              >
                                キャンセル
                              </button>
                            </>
                          )}
                          {app.status === 'CANCELLED' && (
                            <span className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 ${app.cancelledBy === 'WORKER'
                              ? 'bg-red-50 text-red-600'
                              : app.cancelledBy === 'FACILITY'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-50 text-yellow-700'
                              }`}>
                              <X className="w-3 h-3" />
                              {app.cancelledBy === 'WORKER'
                                ? 'ワーカー辞退'
                                : app.cancelledBy === 'FACILITY'
                                  ? '施設キャンセル'
                                  : '応募取消'}
                            </span>
                          )}
                          {['WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(app.status) && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded">
                              勤務中/完了
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-primary"></div>
      </div>
    }>
      <ApplicationsContent />
    </Suspense>
  );
}
