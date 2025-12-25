'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import { getAdminJobTemplates, getFacilityInfo, deleteJobs, updateJobsStatus } from '@/src/lib/actions';
import { useAdminJobs } from '@/hooks/useAdminJobs';
import { JobsListSkeleton } from '@/components/admin/JobsListSkeleton';
import { getCurrentTime } from '@/utils/debugTime';
import {
  Plus,
  FileText,
  Search,
  Calendar,
  Users,
  Clock,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Briefcase,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Tag } from '@/components/ui/tag';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

type JobStatus = 'all' | 'recruiting' | 'paused' | 'working' | 'review' | 'completed' | 'failed';

interface WorkDateData {
  id: number;
  date: string;
  formattedDate: string;
  recruitmentCount: number;
  appliedCount: number;
  matchedCount: number;
  deadline: string;
}

type JobType = 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'ORIENTATION' | 'OFFER';

interface JobData {
  id: number;
  title: string;
  status: string;
  jobType: JobType;
  startTime: string;
  endTime: string;
  breakTime: string;
  wage: number;
  hourlyWage: number;
  transportationFee: number;
  workContent: string[];
  requiredQualifications: string[];
  workDates: WorkDateData[];
  totalWorkDates: number;
  totalApplied: number;
  totalMatched: number;
  totalRecruitment: number;
  nearestWorkDate: string | null;
  dateRange: string;
  overview: string;
  images: string[];
  address: string | null;
  access: string;
  tags: string[];
  managerName: string;
  managerMessage: string | null;
  managerAvatar: string | null;
  facilityName: string;
  templateId: number | null;
  templateName: string | null;
  dresscode: string[];
  dresscodeImages: string[];
  belongings: string[];
  attachments: string[];
  requiredExperience: string[];
  // こだわり条件（7項目）
  inexperiencedOk: boolean;
  blankOk: boolean;
  hairStyleFree: boolean;
  nailOk: boolean;
  uniformProvided: boolean;
  allowCar: boolean;
  mealSupport: boolean;
  weeklyFrequency: number | null;
  requiresInterview: boolean;
  targetWorkerId: number | null;
  targetWorkerName: string | null;
}

interface TemplateData {
  id: number;
  name: string;
  title: string;
}

export default function AdminJobsList() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [jobTemplates, setJobTemplates] = useState<TemplateData[]>([]);
  const searchParams = useSearchParams();
  const initialStatusFilter = searchParams.get('status') as JobStatus | null;
  const initialPage = searchParams.get('page');
  const initialPeriodStart = searchParams.get('periodStart');
  const initialPeriodEnd = searchParams.get('periodEnd');
  const initialTemplate = searchParams.get('template');
  const initialJobType = searchParams.get('jobType');

  const [facilityName, setFacilityName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus>(
    initialStatusFilter && ['all', 'recruiting', 'paused', 'working', 'review', 'completed', 'failed'].includes(initialStatusFilter)
      ? initialStatusFilter
      : 'all'
  );
  const [periodStartFilter, setPeriodStartFilter] = useState(initialPeriodStart || '');
  const [periodEndFilter, setPeriodEndFilter] = useState(initialPeriodEnd || '');
  const [templateFilter, setTemplateFilter] = useState(initialTemplate || 'all');
  const [jobTypeFilter, setJobTypeFilter] = useState(initialJobType || 'all');

  const updateUrlParams = (updates: {
    status?: string;
    page?: number;
    periodStart?: string;
    periodEnd?: string;
    template?: string;
    jobType?: string;
  }) => {
    const params = new URLSearchParams(window.location.search);

    if (updates.status !== undefined) {
      if (updates.status === 'all') params.delete('status');
      else params.set('status', updates.status);
    }

    if (updates.page !== undefined) {
      if (updates.page === 1) params.delete('page');
      else params.set('page', updates.page.toString());
    }

    if (updates.periodStart !== undefined) {
      if (!updates.periodStart) params.delete('periodStart');
      else params.set('periodStart', updates.periodStart);
    }

    if (updates.periodEnd !== undefined) {
      if (!updates.periodEnd) params.delete('periodEnd');
      else params.set('periodEnd', updates.periodEnd);
    }

    if (updates.template !== undefined) {
      if (updates.template === 'all') params.delete('template');
      else params.set('template', updates.template);
    }

    if (updates.jobType !== undefined) {
      if (updates.jobType === 'all') params.delete('jobType');
      else params.set('jobType', updates.jobType);
    }

    router.replace(`/admin/jobs?${params.toString()}`, { scroll: false });
  };
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<'publish' | 'pause' | 'delete' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage ? parseInt(initialPage) : 1);
  const itemsPerPage = 20;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);

  // ログインしていない、または管理者でない場合はログインページへリダイレクト
  useEffect(() => {
    // ローディング中はリダイレクトしない
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // SWRでデータ取得
  const {
    jobs = [],
    pagination,
    isLoading: isJobsLoading,
    mutate: mutateJobs,
  } = useAdminJobs({
    facilityId: admin?.facilityId,
    page: currentPage,
    status: statusFilter,
    query: searchQuery,
  });

  // テンプレートと施設情報の取得
  useEffect(() => {
    const fetchTemplatesAndFacility = async () => {
      if (!admin?.facilityId) return;
      try {
        const [templatesData, facilityData] = await Promise.all([
          getAdminJobTemplates(admin.facilityId),
          getFacilityInfo(admin.facilityId),
        ]);
        setJobTemplates(templatesData);
        if (facilityData) {
          setFacilityName(facilityData.facilityName);
        }
      } catch (error) {
        console.error('Failed to fetch templates/facility:', error);
      }
    };
    if (isAdmin && admin) {
      fetchTemplatesAndFacility();
    }
  }, [admin?.facilityId, isAdmin, admin]);

  const isLoading = isJobsLoading;

  // ステータス判定関数
  const getJobStatus = (job: JobData): Exclude<JobStatus, 'all'> => {
    // 停止中フラグがある場合は停止中を返す
    if (job.status === 'STOPPED') {
      return 'paused';
    }

    // 公開中（PUBLISHED）の場合は募集中として表示
    if (job.status === 'PUBLISHED') {
      return 'recruiting';
    }

    // その他（DRAFT等）の場合もデフォルトで募集中
    return 'recruiting';
  };

  // フィルタリング (サーバーサイドに移行、求人種別のみクライアントサイド)
  const filteredJobs = useMemo(() => {
    if (jobTypeFilter === 'all') return jobs;
    return jobs.filter(job => job.jobType === jobTypeFilter);
  }, [jobs, jobTypeFilter]);
  const totalPages = pagination?.totalPages || 1;
  const paginatedJobs = filteredJobs;

  // ページ変更時に先頭にスクロール
  useEffect(() => {
    // 依存関係が変更されたときにページを1に戻す処理
    // ただし、初期ロード時にURLから取得したページを上書きしないように注意が必要
    // ここでは初期ロード後に発火するようにする
  }, [searchQuery, statusFilter, periodStartFilter, periodEndFilter, templateFilter]);

  // ステータスのラベルと色
  // バッジ用: パターン5（青ベース統一）
  // フィルターボタン用: ドットインジケーター風
  const statusConfig = {
    recruiting: { label: '公開中', badge: 'bg-blue-600 text-white', dotColor: 'bg-green-500' },
    paused: { label: '停止中', badge: 'bg-blue-100 text-blue-400', dotColor: 'bg-gray-400' },
    working: { label: '勤務中', badge: 'bg-blue-800 text-white', dotColor: 'bg-blue-500' },
    review: { label: '評価待ち', badge: 'bg-blue-300 text-blue-900', dotColor: 'bg-amber-500' },
    completed: { label: '完了', badge: 'bg-blue-50 text-blue-300', dotColor: 'bg-gray-400' },
    failed: { label: '不成立', badge: 'bg-red-100 text-red-600', dotColor: 'bg-red-500' },
  };

  // チェックボックスの処理
  const handleCheckboxChange = (jobId: number) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (selectedJobIds.length === paginatedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(paginatedJobs.map((job) => job.id));
    }
  };

  const handleBulkPublish = () => {
    if (selectedJobIds.length > 0) {
      setBulkActionConfirm('publish');
    }
  };

  const handleBulkPause = () => {
    if (selectedJobIds.length > 0) {
      setBulkActionConfirm('pause');
    }
  };

  const handleBulkDelete = () => {
    if (selectedJobIds.length > 0) {
      setBulkActionConfirm('delete');
    }
  };

  const confirmBulkAction = async () => {
    if (bulkActionConfirm && selectedJobIds.length > 0) {
      if (bulkActionConfirm === 'delete') {
        // 削除処理
        if (!admin?.facilityId) return;

        setIsDeleting(true);
        try {
          const result = await deleteJobs(selectedJobIds, admin.facilityId);
          if (result.success) {
            toast.success(result.message);
            mutateJobs();
          } else {
            toast.error(result.message);
          }
        } catch (error) {
          const debugInfo = extractDebugInfo(error);
          showDebugError({
            type: 'delete',
            operation: '求人一括削除',
            message: debugInfo.message,
            details: debugInfo.details,
            stack: debugInfo.stack,
            context: { jobIds: selectedJobIds, facilityId: admin?.facilityId }
          });
          toast.error('削除に失敗しました');
        } finally {
          setIsDeleting(false);
        }
      } else {
        // 公開・停止処理
        if (!admin?.facilityId) return;

        setIsDeleting(true);
        const newStatus = bulkActionConfirm === 'publish' ? 'PUBLISHED' : 'STOPPED';
        try {
          const result = await updateJobsStatus(selectedJobIds, admin.facilityId, newStatus);
          if (result.success) {
            toast.success(result.message);
            mutateJobs();
          } else {
            toast.error(result.message);
          }
        } catch (error) {
          const debugInfo = extractDebugInfo(error);
          showDebugError({
            type: 'update',
            operation: '求人ステータス一括更新',
            message: debugInfo.message,
            details: debugInfo.details,
            stack: debugInfo.stack,
            context: { jobIds: selectedJobIds, facilityId: admin?.facilityId, targetStatus: newStatus }
          });
          toast.error('ステータス更新に失敗しました');
        } finally {
          setIsDeleting(false);
        }
      }
      setSelectedJobIds([]);
      setBulkActionConfirm(null);
    }
  };

  // 年月セレクターの選択肢生成
  const periodOptions = useMemo(() => {
    const options = [];
    for (let month = 1; month <= 11; month++) {
      options.push({
        value: `2025-${month.toString().padStart(2, '0')}`,
        label: `2025年${month}月`,
      });
    }
    return options;
  }, []);

  if (isLoading || isAdminLoading) {
    return (
      <div className="h-full bg-gray-50 flex flex-col p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
        <JobsListSkeleton />
      </div>
    );
  }

  // ログインしていない場合は何も表示しない（リダイレクトはuseEffectで処理）
  if (!isAdmin || !admin) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">求人管理</h1>
            <p className="text-xs text-gray-500 mt-1">
              {filteredJobs.length}件の求人
              {filteredJobs.length !== jobs.length && (
                <span className="text-gray-400"> （全{jobs.length}件中）</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 選択中の表示（選択時のみ表示） */}
            {selectedJobIds.length > 0 && (
              <span className="text-xs text-gray-600">
                {selectedJobIds.length}件選択中
              </span>
            )}
            {/* 一括操作ボタン（常に表示） */}
            <button
              onClick={handleBulkPublish}
              disabled={selectedJobIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-admin-primary text-white rounded-admin-button hover:bg-admin-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              公開する
            </button>
            <button
              onClick={handleBulkPause}
              disabled={selectedJobIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-admin-button hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              停止する
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedJobIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-admin-button hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              削除する
            </button>
            <button
              onClick={() => window.open('/admin/jobs/templates', '_blank')}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-admin-button hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              テンプレート管理
            </button>
            <button
              onClick={() => router.push('/admin/jobs/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-admin-primary text-white rounded-admin-button hover:bg-admin-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              求人作成
            </button>
          </div>
        </div>
      </div>

      {/* 検索・フィルタエリア */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="space-y-3">
          {/* 1段目: フリーワード検索とテンプレートフィルタ */}
          <div className="grid grid-cols-3 gap-3">
            {/* フリーワード検索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="求人タイトル or ワーカー名"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-primary"
              />
            </div>

            {/* テンプレートフィルタ（幅を2倍に） */}
            <div className="col-span-2">
              <select
                value={templateFilter}
                onChange={(e) => {
                  const newTemplate = e.target.value;
                  setTemplateFilter(newTemplate);
                  setCurrentPage(1);
                  updateUrlParams({ template: newTemplate, page: 1 });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-primary"
              >
                <option value="all">すべてのテンプレート</option>
                {jobTemplates.map((template) => (
                  <option key={template.id} value={template.id.toString()}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2段目: 期間指定 */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 font-medium">期間:</span>

            {/* 開始年月フィルタ */}
            <select
              value={periodStartFilter}
              onChange={(e) => {
                const newStart = e.target.value;
                setPeriodStartFilter(newStart);
                setCurrentPage(1);
                updateUrlParams({ periodStart: newStart, page: 1 });
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-primary"
            >
              <option value="">開始月（未指定）</option>
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <span className="text-sm text-gray-500">〜</span>

            {/* 終了年月フィルタ */}
            <select
              value={periodEndFilter}
              onChange={(e) => {
                const newEnd = e.target.value;
                setPeriodEndFilter(newEnd);
                setCurrentPage(1);
                updateUrlParams({ periodEnd: newEnd, page: 1 });
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-primary"
            >
              <option value="">終了月（未指定）</option>
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* ステータスボタンフィルタ */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
                updateUrlParams({ status: 'all', page: 1 });
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${statusFilter === 'all'
                ? 'bg-admin-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              すべて
            </button>
            {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                  updateUrlParams({ status: status, page: 1 });
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${statusFilter === status
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusConfig[status].dotColor}`}></span>
                {statusConfig[status].label}
              </button>
            ))}
          </div>

          {/* 求人種別フィルタ */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">種別:</span>
            {[
              { value: 'all', label: 'すべて', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
              { value: 'NORMAL', label: '通常', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
              { value: 'LIMITED_WORKED', label: '限定（勤務実績）', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
              { value: 'LIMITED_FAVORITE', label: '限定（お気に入り）', color: 'bg-pink-50 text-pink-700 hover:bg-pink-100' },
              { value: 'OFFER', label: 'オファ', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { value: 'ORIENTATION', label: '説明会', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setJobTypeFilter(type.value);
                  setCurrentPage(1);
                  updateUrlParams({ jobType: type.value, page: 1 });
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  jobTypeFilter === type.value
                    ? type.value === 'all' ? 'bg-admin-primary text-white' : 'ring-2 ring-offset-1 ring-gray-400 ' + type.color
                    : type.color
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 求人リスト */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 全選択チェックボックス */}
        {paginatedJobs.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedJobIds.length === paginatedJobs.length && paginatedJobs.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 text-admin-primary border-gray-300 rounded focus:ring-admin-primary"
            />
            <label className="text-sm text-gray-700 cursor-pointer" onClick={handleSelectAll}>
              全選択
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {paginatedJobs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="作成された求人はありません"
              description="新しい求人を作成して、ワーカーを募集しましょう"
              actionLabel="求人を作成"
              actionLink="/admin/jobs/new"
            />
          ) : (
            paginatedJobs.map((job) => {
              const status = getJobStatus(job);
              const statusInfo = statusConfig[status];
              const applicationRate = job.totalRecruitment > 0
                ? Math.round((job.totalMatched / job.totalRecruitment) * 100)
                : 0;

              // オファー求人は専用のカードデザイン
              if (job.jobType === 'OFFER') {
                return (
                  <div
                    key={job.id}
                    onClick={() => handleCheckboxChange(job.id)}
                    className="bg-blue-50 rounded-admin-card border-2 border-blue-200 hover:border-blue-400 hover:shadow-md transition-all p-3 flex items-center gap-3 cursor-pointer"
                  >
                    {/* チェックボックス */}
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedJobIds.includes(job.id)}
                        onChange={() => handleCheckboxChange(job.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* カード内容 */}
                    <div className="flex-1 min-w-0">
                      {/* 1行目: オファーバッジ + 対象者名 + 求人名 + 取消ボタン */}
                      <div className="flex items-center gap-3 mb-2">
                        {/* オファーバッジ */}
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-600 text-white">
                          オファ
                        </span>

                        {/* オファー対象者名 */}
                        <span className="text-sm font-medium text-blue-700">
                          → {job.targetWorkerName || '（対象者不明）'}
                        </span>

                        {/* 求人名 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-600 truncate">{job.title}</p>
                        </div>

                        {/* プレビューボタン */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/jobs/${job.id}?preview=true`, '_blank');
                          }}
                          className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          プレビュー
                        </button>

                        {/* 通知書ボタン */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/admin/jobs/${job.id}/notification`, '_blank');
                          }}
                          className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                        >
                          通知書
                        </button>

                        {/* 取消ボタン */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`${job.targetWorkerName || 'このワーカー'}へのオファーを取り消しますか？`)) return;
                            if (!admin?.facilityId) return;
                            setIsDeleting(true);
                            try {
                              const result = await deleteJobs([job.id], admin.facilityId);
                              if (result.success) {
                                toast.success('オファーを取り消しました');
                                mutateJobs();
                              } else {
                                toast.error(result.message);
                              }
                            } catch (error) {
                              toast.error('オファーの取り消しに失敗しました');
                            } finally {
                              setIsDeleting(false);
                            }
                          }}
                          disabled={isDeleting}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          取消
                        </button>
                      </div>

                      {/* 2行目: 時給・日時のみ（応募状況はオファーなので不要） */}
                      <div className="flex items-center gap-3">
                        {/* 時給 */}
                        <div className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-blue-700">
                          <span>¥{job.hourlyWage.toLocaleString()}/時</span>
                        </div>

                        {/* 日時（勤務日と時間） */}
                        <div className="flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs text-gray-700">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <span>{job.dateRange}</span>
                            <span className="text-gray-400">•</span>
                            <span>{job.startTime}〜{job.endTime}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // 通常の求人カード
              return (
                <div
                  key={job.id}
                  onClick={() => handleCheckboxChange(job.id)}
                  className="bg-white rounded-admin-card border border-gray-200 hover:border-admin-primary hover:shadow-md transition-all p-3 flex items-center gap-3 cursor-pointer"
                >
                  {/* チェックボックス（カードの縦方向中央） */}
                  <div className="flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(job.id)}
                      onChange={() => handleCheckboxChange(job.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-admin-primary border-gray-300 rounded focus:ring-admin-primary"
                    />
                  </div>

                  {/* カード内容 */}
                  <div className="flex-1 min-w-0">
                    {/* 1行目 */}
                    <div className="flex items-center gap-3 mb-2">
                      {/* ステータスバッジ（パターン5: 青ベース統一） */}
                      <div className="flex-shrink-0">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusInfo.badge}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* 求人種別バッジ */}
                      {job.jobType && job.jobType !== 'NORMAL' && (
                        <div className="flex-shrink-0">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded shadow-sm ${
                            job.jobType === 'LIMITED_WORKED' ? 'bg-purple-600 text-white' :
                            job.jobType === 'LIMITED_FAVORITE' ? 'bg-pink-500 text-white' :
                            job.jobType === 'ORIENTATION' ? 'bg-teal-500 text-white' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {job.jobType === 'LIMITED_WORKED' ? '限定' :
                             job.jobType === 'LIMITED_FAVORITE' ? (
                               <>限定<span className="text-yellow-300">★</span></>
                             ) :
                             job.jobType === 'ORIENTATION' ? '説明会' : ''}
                          </span>
                        </div>
                      )}

                      {/* 審査ありバッジ */}
                      {job.requiresInterview && (
                        <div className="flex-shrink-0">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                            審査あり
                          </span>
                        </div>
                      )}

                      {/* テンプレート名（求人名） */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                      </div>

                      {/* 編集・通知書ボタン */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/jobs/${job.id}/edit`);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          編集
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/admin/jobs/${job.id}/notification`, '_blank');
                          }}
                          className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                        >
                          通知書
                        </button>
                      </div>
                    </div>

                    {/* 2行目: 応募人数・時給・日時 */}
                    <div className="flex items-center gap-3 mb-2">
                      {/* 応募状況（先頭） */}
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1 text-xs">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-600">応募: {job.totalApplied}名</span>
                          <span className="text-gray-300">/</span>
                          <span className={`font-medium ${applicationRate >= 100 ? 'text-green-600' :
                            applicationRate >= 50 ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                            マッチング: {job.totalMatched}/{job.totalRecruitment}名
                          </span>
                        </div>
                      </div>

                      {/* 時給 */}
                      <div className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary">
                        <span>¥{job.hourlyWage.toLocaleString()}/時</span>
                      </div>

                      {/* 日時（勤務日と時間） */}
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1 text-xs text-gray-700">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{job.dateRange}</span>
                          <span className="text-gray-400">•</span>
                          <span>{job.startTime}〜{job.endTime}</span>
                          {job.totalWorkDates > 1 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">
                              全{job.totalWorkDates}日
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3行目: 業務内容（全表示） */}
                    {job.workContent && job.workContent.length > 0 && (
                      <div className="flex items-start gap-1 text-xs text-gray-700 mb-1">
                        <Briefcase className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {job.workContent.map((content: string, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                              {content}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4行目: 資格（全表示） */}
                    <div className="flex items-start gap-1 text-xs text-gray-700">
                      <Award className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {job.requiredQualifications && job.requiredQualifications.length > 0 ? (
                          job.requiredQualifications.map((qual: string, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                              {qual}
                            </span>
                          ))
                        ) : (
                          <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded">資格不問</span>
                        )}
                        {/* N回以上勤務バッジ（紫色） */}
                        {job.weeklyFrequency && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {job.weeklyFrequency}回以上勤務
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1);
                setCurrentPage(newPage);
                updateUrlParams({ page: newPage });
              }}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              前へ
            </button>

            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages} ページ
            </span>

            <button
              onClick={() => {
                const newPage = Math.min(totalPages, currentPage + 1);
                setCurrentPage(newPage);
                updateUrlParams({ page: newPage });
              }}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              次へ
            </button>
          </div>
        )}
      </div>

      {/* 一括操作確認モーダル */}
      {bulkActionConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-4">
              一括{bulkActionConfirm === 'publish' ? '公開' : bulkActionConfirm === 'pause' ? '停止' : '削除'}の確認
            </h2>
            <p className="text-sm text-gray-700 mb-6">
              {bulkActionConfirm === 'delete' ? (
                <>
                  選択した{selectedJobIds.length}件の求人を<span className="font-bold text-red-600">削除</span>しますか？
                  <br />
                  <span className="text-red-500 text-xs">※この操作は取り消せません</span>
                </>
              ) : (
                <>
                  選択した{selectedJobIds.length}件の求人を
                  <span className="font-bold">
                    {bulkActionConfirm === 'publish' ? '公開中' : '停止中'}
                  </span>
                  に変更しますか？
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkActionConfirm(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={confirmBulkAction}
                disabled={isDeleting}
                className={`flex-1 px-4 py-2 text-sm text-white rounded transition-colors disabled:opacity-50 ${bulkActionConfirm === 'publish'
                  ? 'bg-admin-primary hover:bg-admin-primary-dark'
                  : bulkActionConfirm === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                  }`}
              >
                {isDeleting ? '処理中...' : bulkActionConfirm === 'delete' ? '削除する' : '変更する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 求人詳細プレビューモーダル */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold">求人プレビュー</h2>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setCurrentImageIndex(0);
                  setIsOverviewExpanded(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* コンテンツ */}
            <div className="p-6">
              {/* タイトルと募集人数バッジ */}
              <div className="mb-4">
                <div className="flex items-start gap-3 mb-3">
                  <h3 className="text-xl font-bold flex-1">{selectedJob.title}</h3>
                  <Badge variant="red">募集{selectedJob.totalRecruitment}名</Badge>
                </div>
              </div>

              {/* 画像カルーセル */}
              {selectedJob.images && selectedJob.images.length > 0 && (
                <div className="mb-6 relative">
                  <div className="aspect-video relative bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedJob.images[currentImageIndex]}
                      alt={`求人画像 ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedJob.images.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev === 0 ? selectedJob.images!.length - 1 : prev - 1
                            )
                          }
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev === selectedJob.images!.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                  {selectedJob.images.length > 1 && (
                    <div className="flex justify-center gap-2 mt-3">
                      {selectedJob.images.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-primary' : 'bg-gray-300'
                            }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* タグとバッジ */}
              {selectedJob.tags && selectedJob.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">タグとバッジ</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.tags.map((tag, index) => (
                      <Badge key={index} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 施設情報 */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">施設情報</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      {selectedJob.facilityName || '施設名'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-sm">
                      <p>{selectedJob.address}</p>
                      <p className="text-gray-600 mt-1">{selectedJob.access}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 選択された勤務日 */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">
                  選択された勤務日（{selectedJob.workDates?.length || 1}件）
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedJob.workDates && selectedJob.workDates.length > 0 ? (
                    selectedJob.workDates.map((wd, index) => (
                      <div key={index} className="p-3 border-2 border-primary rounded-lg bg-primary-light/30">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-bold mb-1">
                              {wd.formattedDate} {selectedJob.startTime}〜{selectedJob.endTime}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span>休憩 {selectedJob.breakTime}</span>
                              <span>•</span>
                              <span>時給 {selectedJob.hourlyWage.toLocaleString()}円</span>
                              <span>•</span>
                              <span>募集 {wd.recruitmentCount}名</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-500">
                              {selectedJob.wage.toLocaleString()}円
                            </div>
                            <div className="text-xs text-gray-600">
                              交通費{selectedJob.transportationFee.toLocaleString()}円込
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 border-2 border-primary rounded-lg bg-primary-light/30">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-bold mb-1">
                            {selectedJob.workDates.length > 0 ? selectedJob.workDates[0].formattedDate : '-'} {selectedJob.startTime}〜{selectedJob.endTime}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>休憩 {selectedJob.breakTime}</span>
                            <span>•</span>
                            <span>時給 {selectedJob.hourlyWage.toLocaleString()}円</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-500">
                            {selectedJob.wage.toLocaleString()}円
                          </div>
                          <div className="text-xs text-gray-600">
                            交通費{selectedJob.transportationFee.toLocaleString()}円込
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 仕事内容 */}
              {selectedJob.workContent && selectedJob.workContent.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">仕事内容</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.workContent.map((content, index) => (
                      <Tag key={index}>{content}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* 仕事概要 */}
              {selectedJob.overview && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">仕事概要</h3>
                  <div className="text-sm text-gray-700">
                    <p className={`whitespace-pre-wrap ${!isOverviewExpanded && selectedJob.overview.length > 200 ? 'line-clamp-3' : ''}`}>
                      {selectedJob.overview}
                    </p>
                    {selectedJob.overview.length > 200 && (
                      <button
                        onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                        className="text-primary text-xs mt-2 hover:underline"
                      >
                        {isOverviewExpanded ? '閉じる ∧' : 'さらに表示 ∨'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 申込条件 */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">申込条件</h3>
                <div className="space-y-3">
                  {selectedJob.requiredQualifications && selectedJob.requiredQualifications.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">必要な資格</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.requiredQualifications.map((qual, index) => (
                          <Tag key={index}>{qual}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedJob.requiredExperience && selectedJob.requiredExperience.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">必要な経験</p>
                      <div className="space-y-1">
                        {selectedJob.requiredExperience.map((exp, index) => (
                          <div key={index} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{exp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 募集条件（N回以上勤務） */}
                  {selectedJob.weeklyFrequency && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">募集条件</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                          {selectedJob.weeklyFrequency}回以上勤務
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 事前情報 */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">事前情報</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(selectedJob.dresscode && selectedJob.dresscode.length > 0 || selectedJob.dresscodeImages && selectedJob.dresscodeImages.length > 0) && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">服装</p>
                      {selectedJob.dresscode && selectedJob.dresscode.length > 0 && (
                        <ul className="space-y-1 mb-3">
                          {selectedJob.dresscode.map((item, index) => (
                            <li key={index} className="text-sm text-gray-700">• {item}</li>
                          ))}
                        </ul>
                      )}
                      {selectedJob.dresscodeImages && selectedJob.dresscodeImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {selectedJob.dresscodeImages.map((image, index) => (
                            <div key={index} className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                              <img
                                src={image}
                                alt={`服装サンプル${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedJob.belongings && selectedJob.belongings.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">持ち物</p>
                      <ul className="space-y-1">
                        {selectedJob.belongings.map((item, index) => (
                          <li key={index} className="text-sm text-gray-700">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {/* その他添付資料 */}
                {selectedJob.attachments && selectedJob.attachments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-600 mb-2">その他添付資料</p>
                    <ul className="space-y-2">
                      {selectedJob.attachments.map((attachment, index) => {
                        const fileName = attachment.split('/').pop() || 'ファイル';
                        return (
                          <li key={index}>
                            <a
                              href={attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                            >
                              • {fileName}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {selectedJob.allowCar && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-600 mb-2">利用可能な交通手段</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">車通勤OK</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 備考 */}
              {selectedJob.managerName && selectedJob.managerMessage && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">備考</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl flex-shrink-0">
                        {selectedJob.managerAvatar || '👤'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900 mb-1">{selectedJob.managerName}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedJob.managerMessage}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 勤務条件 */}
              <div className="mb-4">
                <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">勤務条件</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">時給</p>
                      <p className="text-lg font-bold text-primary">¥{selectedJob.hourlyWage.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">日給</p>
                      <p className="text-lg font-bold text-primary">¥{selectedJob.wage.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">交通費</p>
                      <p className="text-sm text-gray-700">¥{selectedJob.transportationFee.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">応募締切</p>
                      <p className="text-sm text-gray-700">
                        {selectedJob.workDates.length > 0 ? new Date(selectedJob.workDates[0].deadline).toLocaleDateString('ja-JP') : '-'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`/admin/jobs/${selectedJob.id}/notification`, '_blank')}
                    className="w-full py-2 px-4 border border-primary text-primary rounded-lg hover:bg-primary-light/10 transition-colors text-sm font-medium"
                  >
                    労働条件通知書を確認する
                  </button>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setCurrentImageIndex(0);
                  setIsOverviewExpanded(false);
                }}
                className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
