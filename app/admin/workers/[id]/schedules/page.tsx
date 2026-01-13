'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock, MapPin, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Schedule {
  id: number;
  workDate: string;
  startTime: string;
  endTime: string;
  jobTitle: string;
  facilityName: string;
  status: string;
}

interface ScheduleData {
  workerId: number;
  workerName: string;
  upcomingSchedules: Schedule[];
  pastSchedules: Schedule[];
}

// 勤務区分を判定
const getShiftType = (startTime: string, endTime: string): { label: string; bgColor: string; textColor: string } => {
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  if (startHour >= 17 || endHour < startHour) {
    return { label: '夜勤', bgColor: 'bg-purple-100', textColor: 'text-purple-700' };
  }
  if (endHour <= 13) {
    return { label: '午前', bgColor: 'bg-orange-100', textColor: 'text-orange-700' };
  }
  if (startHour >= 13) {
    return { label: '午後', bgColor: 'bg-teal-100', textColor: 'text-teal-700' };
  }
  return { label: '日勤', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
};

// ステータスのバッジ
const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; bgColor: string; textColor: string }> = {
    accepted: { label: '確定', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    pending: { label: '承認待ち', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    completed: { label: '完了', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
    cancelled: { label: 'キャンセル', bgColor: 'bg-red-100', textColor: 'text-red-700' },
  };
  return statusMap[status] || { label: status, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
};

export default function WorkerSchedulesPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(params.id);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadSchedules = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/workers/${workerId}/schedules`);
        if (!response.ok) {
          throw new Error('勤務予定の取得に失敗しました');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Failed to load schedules:', err);
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadSchedules();
  }, [workerId, admin, isAdmin, isAdminLoading, router]);

  if (loading || isAdminLoading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          <div>
            <div className="h-5 bg-gray-200 rounded w-24 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-6">
          {/* Tabs Skeleton */}
          <div className="flex gap-2 mb-6">
            <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse" />
          </div>

          {/* Schedule List Skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ワーカーが見つかりません</p>
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  const schedules = activeTab === 'upcoming' ? data.upcomingSchedules : data.pastSchedules;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">勤務予定</h1>
          <p className="text-sm text-gray-500">{data.workerName}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            今後の予定 ({data.upcomingSchedules.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'past'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            過去の勤務 ({data.pastSchedules.length})
          </button>
        </div>

        {/* Schedule List */}
        <div className="space-y-3">
          {schedules.length > 0 ? (
            schedules.map((schedule) => {
              const shift = getShiftType(schedule.startTime, schedule.endTime);
              const status = getStatusBadge(schedule.status);
              const date = new Date(schedule.workDate);
              const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

              return (
                <div
                  key={schedule.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {/* Date */}
                    <div className="w-16 text-center bg-gray-50 rounded-lg p-2 flex-shrink-0">
                      <div className="text-xs text-gray-500">
                        {date.getMonth() + 1}月
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {date.getDate()}
                      </div>
                      <div className="text-xs text-gray-500">({weekday})</div>
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 ${shift.bgColor} ${shift.textColor} text-xs font-medium rounded`}>
                          {shift.label}
                        </span>
                        <span className={`px-2 py-0.5 ${status.bgColor} ${status.textColor} text-xs font-medium rounded`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-sm text-gray-900 mb-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {schedule.startTime} - {schedule.endTime}
                      </div>

                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                        <Building className="w-4 h-4 text-gray-400" />
                        {schedule.facilityName}
                      </div>

                      <div className="text-sm text-gray-500">
                        {schedule.jobTitle}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {activeTab === 'upcoming' ? '今後の勤務予定はありません' : '過去の勤務履歴はありません'}
              </p>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href={`/admin/workers/${workerId}`}
            className="text-blue-500 hover:underline text-sm"
          >
            ← ワーカー詳細に戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
