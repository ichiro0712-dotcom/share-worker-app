'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronUp, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFacilityApplicationsByWorker,
  updateApplicationStatus,
} from '@/src/lib/actions';

interface WorkerApplication {
  id: number;
  status: string;
  createdAt: string;
  job: {
    id: number;
    title: string;
    workDate: string;
    startTime: string;
    endTime: string;
    hourlyWage: number;
  };
}

interface WorkerWithApplications {
  user: {
    id: number;
    name: string;
    email: string;
    phoneNumber: string;
    profileImage: string | null;
    qualifications: string[];
  };
  rating: number | null;
  reviewCount: number;
  lastMinuteCancelRate: number;
  applications: WorkerApplication[];
}

function ApplicationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [workers, setWorkers] = useState<WorkerWithApplications[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'applied' | 'scheduled'>('all');
  const [expandedWorkers, setExpandedWorkers] = useState<Set<number>>(new Set());

  // 認証チェック
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
        const workersData = await getFacilityApplicationsByWorker(admin.facilityId);
        setWorkers(workersData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [admin?.facilityId]);

  // マッチング処理
  const handleMatch = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'SCHEDULED', admin.facilityId);

      if (result.success) {
        toast.success(result.message || 'マッチングが成立しました');
        setWorkers((prev) =>
          prev.map((worker) => ({
            ...worker,
            applications: worker.applications.map((app) =>
              app.id === applicationId ? { ...app, status: 'SCHEDULED' } : app
            ),
          }))
        );
      } else {
        toast.error(result.error || 'マッチングに失敗しました');
      }
    } catch (error) {
      console.error('Failed to match:', error);
      toast.error('マッチングに失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  // キャンセル処理（応募のキャンセル）
  const handleCancel = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    if (!confirm('この応募をキャンセルしますか？')) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'CANCELLED', admin.facilityId);

      if (result.success) {
        toast.success(result.message || 'キャンセルしました');
        setWorkers((prev) =>
          prev.map((worker) => ({
            ...worker,
            applications: worker.applications.map((app) =>
              app.id === applicationId ? { ...app, status: 'CANCELLED' } : app
            ),
          }))
        );
      } else {
        toast.error(result.error || 'キャンセルに失敗しました');
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
      toast.error('キャンセルに失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  // マッチングキャンセル処理（マッチング済みを応募中に戻す）
  const handleUnmatch = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    if (!confirm('マッチングをキャンセルして応募中に戻しますか？')) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'APPLIED', admin.facilityId);

      if (result.success) {
        toast.success('マッチングをキャンセルしました');
        setWorkers((prev) =>
          prev.map((worker) => ({
            ...worker,
            applications: worker.applications.map((app) =>
              app.id === applicationId ? { ...app, status: 'APPLIED' } : app
            ),
          }))
        );
      } else {
        toast.error(result.error || 'マッチングキャンセルに失敗しました');
      }
    } catch (error) {
      console.error('Failed to unmatch:', error);
      toast.error('マッチングキャンセルに失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  // 全てマッチング処理
  const handleMatchAll = async (workerId: number) => {
    if (!admin?.facilityId) return;

    const worker = workers.find((w) => w.user.id === workerId);
    if (!worker) return;

    const appliedApplications = worker.applications.filter((app) => app.status === 'APPLIED');
    if (appliedApplications.length === 0) {
      toast.error('マッチング可能な応募がありません');
      return;
    }

    if (!confirm(`${worker.user.name}さんの応募${appliedApplications.length}件を全てマッチングしますか？`)) return;

    let successCount = 0;
    let failCount = 0;

    for (const app of appliedApplications) {
      setIsUpdating(app.id);
      try {
        const result = await updateApplicationStatus(app.id, 'SCHEDULED', admin.facilityId);
        if (result.success) {
          successCount++;
          setWorkers((prev) =>
            prev.map((w) => ({
              ...w,
              applications: w.applications.map((a) =>
                a.id === app.id ? { ...a, status: 'SCHEDULED' } : a
              ),
            }))
          );
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    setIsUpdating(null);

    if (failCount === 0) {
      toast.success(`${successCount}件のマッチングが成立しました`);
    } else {
      toast.error(`${successCount}件成功、${failCount}件失敗しました`);
    }
  };

  // フィルタリング
  const filteredWorkers = workers.filter((worker) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'applied') {
      return worker.applications.some((app) => app.status === 'APPLIED');
    }
    if (statusFilter === 'scheduled') {
      return worker.applications.some((app) => app.status === 'SCHEDULED');
    }
    return true;
  });

  // 展開/折りたたみ切り替え
  const toggleExpand = (workerId: number) => {
    setExpandedWorkers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
      } else {
        newSet.add(workerId);
      }
      return newSet;
    });
  };

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-900 font-bold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">ワーカー</th>
                <th className="px-6 py-4 whitespace-nowrap">評価</th>
                <th className="px-6 py-4 whitespace-nowrap">
                  <div>直前キャンセル率</div>
                </th>
                <th className="px-6 py-4 min-w-[450px]">
                  <div>応募中一覧</div>
                  <div className="text-xs font-normal text-gray-500">(案件ID / 日時 / 求人タイトル)</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    応募者がいません
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker) => {
                  const isExpanded = expandedWorkers.has(worker.user.id);
                  const visibleApps = isExpanded
                    ? worker.applications
                    : worker.applications.slice(0, 3);
                  const hasMore = worker.applications.length > 3;

                  return (
                    <tr key={worker.user.id} className="hover:bg-gray-50 transition-colors">
                      {/* ワーカー（顔写真付き） */}
                      <td className="px-6 py-4 align-top">
                        <Link
                          href={`/admin/workers/${worker.user.id}`}
                          className="flex items-center gap-3 text-primary hover:underline font-medium"
                        >
                          {worker.user.profileImage ? (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                              <Image
                                src={worker.user.profileImage}
                                alt={worker.user.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <UserCircle className="w-10 h-10 text-gray-400 flex-shrink-0" />
                          )}
                          <span>{worker.user.name}</span>
                        </Link>
                      </td>

                      {/* 評価 */}
                      <td className="px-6 py-4 align-top font-bold text-gray-900">
                        {worker.rating !== null ? worker.rating.toFixed(1) : '-'}
                      </td>

                      {/* 直前キャンセル率 */}
                      <td className="px-6 py-4 align-top">
                        <span className={`font-medium ${
                          worker.lastMinuteCancelRate > 10
                            ? 'text-red-600'
                            : worker.lastMinuteCancelRate > 0
                            ? 'text-yellow-600'
                            : 'text-gray-900'
                        }`}>
                          {worker.lastMinuteCancelRate.toFixed(0)}%
                        </span>
                      </td>

                      {/* 応募中一覧 */}
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-3">
                          {visibleApps.map((app) => (
                            <div key={app.id} className="flex flex-col gap-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                              <div className="flex items-start gap-4 text-xs">
                                <Link
                                  href={`/admin/jobs/${app.job.id}`}
                                  className="text-primary font-medium whitespace-nowrap hover:underline"
                                >
                                  #{app.job.id}
                                </Link>
                                <span className="whitespace-nowrap text-gray-700">
                                  {app.job.workDate} {app.job.startTime}〜{app.job.endTime}
                                </span>
                                <Link
                                  href={`/admin/jobs/${app.job.id}`}
                                  className="text-gray-600 line-clamp-1 hover:text-primary hover:underline"
                                >
                                  {app.job.title}
                                </Link>
                              </div>

                              {app.status === 'APPLIED' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleMatch(app.id)}
                                    disabled={isUpdating === app.id}
                                    className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    マッチング
                                  </button>
                                  <button
                                    onClick={() => handleCancel(app.id)}
                                    disabled={isUpdating === app.id}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              )}
                              {app.status === 'SCHEDULED' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 text-xs font-medium">マッチング済み</span>
                                  <button
                                    onClick={() => handleUnmatch(app.id)}
                                    disabled={isUpdating === app.id}
                                    className="px-3 py-1 bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200 transition-colors disabled:opacity-50"
                                  >
                                    マッチング取消
                                  </button>
                                </div>
                              )}
                              {app.status === 'CANCELLED' && (
                                <span className="text-red-600 text-xs font-medium">キャンセル済み</span>
                              )}
                            </div>
                          ))}

                          {/* もっと表示・全てマッチングボタン */}
                          <div className="flex items-center gap-3 mt-1">
                            {hasMore && (
                              <button
                                onClick={() => toggleExpand(worker.user.id)}
                                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    閉じる
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    もっと表示 (+{worker.applications.length - 3}件)
                                  </>
                                )}
                              </button>
                            )}
                            {worker.applications.some((app) => app.status === 'APPLIED') && (
                              <button
                                onClick={() => handleMatchAll(worker.user.id)}
                                disabled={isUpdating !== null}
                                className="px-2 py-0.5 bg-green-600 text-white text-[10px] rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                全てマッチング
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ページネーション（表示のみ） */}
        <div className="bg-white px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {filteredWorkers.length}件のうち1 - {filteredWorkers.length}
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-500">
              «
            </button>
            <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-500">
              ‹
            </button>
            <button className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded">
              1
            </button>
            <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-500">
              ›
            </button>
            <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-500">
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ApplicationsContent />
    </Suspense>
  );
}
