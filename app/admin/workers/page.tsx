'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  getWorkerListForFacility,
  toggleWorkerFavorite,
  toggleWorkerBlock,
  type WorkerListItem,
  type WorkerListStatus,
} from '@/src/lib/actions';

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
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [workers, setWorkers] = useState<WorkerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 検索・フィルター・並び替え
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [jobCategories, setJobCategories] = useState<JobCategoryType[]>([]); // 複数選択
  const [sortBy, setSortBy] = useState<SortByType>('workCount_desc');


  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // データ取得（フィルターなしで全件取得）
  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.facilityId) return;

      setIsLoading(true);
      try {
        const data = await getWorkerListForFacility(admin.facilityId);
        setWorkers(data);
      } catch (error) {
        console.error('Failed to fetch workers:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [admin?.facilityId]);

  // クライアント側でフィルター・ソート
  const filteredWorkers = useMemo(() => {
    let result = [...workers];

    // キーワード検索
    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(kw) ||
        (w.prefecture && w.prefecture.toLowerCase().includes(kw)) ||
        (w.city && w.city.toLowerCase().includes(kw))
      );
    }

    // ステータスフィルター
    if (statusFilter !== 'all') {
      result = result.filter(w => w.statuses.includes(statusFilter));
    }

    // 職種フィルター（複数選択）
    if (jobCategories.length > 0) {
      const kaigoQuals = ['介護福祉士', '介護職員初任者研修', '実務者研修', 'ケアマネージャー'];
      const kangoQuals = ['看護師', '准看護師'];
      const yakuzaiQuals = ['薬剤師'];

      result = result.filter(w => {
        return jobCategories.some(cat => {
          let targetQuals: string[] = [];
          switch (cat) {
            case 'kaigo':
              targetQuals = kaigoQuals;
              break;
            case 'kango':
              targetQuals = kangoQuals;
              break;
            case 'yakuzai':
              targetQuals = yakuzaiQuals;
              break;
          }
          return w.qualifications.some(q => targetQuals.some(tq => q.includes(tq)));
        });
      });
    }

    // ソート
    switch (sortBy) {
      case 'workCount_desc':
        result.sort((a, b) => b.totalWorkCount - a.totalWorkCount);
        break;
      case 'workCount_asc':
        result.sort((a, b) => a.totalWorkCount - b.totalWorkCount);
        break;
      case 'lastWorkDate_desc':
        result.sort((a, b) => {
          if (!a.lastWorkDate && !b.lastWorkDate) return 0;
          if (!a.lastWorkDate) return 1;
          if (!b.lastWorkDate) return -1;
          return new Date(b.lastWorkDate).getTime() - new Date(a.lastWorkDate).getTime();
        });
        break;
      case 'lastWorkDate_asc':
        result.sort((a, b) => {
          if (!a.lastWorkDate && !b.lastWorkDate) return 0;
          if (!a.lastWorkDate) return 1;
          if (!b.lastWorkDate) return -1;
          return new Date(a.lastWorkDate).getTime() - new Date(b.lastWorkDate).getTime();
        });
        break;
    }

    return result;
  }, [workers, keyword, statusFilter, jobCategories, sortBy]);

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
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        statusFilter === filter
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
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      statusFilter === filter
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWorkers.map((worker) => {
              const experienceData = worker.experienceFields
                ? Object.entries(worker.experienceFields).slice(0, 4)
                : [];

              return (
                <Link
                  key={worker.userId}
                  href={`/admin/workers/${worker.userId}`}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full"
                >
                  {/* カード本体 */}
                  <div className="p-4 flex-1 flex flex-col relative">
                    {/* 左上三角リボン（ステータス表示） */}
                    {(() => {
                      const primaryStatus = getPrimaryStatus(worker.statuses);
                      if (!primaryStatus) return null;
                      const statusInfo = getStatusLabel(primaryStatus);
                      return (
                        <div className="absolute top-0 left-0 w-12 h-12 overflow-hidden pointer-events-none z-10">
                          {/* 三角形の背景 */}
                          <div
                            className={`absolute top-0 left-0 w-full h-full ${statusInfo.ribbonColor}`}
                            style={{
                              clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                            }}
                          />
                          {/* テキスト */}
                          <span
                            className={`absolute top-2.5 left-1 text-[10px] font-bold ${statusInfo.textColor} transform -rotate-45`}
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            {statusInfo.text}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex items-start gap-3 pl-4">
                      {/* プロフィール画像 */}
                      <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 ring-2 ring-gray-100">
                        {worker.profileImage ? (
                          <img
                            src={worker.profileImage}
                            alt={worker.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                            {worker.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* 基本情報 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-900 truncate">{worker.name}</h3>
                          {/* お気に入り・ブロックボタン */}
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                            <button
                              onClick={(e) => handleToggleFavorite(e, worker.userId)}
                              className={`w-6 h-6 border rounded-full flex items-center justify-center transition-colors ${worker.isFavorite
                                ? 'bg-pink-50 border-pink-200 text-pink-500'
                                : 'bg-white border-gray-200 hover:bg-pink-50 text-gray-400 hover:text-pink-500'
                                }`}
                              title="お気に入り"
                            >
                              <Heart className={`w-3 h-3 ${worker.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => handleToggleBlock(e, worker.userId)}
                              className={`w-6 h-6 border rounded-full flex items-center justify-center transition-colors ${worker.isBlocked
                                ? 'bg-red-50 border-red-200 text-red-500'
                                : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                                }`}
                              title="ブロック"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* 住所 */}
                        {(worker.prefecture || worker.city) && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">
                              {worker.prefecture}
                              {worker.city}
                            </span>
                          </div>
                        )}

                        {/* 評価 */}
                        {worker.avgRating !== null && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                            <span className="text-sm font-medium text-gray-900">
                              {worker.avgRating.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-500">({worker.reviewCount}件)</span>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* 資格 */}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {worker.qualifications.slice(0, 3).map((qual, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                        >
                          {qual}
                        </span>
                      ))}
                      {worker.qualifications.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          +{worker.qualifications.length - 3}
                        </span>
                      )}
                    </div>

                    {/* 経験分野アイコン */}
                    {experienceData.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {experienceData.map(([field, years], i) => (
                          <div
                            key={i}
                            className={`group relative px-1.5 py-0.5 ${getExperienceColor(field)} text-white rounded text-[10px] font-medium cursor-help`}
                          >
                            {getAbbreviation(field)} {years}
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              {field}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 勤務統計（カード下部に固定） */}
                    <div className="mt-auto pt-3 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* 自社/他社勤務回数 */}
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-500" />
                          <span className="text-gray-600">自社:</span>
                          <span className="font-medium text-gray-900">{worker.ourWorkCount}回</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-600">他社:</span>
                          <span className="font-medium text-gray-900">{worker.otherWorkCount}回</span>
                        </div>
                        {/* 直前キャンセル率 */}
                        <div className="flex items-center gap-1 col-span-2">
                          <AlertTriangle className={`w-3 h-3 ${worker.lastMinuteCancelRate > 10 ? 'text-red-500' : 'text-gray-400'}`} />
                          <span className="text-gray-600">直前キャンセル率:</span>
                          <span className={`font-medium ${worker.lastMinuteCancelRate > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                            {worker.lastMinuteCancelRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* カードフッター */}
                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>総勤務 {worker.totalWorkCount}回</span>
                    {worker.lastWorkDate && (
                      <span className="flex items-center gap-1">
                        最終:
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
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
