'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, ChevronDown, Users, Calendar, Clock, Play, CheckCircle, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getFacilityMatchedWorkers, updateApplicationStatus } from '@/src/lib/actions';

type StatusFilter = 'all' | 'SCHEDULED' | 'WORKING' | 'COMPLETED_PENDING' | 'COMPLETED_RATED';

interface MatchedWorker {
  applicationId: number;
  status: string;
  user: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
  };
  job: {
    id: number;
    title: string;
    workDate: string;
    startTime: string;
    endTime: string;
  };
}

export default function AdminWorkersPage() {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [workers, setWorkers] = useState<MatchedWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

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
        const data = await getFacilityMatchedWorkers(admin.facilityId);
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

  // 勤務開始処理
  const handleStartWork = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'WORKING', admin.facilityId);
      if (result.success) {
        toast.success('勤務開始しました');
        setWorkers((prev) =>
          prev.map((w) =>
            w.applicationId === applicationId ? { ...w, status: 'WORKING' } : w
          )
        );
      } else {
        toast.error(result.error || '更新に失敗しました');
      }
    } catch (error) {
      toast.error('更新に失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  // 勤務完了処理
  const handleCompleteWork = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'COMPLETED_PENDING', admin.facilityId);
      if (result.success) {
        toast.success('勤務完了しました（評価待ち）');
        setWorkers((prev) =>
          prev.map((w) =>
            w.applicationId === applicationId ? { ...w, status: 'COMPLETED_PENDING' } : w
          )
        );
      } else {
        toast.error(result.error || '更新に失敗しました');
      }
    } catch (error) {
      toast.error('更新に失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return { text: '勤務予定', color: 'bg-purple-100 text-purple-800' };
      case 'WORKING':
        return { text: '勤務中', color: 'bg-green-100 text-green-800' };
      case 'COMPLETED_PENDING':
        return { text: '完了・評価待ち', color: 'bg-yellow-100 text-yellow-800' };
      case 'COMPLETED_RATED':
        return { text: '完了', color: 'bg-gray-100 text-gray-800' };
      default:
        return { text: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getFilterLabel = (filter: StatusFilter) => {
    switch (filter) {
      case 'all':
        return '全て';
      case 'SCHEDULED':
        return '勤務予定';
      case 'WORKING':
        return '勤務中';
      case 'COMPLETED_PENDING':
        return '評価待ち';
      case 'COMPLETED_RATED':
        return '完了';
    }
  };

  // フィルタリング
  const filteredWorkers = workers.filter((w) =>
    statusFilter === 'all' ? true : w.status === statusFilter
  );

  // 日付でグループ化
  const groupedByDate = filteredWorkers.reduce((acc, worker) => {
    const date = worker.job.workDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(worker);
    return acc;
  }, {} as Record<string, MatchedWorker[]>);

  // 日付でソート
  const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">ワーカー管理</h1>
          <p className="text-sm text-gray-600 mt-1">
            マッチ済みワーカー ({workers.length}件)
          </p>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <span className="text-sm">{getFilterLabel(statusFilter)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showFilterMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[150px]">
                {(['all', 'SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] as StatusFilter[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setStatusFilter(filter);
                        setShowFilterMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${statusFilter === filter ? 'text-primary font-medium' : ''
                        }`}
                    >
                      {getFilterLabel(filter)}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <span className="text-sm text-gray-600">{filteredWorkers.length}件</span>
        </div>
      </div>

      {/* ワーカー一覧 */}
      <div className="p-4">
        {filteredWorkers.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">
              {statusFilter === 'all'
                ? 'マッチ済みワーカーがいません'
                : `${getFilterLabel(statusFilter)}のワーカーがいません`}
            </h3>
            <p className="text-sm text-gray-600">
              応募管理から新しいワーカーとマッチングしましょう
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date}>
                {/* 日付ヘッダー */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <h2 className="font-bold text-gray-900">
                    {new Date(date).toLocaleDateString('ja-JP', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </h2>
                  <span className="text-sm text-gray-500">
                    ({groupedByDate[date].length}件)
                  </span>
                </div>

                {/* ワーカーカード */}
                <div className="space-y-3">
                  {groupedByDate[date].map((worker) => {
                    const status = getStatusLabel(worker.status);
                    return (
                      <div
                        key={worker.applicationId}
                        className="bg-white rounded-lg border border-gray-200 p-4"
                      >
                        <div className="flex items-start gap-3">
                          {/* プロフィール画像 */}
                          <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                            {worker.user.profileImage ? (
                              <img
                                src={worker.user.profileImage}
                                alt={worker.user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <User className="w-7 h-7" />
                              </div>
                            )}
                          </div>

                          {/* ワーカー情報 */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900">{worker.user.name}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded ${status.color}`}>
                                {status.text}
                              </span>
                            </div>

                            <p className="text-sm text-gray-600 mb-2">{worker.job.title}</p>

                            <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {worker.job.startTime}〜{worker.job.endTime}
                                </span>
                              </div>
                            </div>

                            {/* 資格 */}
                            <div className="flex flex-wrap gap-1">
                              {worker.user.qualifications.map((qual, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                                >
                                  {qual}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {worker.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleStartWork(worker.applicationId)}
                              disabled={isUpdating === worker.applicationId}
                              className="w-full py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                              <Play className="w-4 h-4" />
                              勤務開始
                            </button>
                          )}

                          {worker.status === 'WORKING' && (
                            <button
                              onClick={() => handleCompleteWork(worker.applicationId)}
                              disabled={isUpdating === worker.applicationId}
                              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              勤務完了
                            </button>
                          )}

                          {worker.status === 'COMPLETED_PENDING' && (
                            <button
                              onClick={() => router.push(`/admin/workers/${worker.user.id}/review?applicationId=${worker.applicationId}`)}
                              className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <Star className="w-4 h-4" />
                              評価する
                            </button>
                          )}

                          {worker.status === 'COMPLETED_RATED' && (
                            <div className="text-center text-sm text-gray-500">
                              評価完了
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
