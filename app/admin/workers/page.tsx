'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import {
  getWorkerListForFacility,
  toggleWorkerFavorite,
  toggleWorkerBlock,
  type WorkerListItem,
  type WorkerListStatus,
} from '@/src/lib/actions';
import { Pagination } from '@/components/ui/Pagination';

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

type StatusFilterType = 'all' | WorkerListStatus;
type JobCategoryType = 'kaigo' | 'kango' | 'yakuzai';
type SortByType = 'workCount_desc' | 'workCount_asc' | 'lastWorkDate_desc' | 'lastWorkDate_asc';

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
  const [workers, setWorkers] = useState<WorkerListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // 検索・フィルター・並び替え
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [jobCategories, setJobCategories] = useState<JobCategoryType[]>([]); // 複数選択
  const [sortBy, setSortBy] = useState<SortByType>('lastWorkDate_desc');


  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.facilityId) return;

      setIsLoading(true);
      try {
        // @ts-ignore
        const response = await getWorkerListForFacility(admin.facilityId, {
          page,
          limit: 10,
          keyword,
          status: statusFilter,
          // @ts-ignore
          jobCategory: jobCategories.length > 0 ? jobCategories[0] : 'all',
          sort: sortBy
        });

        if (response && 'pagination' in response) {
          // @ts-ignore
          setWorkers(response.data);
          // @ts-ignore
          setPagination(response.pagination);
        } else {
          // @ts-ignore
          setWorkers(response); // Fallback for old API if needed types update
        }

      } catch (error) {
        const debugInfo = extractDebugInfo(error);
        showDebugError({
          type: 'fetch',
          operation: 'ワーカー一覧取得',
          message: debugInfo.message,
          details: debugInfo.details,
          stack: debugInfo.stack,
          context: { facilityId: admin?.facilityId, page, keyword, statusFilter, jobCategories, sortBy }
        });
        console.error('Failed to fetch workers:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [admin?.facilityId, page, keyword, statusFilter, jobCategories, sortBy]);

  // クライアント側でのソート・フィルターは削除（サーバーサイドで実施）
  const filteredWorkers = workers;

  // お気に入りトグル
  const handleToggleFavorite = async (e: React.MouseEvent, userId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!admin) return;
    try {
      const result = await toggleWorkerFavorite(userId, admin.facilityId);
      if (result.success) {
        setWorkers(prev => prev.map(w =>
          w.userId === userId ? { ...w, isFavorite: result.isFavorite || false } : w
        ));
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
        setWorkers(prev => prev.map(w =>
          w.userId === userId ? { ...w, isBlocked: result.isBlocked || false } : w
        ));
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

  const getStatusLabel = (status: WorkerListStatus) => {
    switch (status) {
      case 'NOT_STARTED':
        return { text: '未就労', ribbonColor: 'bg-purple-500', textColor: 'text-white' };
      case 'WORKING':
        return { text: '就労中', ribbonColor: 'bg-green-500', textColor: 'text-white' };
      case 'COMPLETED':
        return { text: '就労済', ribbonColor: 'bg-blue-500', textColor: 'text-white' };
      case 'CANCELLED':
        return { text: 'キャン', ribbonColor: 'bg-red-500', textColor: 'text-white' };
      default:
        return { text: status, ribbonColor: 'bg-gray-500', textColor: 'text-white' };
    }
  };

  // 主要なステータスを1つ取得（優先順位: 就労中 > 未就労 > 就労済 > キャンセル）
  const getPrimaryStatus = (statuses: WorkerListStatus[]): WorkerListStatus | null => {
    if (statuses.includes('WORKING')) return 'WORKING';
    if (statuses.includes('NOT_STARTED')) return 'NOT_STARTED';
    if (statuses.includes('COMPLETED')) return 'COMPLETED';
    if (statuses.includes('CANCELLED')) return 'CANCELLED';
    return null;
  };

  const getFilterLabel = (filter: StatusFilterType) => {
    switch (filter) {
      case 'all':
        return '全て';
      case 'NOT_STARTED':
        return '未就労';
      case 'WORKING':
        return '就労中';
      case 'COMPLETED':
        return '就労済';
      case 'CANCELLED':
        return 'キャンセル';
    }
  };

  const toggleJobCategory = (category: JobCategoryType) => {
    setJobCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-primary"></div>
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

          {/* 職種チェックボックス */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={jobCategories.includes('kaigo')}
                onChange={() => toggleJobCategory('kaigo')}
                className="w-4 h-4 rounded border-gray-300 text-admin-primary focus:ring-admin-primary"
              />
              <span className="text-sm">介護</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={jobCategories.includes('kango')}
                onChange={() => toggleJobCategory('kango')}
                className="w-4 h-4 rounded border-gray-300 text-admin-primary focus:ring-admin-primary"
              />
              <span className="text-sm">看護</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={jobCategories.includes('yakuzai')}
                onChange={() => toggleJobCategory('yakuzai')}
                className="w-4 h-4 rounded border-gray-300 text-admin-primary focus:ring-admin-primary"
              />
              <span className="text-sm">薬剤師</span>
            </label>
          </div>
        </div>
      </div>

      {/* ステータスボタン + 並び替え */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* ステータスフィルターボタン */}
          <div className="flex items-center gap-1">
            {(['all', 'NOT_STARTED', 'WORKING', 'COMPLETED', 'CANCELLED'] as StatusFilterType[]).map(
              (filter) => {
                const getDotColor = () => {
                  switch (filter) {
                    case 'NOT_STARTED': return 'bg-purple-500';
                    case 'WORKING': return 'bg-green-500';
                    case 'COMPLETED': return 'bg-blue-500';
                    case 'CANCELLED': return 'bg-red-500';
                    default: return '';
                  }
                };

                // 「すべて」はドットなしの青ボタン
                if (filter === 'all') {
                  return (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
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
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${statusFilter === filter
                      ? 'bg-gray-200 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${getDotColor()}`}></span>
                    {getFilterLabel(filter)}
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
                onChange={(e) => setSortBy(e.target.value as SortByType)}
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
              {keyword || statusFilter !== 'all' || jobCategories.length > 0
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
                          <div className={`absolute -top-1 -left-1 px-1.5 py-0.5 ${statusInfo.ribbonColor} text-white text-[9px] font-bold rounded shadow z-10`}>
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
                        {/* お気に入り・ブロックボタン */}
                        <div className="flex gap-1.5">
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
            onPageChange={setPage}
          />
        </div>
      )}
    </div>


  );
}
