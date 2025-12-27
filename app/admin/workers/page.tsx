'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  Users,
  Star,
  MapPin,
  ChevronDown,
  Heart,
  Ban,
  Building2,
  AlertTriangle,
  Send,
  Calendar,
  X,
  MoreHorizontal,
  FileText,
  Plus,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import {
  toggleWorkerFavorite,
  toggleWorkerBlock,
  type WorkerListStatus,
  getPendingWorkerReviews,
  submitWorkerReviewByJob,
  getReviewTemplates,
  createReviewTemplate,
  updateReviewTemplate,
  deleteReviewTemplate,
} from '@/src/lib/actions';
import { Pagination } from '@/components/ui/Pagination';
import { useAdminWorkers, type WorkerListItem } from '@/hooks/useAdminWorkers';
import { WorkersListSkeleton } from '@/components/admin/WorkersListSkeleton';
import { ReviewCard } from '@/components/admin/ReviewCard';
import { useDebounce } from '@/hooks/useDebounce';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';
import useSWR from 'swr';

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

type StatusFilterType = 'all' | WorkerListStatus;
type SortByType = 'workCount_desc' | 'workCount_asc' | 'lastWorkDate_desc' | 'lastWorkDate_asc';

// レビュー関連の型定義
interface PendingReview {
  applicationId: number;
  jobId: number;
  userId: number;
  userName: string;
  userProfileImage: string | null;
  jobTitle: string;
  workDate: string;
  startTime: string;
  endTime: string;
  daysSinceWork: number;
}

interface ReviewTemplate {
  id: number;
  name: string;
  content: string;
}

// 評価項目の定義
const RATING_CATEGORIES = [
  { key: 'attendance', label: '勤怠・時間', description: '始業・休憩・終業等の時間をきちんと守れていましたか？' },
  { key: 'skill', label: 'スキル', description: '業務に関わる技術はもちあわせていましたか？' },
  { key: 'execution', label: '遂行力', description: '必要な業務を遂行できましたか？' },
  { key: 'communication', label: 'コミュ力', description: '業務上必要なコミュニケーションレベルに達していましたか？' },
  { key: 'attitude', label: '姿勢', description: '不適切な態度などなく業務を遂行できましたか？' },
];

// REVIEW_PENDING件数取得用fetcher
const reviewPendingCountFetcher = async (url: string): Promise<number> => {
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.pagination?.totalCount ?? 0;
};

// 経験分野の略称変換
const getAbbreviation = (field: string): string => {
  const abbreviations: Record<string, string> = {
    '特別養護老人ホーム': '特養',
    '介護老人保健施設': '老健',
    'グループホーム': 'GH',
    'デイサービス': 'デイ',
    '訪問介護': '訪介',
    '有料老人ホーム': '有料',
    'サービス付き高齢者向け住宅': 'サ高住',
  };
  return abbreviations[field] || field;
};

// 経験分野の色を取得
const getExperienceColor = (field: string): string => {
  const colors: Record<string, string> = {
    '特別養護老人ホーム': 'bg-blue-600',
    '介護老人保健施設': 'bg-indigo-600',
    'グループホーム': 'bg-purple-600',
    'デイサービス': 'bg-orange-500',
    '訪問介護': 'bg-green-600',
    '有料老人ホーム': 'bg-pink-600',
    'サービス付き高齢者向け住宅': 'bg-teal-600',
  };
  return colors[field] || 'bg-gray-600';
};

export default function AdminWorkersPage() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const searchParams = useSearchParams();
  const initialStatusFilter = searchParams.get('status') as StatusFilterType | null;
  const initialSortBy = searchParams.get('sort') as SortByType | null;
  const initialPage = searchParams.get('page');

  const [page, setPage] = useState(initialPage ? parseInt(initialPage) : 1);

  // 検索・フィルター・並び替え
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>(
    initialStatusFilter && ['all', 'NOT_STARTED', 'WORKING', 'COMPLETED', 'REVIEW_PENDING', 'CANCELLED'].includes(initialStatusFilter)
      ? initialStatusFilter
      : 'all'
  );
  const [qualificationCategory, setQualificationCategory] = useState<string>('all');
  // 勤務予定モーダル用
  const [scheduleModalWorker, setScheduleModalWorker] = useState<{
    name: string;
    schedules: { date: string; startTime: string; endTime: string }[]
  } | null>(null);

  // レビュー機能用の状態
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [selectedReviewWorker, setSelectedReviewWorker] = useState<{ userId: number; name: string } | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<PendingReview | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [ratings, setRatings] = useState({
    attendance: 5,
    skill: 5,
    execution: 5,
    communication: 5,
    attitude: 5,
  });
  const [comment, setComment] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [sortBy, setSortBy] = useState<SortByType>(
    initialSortBy && ['workCount_desc', 'workCount_asc', 'lastWorkDate_desc', 'lastWorkDate_asc'].includes(initialSortBy)
      ? initialSortBy
      : 'lastWorkDate_desc'
  );

  const updateUrlParams = (updates: {
    status?: string;
    sort?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams(window.location.search);

    if (updates.status !== undefined) {
      if (updates.status === 'all') params.delete('status');
      else params.set('status', updates.status);
    }

    if (updates.sort !== undefined) {
      if (updates.sort === 'lastWorkDate_desc') params.delete('sort');
      else params.set('sort', updates.sort);
    }

    if (updates.page !== undefined) {
      if (updates.page === 1) params.delete('page');
      else params.set('page', updates.page.toString());
    }

    router.replace(`/admin/workers?${params.toString()}`, { scroll: false });
  };


  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // デバウンス処理
  const debouncedKeyword = useDebounce(keyword, 500);

  // SWRでデータ取得
  const {
    workers = [],
    pagination,
    isLoading: isWorkersLoading,
    mutate
  } = useAdminWorkers({
    facilityId: admin?.facilityId,
    page,
    limit: 10,
    status: statusFilter,
    keyword: debouncedKeyword,
    sort: sortBy,
    jobCategory: 'all',
  });

  // REVIEW_PENDING件数を取得（バッジ表示用）
  const reviewPendingUrl = admin?.facilityId
    ? `/api/admin/workers/list?facilityId=${admin.facilityId}&status=REVIEW_PENDING&limit=1`
    : null;
  const { data: reviewPendingCount = 0 } = useSWR<number>(
    reviewPendingUrl,
    reviewPendingCountFetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  const isLoading = isWorkersLoading;

  // フィルタリング済みワーカー（サーバーサイド + 資格カテゴリフィルタ）
  const filteredWorkers = useMemo(() => {
    if (qualificationCategory === 'all') {
      return workers;
    }

    const categoryGroup = QUALIFICATION_GROUPS.find(g => g.name === qualificationCategory);
    if (!categoryGroup) {
      return workers;
    }

    const categoryQualifications = categoryGroup.qualifications as readonly string[];
    return workers.filter(worker =>
      worker.qualifications.some(qual =>
        categoryQualifications.includes(qual)
      )
    );
  }, [workers, qualificationCategory]);

  // お気に入りトグル
  const handleToggleFavorite = async (e: React.MouseEvent, userId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!admin) return;
    try {
      const result = await toggleWorkerFavorite(userId, admin.facilityId);
      if (result.success) {
        mutate();
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: 'ワーカーお気に入りトグル',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { userId, facilityId: admin.facilityId }
      });
      console.error('Failed to toggle favorite:', error);
      toast.error('お気に入りの更新に失敗しました');
    }
  };

  // ブロックトグル
  const handleToggleBlock = async (e: React.MouseEvent, userId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!admin) return;
    try {
      const result = await toggleWorkerBlock(userId, admin.facilityId);
      if (result.success) {
        mutate();
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: 'ワーカーブロックトグル',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { userId, facilityId: admin.facilityId }
      });
      console.error('Failed to toggle block:', error);
      toast.error('ブロックの更新に失敗しました');
    }
  };

  // レビューデータ取得
  const fetchReviewData = async () => {
    if (!admin?.facilityId) return;
    try {
      const pending = await getPendingWorkerReviews(admin.facilityId);
      setPendingReviews(pending as PendingReview[]);
      const templateData = await getReviewTemplates(admin.facilityId);
      setTemplates(templateData as ReviewTemplate[]);
    } catch (error) {
      console.error('Failed to fetch review data:', error);
    }
  };

  // レビューモーダルを開く
  const handleOpenReviewModal = async (e: React.MouseEvent, worker: { userId: number; name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    await fetchReviewData();
    setSelectedReviewWorker(worker);
  };

  // 特定のレビュー対象を選択
  const handleSelectReview = (review: PendingReview) => {
    setSelectedApplication(review);
  };

  // テンプレート再取得
  const refreshTemplates = async () => {
    if (!admin?.facilityId) return;
    const templateData = await getReviewTemplates(admin.facilityId);
    setTemplates(templateData as ReviewTemplate[]);
  };

  // テンプレート作成
  const handleCreateTemplate = async () => {
    if (!admin?.facilityId || !newTemplateName.trim() || !newTemplateContent.trim()) {
      toast.error('タイトルと内容を入力してください');
      return;
    }
    try {
      await createReviewTemplate(admin.facilityId, newTemplateName.trim(), newTemplateContent.trim());
      toast.success('テンプレートを作成しました');
      setNewTemplateName('');
      setNewTemplateContent('');
      setIsCreatingTemplate(false);
      await refreshTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('テンプレートの作成に失敗しました');
    }
  };

  // テンプレート更新
  const handleUpdateTemplate = async () => {
    if (!admin?.facilityId || !editingTemplate || !newTemplateName.trim() || !newTemplateContent.trim()) {
      toast.error('タイトルと内容を入力してください');
      return;
    }
    try {
      const result = await updateReviewTemplate(editingTemplate.id, newTemplateName.trim(), newTemplateContent.trim(), admin.facilityId);
      if (result.success) {
        toast.success('テンプレートを更新しました');
        setEditingTemplate(null);
        setNewTemplateName('');
        setNewTemplateContent('');
        await refreshTemplates();
      } else {
        toast.error(result.error || 'テンプレートの更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update template:', error);
      toast.error('テンプレートの更新に失敗しました');
    }
  };

  // テンプレート削除
  const handleDeleteTemplate = async (templateId: number) => {
    if (!admin?.facilityId) return;
    if (!confirm('このテンプレートを削除しますか？')) return;
    try {
      const result = await deleteReviewTemplate(templateId, admin.facilityId);
      if (result.success) {
        toast.success('テンプレートを削除しました');
        await refreshTemplates();
      } else {
        toast.error(result.error || 'テンプレートの削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('テンプレートの削除に失敗しました');
    }
  };

  // レビュー投稿
  const handleSubmitReview = async (action: 'submit' | 'favorite' | 'block') => {
    if (!selectedApplication || !admin) return;
    try {
      const result = await submitWorkerReviewByJob({
        jobId: selectedApplication.jobId,
        userId: selectedApplication.userId,
        facilityId: admin.facilityId,
        ratings,
        comment,
        action: action === 'submit' ? undefined : action,
      });
      if (result.success) {
        toast.success('レビューを登録しました');
        setSelectedApplication(null);
        // 評価をリセット
        setRatings({
          attendance: 5,
          skill: 5,
          execution: 5,
          communication: 5,
          attitude: 5,
        });
        setComment('');
        // リストを更新
        await fetchReviewData();
        mutate(); // ワーカー一覧も更新
        // 該当ワーカーのレビューがなくなったらモーダルを閉じる
        const remaining = pendingReviews.filter(r => r.userId === selectedReviewWorker?.userId && r.applicationId !== selectedApplication.applicationId);
        if (remaining.length === 0) {
          setSelectedReviewWorker(null);
        }
      } else {
        toast.error(result.error || 'レビューの登録に失敗しました');
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('レビューの登録に失敗しました');
    }
  };

  // 星評価コンポーネント
  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${star <= value ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );

  const getStatusLabel = (status: WorkerListStatus) => {
    switch (status) {
      case 'NOT_STARTED':
        return { text: '就労前', ribbonColor: 'bg-purple-500', textColor: 'text-white' };
      case 'WORKING':
        return { text: '就労中', ribbonColor: 'bg-green-500', textColor: 'text-white' };
      case 'COMPLETED':
        return { text: '就労済', ribbonColor: 'bg-blue-500', textColor: 'text-white' };
      case 'REVIEW_PENDING':
        return { text: 'レビュー', ribbonColor: 'bg-yellow-500', textColor: 'text-white' };
      case 'CANCELLED':
        return { text: 'キャン', ribbonColor: 'bg-red-500', textColor: 'text-white' };
      default:
        return { text: status, ribbonColor: 'bg-gray-500', textColor: 'text-white' };
    }
  };

  // 主要なステータスを1つ取得（優先順位: 就労中 > 就労前 > 就労済 > レビュー待ち > キャンセル）
  const getPrimaryStatus = (statuses: WorkerListStatus[]): WorkerListStatus | null => {
    if (statuses.includes('WORKING')) return 'WORKING';
    if (statuses.includes('NOT_STARTED')) return 'NOT_STARTED';
    if (statuses.includes('COMPLETED')) return 'COMPLETED';
    if (statuses.includes('REVIEW_PENDING')) return 'REVIEW_PENDING';
    if (statuses.includes('CANCELLED')) return 'CANCELLED';
    return null;
  };

  const getFilterLabel = (filter: StatusFilterType) => {
    switch (filter) {
      case 'all':
        return '全て';
      case 'NOT_STARTED':
        return '就労前';
      case 'WORKING':
        return '就労中';
      case 'COMPLETED':
        return '就労済';
      case 'REVIEW_PENDING':
        return 'レビュー';
      case 'CANCELLED':
        return 'キャンセル';
    }
  };

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
        <WorkersListSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">ワーカー一覧</h1>
          <p className="text-sm text-gray-600 mt-1">
            マッチ済みワーカー ({filteredWorkers.length}名)
          </p>
        </div>
      </div>

      {/* 検索バー + 職種チェックボックス */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 検索入力 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="氏名・住所で検索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent text-sm"
            />
          </div>

          {/* 資格カテゴリ選択 */}
          <div className="relative">
            <select
              value={qualificationCategory}
              onChange={(e) => {
                setQualificationCategory(e.target.value);
                setPage(1);
              }}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-admin-primary focus:border-transparent cursor-pointer"
            >
              <option value="all">資格カテゴリ: すべて</option>
              {QUALIFICATION_GROUPS.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ステータスボタン + 並び替え */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* ステータスフィルターボタン */}
          <div className="flex items-center gap-1">
            {(['all', 'NOT_STARTED', 'WORKING', 'COMPLETED', 'REVIEW_PENDING', 'CANCELLED'] as StatusFilterType[]).map(
              (filter) => {
                const getDotColor = () => {
                  switch (filter) {
                    case 'NOT_STARTED': return 'bg-purple-500';
                    case 'WORKING': return 'bg-green-500';
                    case 'COMPLETED': return 'bg-blue-500';
                    case 'REVIEW_PENDING': return 'bg-yellow-500';
                    case 'CANCELLED': return 'bg-red-500';
                    default: return '';
                  }
                };

                // 「すべて」はドットなしの青ボタン
                if (filter === 'all') {
                  return (
                    <button
                      key={filter}
                      onClick={() => {
                        setStatusFilter(filter);
                        setPage(1);
                        updateUrlParams({ status: filter, page: 1 });
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${statusFilter === filter
                        ? 'bg-admin-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {getFilterLabel(filter)}
                    </button>
                  );
                }

                // 他はドットインジケーター風
                return (
                  <button
                    key={filter}
                    onClick={() => {
                      setStatusFilter(filter);
                      setPage(1);
                      updateUrlParams({ status: filter, page: 1 });
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${statusFilter === filter
                      ? 'bg-gray-200 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${getDotColor()}`}></span>
                    {getFilterLabel(filter)}
                    {/* REVIEW_PENDINGの場合、件数があれば赤いバッジを表示 */}
                    {filter === 'REVIEW_PENDING' && reviewPendingCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
                        {reviewPendingCount}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          {/* 並び替えドロップダウン */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">並び替え:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSort = e.target.value as SortByType;
                  setSortBy(newSort);
                  setPage(1);
                  updateUrlParams({ sort: newSort, page: 1 });
                }}
                className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:ring-2 focus:ring-admin-primary focus:border-transparent cursor-pointer"
              >
                <option value="workCount_desc">勤務回数（多い順）</option>
                <option value="workCount_asc">勤務回数（少ない順）</option>
                <option value="lastWorkDate_desc">最終勤務日（新しい順）</option>
                <option value="lastWorkDate_asc">最終勤務日（古い順）</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ワーカー一覧 */}
      <div className="p-4">
        {filteredWorkers.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">
              {keyword || statusFilter !== 'all' || qualificationCategory !== 'all'
                ? '条件に一致するワーカーがいません'
                : 'マッチ済みワーカーがいません'}
            </h3>
            <p className="text-sm text-gray-600">
              応募管理から新しいワーカーとマッチングしましょう
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="divide-y divide-gray-100">
              {filteredWorkers.map((worker) => {
                const experienceData = worker.experienceFields
                  ? Object.entries(worker.experienceFields).slice(0, 8)
                  : [];
                const primaryStatus = getPrimaryStatus(worker.statuses);
                const statusInfo = primaryStatus ? getStatusLabel(primaryStatus) : null;

                return (
                  <Link
                    key={worker.userId}
                    href={`/admin/workers/${worker.userId}`}
                    className="block p-4 hover:bg-gray-50 transition-colors group"
                  >
                    {/* ワーカー情報（横並び: 顔写真 | 情報 | アクションエリア） */}
                    <div className="flex items-center gap-5">
                      {/* プロフィール写真 - 丸形 w-20 h-20 */}
                      <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                          {worker.profileImage ? (
                            <Image
                              src={worker.profileImage}
                              alt={worker.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <span className="text-2xl font-bold text-gray-400">
                                {worker.name.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* ステータスバッジ（左上に小さく） */}
                        {statusInfo && (
                          <div className={`absolute -top-1 -left-1 px-1.5 py-0.5 ${statusInfo.ribbonColor} text-white text-[9px] font-bold rounded shadow z-10 flex items-center gap-1`}>
                            {/* レビュー待ちがある場合は赤いポッチを表示 */}
                            {worker.statuses.includes('REVIEW_PENDING') && (
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm" />
                            )}
                            {statusInfo.text}
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
                          {(worker.prefecture || worker.city) && (
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {worker.prefecture}{worker.city}
                            </span>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            {/* 総合評価 */}
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              {worker.avgRating !== null ? (
                                <>
                                  <span className="font-bold text-gray-900">{worker.avgRating.toFixed(1)}</span>
                                  <span className="text-gray-400">({worker.reviewCount})</span>
                                </>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </div>
                            <span className="text-gray-300">|</span>
                            {/* 勤務回数（自社/他社） */}
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-blue-500" />
                              <span className="text-gray-500">勤務</span>
                              <span className="font-bold text-blue-600">{worker.ourWorkCount}</span>
                              <span className="text-gray-400">/</span>
                              <span className="font-bold text-gray-600">{worker.otherWorkCount}</span>
                              <span className="text-gray-400 text-xs">回</span>
                            </div>
                            <span className="text-gray-300">|</span>
                            {/* キャンセル率（通常/直前） */}
                            <div className="flex items-center gap-1">
                              <AlertTriangle className={`w-3 h-3 ${worker.cancelRate > 10 || worker.lastMinuteCancelRate > 10 ? 'text-red-500' : 'text-gray-400'}`} />
                              <span className="text-gray-500">CN</span>
                              <span className={`font-bold ${worker.cancelRate > 10 ? 'text-red-500' : 'text-gray-900'}`}>
                                {worker.cancelRate.toFixed(0)}
                              </span>
                              <span className="text-gray-400">/</span>
                              <span className={`font-bold ${worker.lastMinuteCancelRate > 10 ? 'text-red-500' : 'text-gray-900'}`}>
                                {worker.lastMinuteCancelRate.toFixed(0)}
                              </span>
                              <span className="text-gray-400 text-xs">%</span>
                            </div>
                          </div>
                        </div>

                        {/* 2行目: 資格バッジ */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {worker.qualifications.map((qual, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md font-medium"
                            >
                              {qual}
                            </span>
                          ))}
                        </div>

                        {/* 3行目: 経験分野アイコン */}
                        {experienceData.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {experienceData.map(([field, years], i) => (
                              <div
                                key={i}
                                className={`group/exp relative px-2 py-1 ${getExperienceColor(field)} text-white rounded-md cursor-help shadow-sm text-xs font-medium`}
                              >
                                {getAbbreviation(field)} {years}
                                {/* ホバーツールチップ */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/exp:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg">
                                  {field}
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            ))}
                            {worker.experienceFields && Object.keys(worker.experienceFields).length > 8 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs font-medium">
                                +{Object.keys(worker.experienceFields).length - 8}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 右側: アクションエリア */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {/* オファー・レビュー・お気に入り・ブロックボタン */}
                        <div className="flex gap-1.5">
                          {/* オファーボタン（レビュー完了済みワーカーのみ表示） */}
                          {worker.hasCompletedRated && (
                            <Link
                              href={`/admin/jobs/new?mode=offer&workerId=${worker.userId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-full transition-all bg-blue-500 text-white hover:bg-blue-600"
                              title="オファーを送る"
                            >
                              <Send className="w-4 h-4" />
                            </Link>
                          )}
                          {/* レビューボタン（REVIEW_PENDINGステータス表示時のみ） */}
                          {statusFilter === 'REVIEW_PENDING' && worker.statuses.includes('REVIEW_PENDING') && (
                            <button
                              onClick={(e) => handleOpenReviewModal(e, { userId: worker.userId, name: worker.name })}
                              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                              title="レビューを入力"
                            >
                              <Star className="w-4 h-4" />
                              レビュー
                            </button>
                          )}
                          <button
                            onClick={(e) => handleToggleFavorite(e, worker.userId)}
                            className={`p-2 rounded-full transition-all ${worker.isFavorite
                              ? 'bg-pink-500 text-white hover:bg-pink-600'
                              : 'bg-gray-100 text-gray-400 hover:bg-pink-50 hover:text-pink-500'
                              }`}
                            title={worker.isFavorite ? 'お気に入り解除' : 'お気に入り追加'}
                          >
                            <Heart className={`w-4 h-4 ${worker.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => handleToggleBlock(e, worker.userId)}
                            className={`p-2 rounded-full transition-all ${worker.isBlocked
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
                              }`}
                            title={worker.isBlocked ? 'ブロック解除' : 'ブロック'}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 勤務予定（最大5つ + もっと見るボタン） */}
                        {worker.scheduledDates && worker.scheduledDates.length > 0 && (
                          <div className="text-right text-xs">
                            <div className="flex items-center justify-end gap-1 text-gray-500 mb-0.5">
                              <Calendar className="w-3 h-3 text-green-500" />
                              <span className="font-medium">勤務予定:</span>
                            </div>
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {worker.scheduledDates.slice(0, 5).map((schedule, idx) => (
                                <button
                                  key={idx}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setScheduleModalWorker({
                                      name: worker.name,
                                      schedules: worker.scheduledDates,
                                    });
                                  }}
                                  className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium hover:bg-green-100 transition-colors cursor-pointer"
                                >
                                  {new Date(schedule.date).toLocaleDateString('ja-JP', {
                                    month: 'numeric',
                                    day: 'numeric',
                                  })}
                                </button>
                              ))}
                              {worker.scheduledDates.length > 5 && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setScheduleModalWorker({
                                      name: worker.name,
                                      schedules: worker.scheduledDates,
                                    });
                                  }}
                                  className="p-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
                                  title={`他${worker.scheduledDates.length - 5}件の予定を表示`}
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 最終勤務情報 */}
                        {worker.lastWorkDate && (
                          <div className="text-right text-xs text-gray-500">
                            <div className="flex items-center justify-end gap-1">
                              最終勤務:
                              {new Date(worker.lastWorkDate).toLocaleDateString('ja-JP', {
                                month: 'short',
                                day: 'numeric',
                              })}
                              <span className={`px-1 py-0.5 rounded text-[10px] ${worker.lastWorkFacilityType === 'our'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-600'
                                }`}>
                                {worker.lastWorkFacilityType === 'our' ? '自社' : '他社'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ページネーション */}
      {pagination && (
        <div className="flex justify-center pb-8 mt-4">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={(newPage) => {
              setPage(newPage);
              updateUrlParams({ page: newPage });
            }}
          />
        </div>
      )}

      {/* 勤務予定モーダル */}
      {scheduleModalWorker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setScheduleModalWorker(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-gray-900">{scheduleModalWorker.name}さんの勤務予定</h3>
              </div>
              <button
                onClick={() => setScheduleModalWorker(null)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-2">
                {scheduleModalWorker.schedules.map((schedule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-bold text-lg">
                        {new Date(schedule.date).toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-gray-500 text-sm">
                        ({new Date(schedule.date).toLocaleDateString('ja-JP', { weekday: 'short' })})
                      </span>
                    </div>
                    <span className="text-gray-700 font-medium text-sm">
                      {schedule.startTime} - {schedule.endTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setScheduleModalWorker(null)}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* レビュー対象選択モーダル */}
      {selectedReviewWorker && !selectedApplication && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedReviewWorker(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <h3 className="font-bold text-gray-900">{selectedReviewWorker.name}さんへのレビュー</h3>
              </div>
              <button
                onClick={() => setSelectedReviewWorker(null)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {pendingReviews.filter(r => r.userId === selectedReviewWorker.userId).length === 0 ? (
                <p className="text-center text-gray-500 py-4">レビュー対象がありません</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">レビューする求人を選択してください</p>
                  {pendingReviews
                    .filter(r => r.userId === selectedReviewWorker.userId)
                    .map((review) => (
                      <ReviewCard
                        key={review.applicationId}
                        applicationId={review.applicationId}
                        userName={review.userName}
                        userProfileImage={review.userProfileImage}
                        jobTitle={review.jobTitle}
                        workDate={review.workDate}
                        startTime={review.startTime}
                        endTime={review.endTime}
                        daysSinceWork={review.daysSinceWork}
                        onSelect={() => handleSelectReview(review)}
                        buttonColor="yellow"
                      />
                    ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setSelectedReviewWorker(null)}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* レビュー入力モーダル */}
      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedApplication(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* モーダルヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">レビュー入力</h2>
              <button onClick={() => setSelectedApplication(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* ワーカー情報 */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  {selectedApplication.userProfileImage ? (
                    <img src={selectedApplication.userProfileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                      {selectedApplication.userName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold">{selectedApplication.userName}</p>
                  <p className="text-sm text-gray-600">{selectedApplication.jobTitle}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(selectedApplication.workDate).toLocaleDateString('ja-JP')} {selectedApplication.startTime}-{selectedApplication.endTime}
                  </p>
                </div>
              </div>
            </div>

            {/* 評価入力 */}
            <div className="px-6 py-4">
              {/* 注意書き */}
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  減点採点になります。問題点がない場合は5点を記載してください。
                </p>
              </div>

              {/* 5項目の評価 */}
              <div className="space-y-6">
                {RATING_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{category.label}</span>
                      <StarRating
                        value={ratings[category.key as keyof typeof ratings]}
                        onChange={(v) => setRatings(prev => ({ ...prev, [category.key]: v }))}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{category.description}</p>
                  </div>
                ))}
              </div>

              {/* コメント入力 */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium">コメント</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTemplateId || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedTemplateId(id || null);
                        const template = templates.find(t => t.id === id);
                        if (template) setComment(template.content);
                      }}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">テンプレートから選択</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      編集
                    </button>
                  </div>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="良かった点などを具体的に記入すると、また働きたいと思われてもらいやすいです"
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* アクションボタン */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <div className="space-y-2">
                {/* 1行目：レビュー登録 + キャンセル */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSubmitReview('submit')}
                    className="px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    レビュー登録
                  </button>
                  <button
                    onClick={() => setSelectedApplication(null)}
                    className="px-4 py-3 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200"
                  >
                    キャンセル
                  </button>
                </div>

                {/* 2行目：お気に入り + ブロック */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSubmitReview('favorite')}
                    className="px-3 py-2.5 bg-pink-50 text-pink-700 border border-pink-200 text-sm font-medium rounded-lg hover:bg-pink-100 flex items-center justify-center gap-1.5"
                  >
                    <Heart className="w-4 h-4" />
                    お気に入りして登録
                  </button>
                  <button
                    onClick={() => handleSubmitReview('block')}
                    className="px-3 py-2.5 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100 flex items-center justify-center gap-1.5"
                  >
                    <Ban className="w-4 h-4" />
                    ブロックして登録
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* テンプレート編集モーダル */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
            setIsCreatingTemplate(false);
            setNewTemplateName('');
            setNewTemplateContent('');
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold">テンプレート管理</h2>
              <button onClick={() => {
                setShowTemplateModal(false);
                setEditingTemplate(null);
                setIsCreatingTemplate(false);
                setNewTemplateName('');
                setNewTemplateContent('');
              }}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 新規作成/編集フォーム */}
              {(isCreatingTemplate || editingTemplate) && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900">
                    {editingTemplate ? 'テンプレートを編集' : '新規テンプレート作成'}
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="例：良い評価テンプレート"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                    <textarea
                      value={newTemplateContent}
                      onChange={(e) => setNewTemplateContent(e.target.value)}
                      placeholder="テンプレートの内容を入力..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setEditingTemplate(null);
                        setIsCreatingTemplate(false);
                        setNewTemplateName('');
                        setNewTemplateContent('');
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {editingTemplate ? '更新' : '作成'}
                    </button>
                  </div>
                </div>
              )}

              {/* 新規作成ボタン */}
              {!isCreatingTemplate && !editingTemplate && (
                <button
                  onClick={() => setIsCreatingTemplate(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新規テンプレートを作成
                </button>
              )}

              {/* テンプレート一覧 */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-700">保存済みテンプレート</h3>
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">テンプレートはまだありません</p>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium text-gray-900">{template.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setNewTemplateName(template.name);
                              setNewTemplateContent(template.content);
                              setIsCreatingTemplate(false);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="編集"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{template.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
