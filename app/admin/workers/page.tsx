'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, MapPin, ChevronDown, Heart, Ban, Bookmark, Users } from 'lucide-react';
import { workers, workerApplications as initialApplications } from '@/data/workers';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkerStatus, ProfessionType, WorkerApplication } from '@/types/worker';

type SortType =
  | 'lastWorkDate'
  | 'distance'
  | 'workDaysDesc'
  | 'workDaysAsc';

export default function AdminWorkersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('lastWorkDate');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [professionFilters, setProfessionFilters] = useState<ProfessionType[]>([]);
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [applications, setApplications] = useState<WorkerApplication[]>(initialApplications);

  const toggleProfessionFilter = (profession: ProfessionType) => {
    setProfessionFilters(prev => {
      if (prev.includes(profession)) {
        return prev.filter(p => p !== profession);
      } else {
        return [...prev, profession];
      }
    });
  };

  const toggleFavorite = (appId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setApplications(prev =>
      prev.map(app =>
        app.id === appId ? { ...app, isFavorite: !app.isFavorite } : app
      )
    );
  };

  const toggleBlocked = (appId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setApplications(prev =>
      prev.map(app =>
        app.id === appId ? { ...app, isBlocked: !app.isBlocked } : app
      )
    );
  };


  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProfessionLabel = (profession: ProfessionType | 'all') => {
    switch (profession) {
      case 'nursing':
        return '看護';
      case 'care':
        return '介護';
      case 'pharmacy':
        return '薬剤師';
      case 'all':
        return '全て';
    }
  };

  const getStatusLabel = (status: WorkerStatus) => {
    switch (status) {
      case 'applied':
        return '応募';
      case 'scheduled':
        return '勤務予定';
      case 'working':
        return '勤務中';
      case 'completed_pending':
        return '評価待';
      case 'completed_rated':
        return '評価済み';
    }
  };

  const getStatusColor = (status: WorkerStatus) => {
    switch (status) {
      case 'applied':
        return 'bg-blue-600 text-white';
      case 'scheduled':
        return 'bg-purple-600 text-white';
      case 'working':
        return 'bg-green-600 text-white';
      case 'completed_pending':
        return 'bg-red-600 text-white';
      case 'completed_rated':
        return 'bg-gray-600 text-white';
    }
  };

  // フィルタリング（マッチ済みのみ: scheduled, working, completed_pending, completed_rated。応募ワーカーは含まない）
  let filteredApplications = applications
    .filter((app) => app.status === 'scheduled' || app.status === 'working' || app.status === 'completed_pending' || app.status === 'completed_rated')
    .filter((app) => {
      const worker = workers.find((w) => w.id === app.workerId);
      if (!worker) return false;
      if (professionFilters.length > 0 && !professionFilters.includes(worker.profession)) {
        return false;
      }
      if (showFavoriteOnly && !app.isFavorite) return false;
      if (showBlockedOnly && !app.isBlocked) return false;
      return worker.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  // ソート処理
  filteredApplications = [...filteredApplications].sort((a, b) => {
    const workerA = workers.find((w) => w.id === a.workerId);
    const workerB = workers.find((w) => w.id === b.workerId);

    switch (sortType) {
      case 'distance':
        const addressA = `${workerA?.prefecture}${workerA?.city}`;
        const addressB = `${workerB?.prefecture}${workerB?.city}`;
        return addressA.localeCompare(addressB, 'ja');
      case 'lastWorkDate':
        if (!a.lastWorkDate && !b.lastWorkDate) return 0;
        if (!a.lastWorkDate) return 1;
        if (!b.lastWorkDate) return -1;
        return (
          new Date(b.lastWorkDate).getTime() - new Date(a.lastWorkDate).getTime()
        );
      case 'workDaysDesc':
        return (workerB?.totalWorkDays || 0) - (workerA?.totalWorkDays || 0);
      case 'workDaysAsc':
        return (workerA?.totalWorkDays || 0) - (workerB?.totalWorkDays || 0);
      default:
        return 0;
    }
  });

  const getSortLabel = (sort: SortType) => {
    switch (sort) {
      case 'distance':
        return '住所（近い順）';
      case 'lastWorkDate':
        return '直近勤務日が近い順';
      case 'workDaysDesc':
        return '勤務回数（多い順）';
      case 'workDaysAsc':
        return '勤務回数（少ない順）';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">ワーカー管理</h1>
          <p className="text-sm text-gray-600 mt-1">
            マッチ済みワーカー ({applications.filter((a) => a.status === 'scheduled' || a.status === 'working' || a.status === 'completed_pending' || a.status === 'completed_rated').length}件)
          </p>
        </div>
      </div>

      {/* 検索バーとフィルター */}
      <div className="bg-white border-b border-gray-200 px-4 pb-3 pt-2 space-y-2">
        <input
          type="text"
          placeholder="ワーカー名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="flex items-center justify-between gap-2">
          {/* 職種フィルター */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setProfessionFilters([])}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.length === 0
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              全て
            </button>
            <button
              onClick={() => toggleProfessionFilter('nursing')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.includes('nursing')
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              看護
            </button>
            <button
              onClick={() => toggleProfessionFilter('care')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.includes('care')
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              介護
            </button>
            <button
              onClick={() => toggleProfessionFilter('pharmacy')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.includes('pharmacy')
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              薬剤師
            </button>
          </div>

          {/* ソート */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap"
            >
              <span>{getSortLabel(sortType)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showSortMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[180px]">
                <button
                  onClick={() => {
                    setSortType('lastWorkDate');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'lastWorkDate' ? 'text-primary font-medium' : ''
                  }`}
                >
                  直近勤務日が近い順
                </button>
                <button
                  onClick={() => {
                    setSortType('distance');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'distance' ? 'text-primary font-medium' : ''
                  }`}
                >
                  住所（近い順）
                </button>
                <button
                  onClick={() => {
                    setSortType('workDaysDesc');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'workDaysDesc' ? 'text-primary font-medium' : ''
                  }`}
                >
                  勤務回数（多い順）
                </button>
                <button
                  onClick={() => {
                    setSortType('workDaysAsc');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'workDaysAsc' ? 'text-primary font-medium' : ''
                  }`}
                >
                  勤務回数（少ない順）
                </button>
              </div>
            )}
          </div>
        </div>

        {/* アクションフィルター */}
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showFavoriteOnly}
              onChange={(e) => setShowFavoriteOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <Heart className="w-4 h-4 text-red-500" />
            <span>お気に入りのみ</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showBlockedOnly}
              onChange={(e) => setShowBlockedOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <Ban className="w-4 h-4 text-gray-500" />
            <span>ブロックのみ</span>
          </label>
        </div>

        <div className="text-sm text-gray-600">
          {filteredApplications.length}件
        </div>
      </div>

      {/* ワーカーカードグリッド */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredApplications.map((application) => {
            const worker = workers.find((w) => w.id === application.workerId);
            if (!worker) return null;

            return (
              <div
                key={application.id}
                className="relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* ステータスバッジと住所（左上） */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                  {/* ステータスバッジ（評価済み以外） */}
                  {application.status !== 'completed_rated' && (
                    <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(application.status)}`}>
                      {getStatusLabel(application.status)}
                    </span>
                  )}

                  {/* 住所 */}
                  <div className="flex items-start gap-1 text-xs text-gray-600">
                    <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <div className="truncate max-w-[80px]">{worker.prefecture}</div>
                      <div className="truncate max-w-[80px]">{worker.city}</div>
                    </div>
                  </div>
                </div>

                {/* アクションアイコン（右上） */}
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button
                    onClick={(e) => toggleFavorite(application.id, e)}
                    className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform ${
                      application.isFavorite ? '' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        application.isFavorite
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e) => toggleBlocked(application.id, e)}
                    className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform ${
                      application.isBlocked ? '' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Ban
                      className={`w-4 h-4 ${
                        application.isBlocked ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    />
                  </button>
                </div>

                <Link href={`/admin/workers/${worker.id}`} className="block">
                  {/* 顔写真 */}
                  <div className="p-3 pt-4 flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden">
                      {worker.photoUrl ? (
                        <img
                          src={worker.photoUrl}
                          alt={worker.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-2xl">{worker.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ワーカー基本情報 */}
                  <div className="px-3 pb-3">
                    <h3 className="font-bold text-center mb-1 truncate">
                      {worker.name}
                    </h3>

                    {/* 職種 */}
                    <div className="text-center mb-2">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        {getProfessionLabel(worker.profession)}
                      </span>
                    </div>

                    {/* 評価 */}
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-sm">
                        {worker.overallRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({worker.totalReviews})
                      </span>
                    </div>

                    {/* 資格 */}
                    <div className="flex flex-wrap gap-1 justify-center mb-2">
                      {worker.qualifications.map((qual, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-primary-light text-primary text-xs rounded"
                        >
                          {qual}
                        </span>
                      ))}
                    </div>

                    {/* 統計情報 */}
                    <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                      <div className="bg-gray-50 rounded p-1.5 text-center">
                        <div className="text-gray-500">勤務回数</div>
                        <div className="font-bold text-primary">
                          {worker.totalWorkDays}回
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded p-1.5 text-center">
                        <div className="text-gray-500">直前キャンセル</div>
                        <div className="font-bold text-orange-500">
                          {worker.lastMinuteCancelRate}%
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {filteredApplications.length === 0 && (
        <div className="p-4">
          <EmptyState
            icon={Users}
            title={searchQuery || professionFilters.length > 0
              ? '該当するワーカーが見つかりませんでした'
              : '登録ワーカーはいません'}
            description={searchQuery || professionFilters.length > 0
              ? '検索条件を変更してお試しください'
              : '応募管理から新しいワーカーとマッチングしましょう'}
            actionLabel="応募管理へ"
            actionLink="/admin/applications"
          />
        </div>
      )}
    </div>
  );
}
