'use client';

import { useState, useEffect } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { MapPin, Calendar, Clock, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMyApplications } from '@/src/lib/actions';

type ApplicationStatus = 'APPLIED' | 'SCHEDULED' | 'WORKING' | 'COMPLETED_PENDING' | 'COMPLETED_RATED' | 'CANCELLED';

interface Application {
  id: number;
  job_id: number;
  status: ApplicationStatus;
  created_at: string;
  worker_review_status: 'PENDING' | 'COMPLETED' | null;
  facility_review_status: 'PENDING' | 'COMPLETED' | null;
  job: {
    id: number;
    title: string;
    work_date: string;
    start_time: string;
    end_time: string;
    hourly_wage: number;
    transportation_fee: number;
    wage: number;
    address: string;
    facility: {
      id: number;
      facility_name: string;
    };
  };
}

type TabType = 'scheduled' | 'working' | 'completed_rated' | 'cancelled';

export default function MyJobsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        // ステータス更新をトリガー
        await fetch('/api/cron/update-statuses');

        const data = await getMyApplications();
        setApplications(data as Application[]);
      } catch (error) {
        console.error('Failed to fetch applications:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const tabs: Array<{ id: TabType; label: string; status: ApplicationStatus }> = [
    { id: 'scheduled', label: '仕事の予定', status: 'SCHEDULED' },
    { id: 'working', label: '勤務中', status: 'WORKING' },
    { id: 'completed_rated', label: '完了', status: 'COMPLETED_RATED' },
    { id: 'cancelled', label: 'キャンセル', status: 'CANCELLED' },
  ];

  const getStatusFromTab = (tabId: TabType): ApplicationStatus => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.status || 'SCHEDULED';
  };

  const filteredApplications = applications.filter((app) => {
    const targetStatus = getStatusFromTab(activeTab);
    return app.status === targetStatus;
  });

  const handleJobClick = (jobId: number) => {
    router.push(`/jobs/${jobId}`);
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    const badges: Record<ApplicationStatus, { text: string; color: string }> = {
      APPLIED: { text: '応募中', color: 'bg-blue-100 text-blue-700' },
      SCHEDULED: { text: '予定', color: 'bg-purple-100 text-purple-700' },
      WORKING: { text: '勤務中', color: 'bg-green-100 text-green-700' },
      COMPLETED_PENDING: { text: '評価待', color: 'bg-red-100 text-red-700' },
      COMPLETED_RATED: { text: '完了', color: 'bg-gray-100 text-gray-700' },
      CANCELLED: { text: 'キャンセル', color: 'bg-gray-100 text-gray-500' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const formatTime = (timeString: string): string => {
    return timeString.substring(0, 5);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">仕事管理</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">仕事管理</h1>
      </div>

      {/* タブ */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => {
            const count = applications.filter((app) => app.status === tab.status).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
                {count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* 求人カード一覧 */}
      <div className="p-3 space-y-2">
        {filteredApplications.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {activeTab === 'scheduled' && '予定されている仕事はありません'}
              {activeTab === 'working' && '現在勤務中の仕事はありません'}
              {activeTab === 'completed_rated' && '完了した仕事はありません'}
              {activeTab === 'cancelled' && 'キャンセルした仕事はありません'}
            </p>
          </div>
        ) : (
          filteredApplications.map((app) => (
            <div
              key={app.id}
              onClick={() => handleJobClick(app.job.id)}
              className="w-full bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-left overflow-hidden cursor-pointer"
            >
              <div className="p-3">
                {/* 上部: ステータスと施設名・職種 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate mb-0.5">
                      {app.job.facility.facility_name}
                    </h3>
                    <p className="text-xs text-gray-600 truncate">{app.job.title}</p>
                  </div>
                  {activeTab !== 'cancelled' && (
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(app.status).color
                        }`}
                    >
                      {getStatusBadge(app.status).text}
                    </span>
                  )}
                </div>

                {/* 中部: 日時・時間・場所を1行に */}
                <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>{new Date(app.job.work_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span>{formatTime(app.job.start_time)}-{formatTime(app.job.end_time)}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{app.job.address}</span>
                  </div>
                </div>

                {/* 下部: 給与情報とアクションボタン */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-0.5 text-gray-600">
                      <span>時給</span>
                      <span className="font-bold">¥{app.job.hourly_wage.toLocaleString()}</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-0.5 text-gray-600">
                      <span>交通費</span>
                      <span className="font-medium">¥{app.job.transportation_fee.toLocaleString()}</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-0.5 text-primary">
                      <span>総額</span>
                      <span className="font-bold">¥{app.job.wage.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* アクションボタン（コンパクト版） */}
                  {activeTab === 'scheduled' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('キャンセル:', app.id);
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/messages?roomId=${app.job.facility.facility_name}`);
                        }}
                        className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                      >
                        メッセージ
                      </button>
                    </div>
                  )}

                  {activeTab === 'working' && (
                    <div className="flex gap-1.5">
                      {app.worker_review_status !== 'COMPLETED' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/mypage/reviews/${app.id}`);
                          }}
                          className="px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" />
                          レビュー
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          レビュー済
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/messages?roomId=${app.job.facility.facility_name}`);
                        }}
                        className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                      >
                        メッセージ
                      </button>
                    </div>
                  )}

                  {activeTab === 'completed_rated' && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">評価済み</span>
                    </div>
                  )}
                </div>

                {/* 勤務中の注意書き */}
                {activeTab === 'working' && app.worker_review_status !== 'COMPLETED' && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-orange-600 flex items-center gap-1">
                      <span>※勤務終了までにレビューをお願いします</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
