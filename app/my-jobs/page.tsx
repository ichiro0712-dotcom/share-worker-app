'use client';

import { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Star, X, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMyApplications, cancelApplicationByWorker, cancelAppliedApplication } from '@/src/lib/actions';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

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

type TabType = 'applied' | 'scheduled' | 'working' | 'completed_rated' | 'cancelled';

export default function MyJobsPage() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalApp, setCancelModalApp] = useState<Application | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // SCHEDULED/WORKINGキャンセル用モーダル
  const [scheduledCancelModalApp, setScheduledCancelModalApp] = useState<Application | null>(null);
  const [scheduledCancelling, setScheduledCancelling] = useState(false);

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
    { id: 'applied', label: '審査中', status: 'APPLIED' },
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
    // 勤務中タブにはWORKINGとCOMPLETED_PENDING（レビュー待ち）を含める
    if (activeTab === 'working') {
      return app.status === 'WORKING' || app.status === 'COMPLETED_PENDING';
    }
    return app.status === targetStatus;
  });

  const handleJobClick = (applicationId: number) => {
    router.push(`/my-jobs/${applicationId}`);
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    const badges: Record<ApplicationStatus, { text: string; color: string }> = {
      APPLIED: { text: '審査中', color: 'bg-yellow-100 text-yellow-700' },
      SCHEDULED: { text: '予定', color: 'bg-purple-100 text-purple-700' },
      WORKING: { text: '勤務中', color: 'bg-green-100 text-green-700' },
      COMPLETED_PENDING: { text: '評価待', color: 'bg-red-100 text-red-700' },
      COMPLETED_RATED: { text: '完了', color: 'bg-gray-100 text-gray-700' },
      CANCELLED: { text: 'キャンセル', color: 'bg-gray-100 text-gray-500' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const handleCancelApplied = async () => {
    if (!cancelModalApp) return;
    setCancelling(true);
    try {
      const result = await cancelAppliedApplication(cancelModalApp.id);
      if (result.success) {
        toast.success('応募を取り消しました（キャンセル率には影響しません）');
        setApplications(prev =>
          prev.map(a => a.id === cancelModalApp.id ? { ...a, status: 'CANCELLED' as ApplicationStatus } : a)
        );
      } else {
        showDebugError({
          type: 'delete',
          operation: '応募取消（審査中）',
          message: result.error || '取り消しに失敗しました',
          context: { applicationId: cancelModalApp.id }
        });
        toast.error(result.error || '取り消しに失敗しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'delete',
        operation: '応募取消（審査中・例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { applicationId: cancelModalApp.id }
      });
      toast.error('取り消しに失敗しました');
    } finally {
      setCancelling(false);
      setCancelModalApp(null);
    }
  };

  // SCHEDULED/WORKINGのキャンセル処理
  const handleCancelScheduled = async () => {
    if (!scheduledCancelModalApp) return;
    setScheduledCancelling(true);
    try {
      const result = await cancelApplicationByWorker(scheduledCancelModalApp.id);
      if (result.success) {
        toast.success('キャンセルしました');
        setApplications(prev =>
          prev.map(a => a.id === scheduledCancelModalApp.id ? { ...a, status: 'CANCELLED' as ApplicationStatus } : a)
        );
      } else {
        showDebugError({
          type: 'delete',
          operation: '予定キャンセル',
          message: result.error || 'キャンセルに失敗しました',
          context: { applicationId: scheduledCancelModalApp.id }
        });
        toast.error(result.error || 'キャンセルに失敗しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'delete',
        operation: '予定キャンセル（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { applicationId: scheduledCancelModalApp.id }
      });
      toast.error('キャンセルに失敗しました');
    } finally {
      setScheduledCancelling(false);
      setScheduledCancelModalApp(null);
    }
  };

  const formatTime = (timeString: string): string => {
    return timeString.substring(0, 5);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">仕事管理</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">仕事管理</h1>
      </div>

      {/* タブ */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => {
            // 勤務中タブはWORKINGとCOMPLETED_PENDINGの両方をカウント
            const count = tab.id === 'working'
              ? applications.filter((app) => app.status === 'WORKING' || app.status === 'COMPLETED_PENDING').length
              : applications.filter((app) => app.status === tab.status).length;
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
              {activeTab === 'applied' && '審査中の応募はありません'}
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
              onClick={() => handleJobClick(app.id)}
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
                  {activeTab === 'applied' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelModalApp(app);
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  )}

                  {activeTab === 'scheduled' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setScheduledCancelModalApp(app);
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/messages?applicationId=${app.id}`);
                        }}
                        className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                      >
                        メッセージ
                      </button>
                    </div>
                  )}

                  {activeTab === 'working' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setScheduledCancelModalApp(app);
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
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
                          router.push(`/messages?applicationId=${app.id}`);
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

      {/* 審査中キャンセル確認モーダル */}
      {cancelModalApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">応募のキャンセル</h3>
              <button
                onClick={() => setCancelModalApp(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-700 mb-3">この審査応募をキャンセルしますか？</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900 text-sm">{cancelModalApp.job.facility.facility_name}</p>
                <p className="text-xs text-gray-600 mt-1">{cancelModalApp.job.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(cancelModalApp.job.work_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                </p>
              </div>
              <p className="text-xs text-green-600 bg-green-50 p-2 rounded-lg">
                ※キャンセルしてもキャンセル率には影響ありません
              </p>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setCancelModalApp(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCancelApplied}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'キャンセル中...' : 'キャンセルする'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULED/WORKING キャンセル確認モーダル */}
      {scheduledCancelModalApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">キャンセルの確認</h3>
              <button
                onClick={() => setScheduledCancelModalApp(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-700 mb-3">この予定をキャンセルしますか？</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900 text-sm">{scheduledCancelModalApp.job.facility.facility_name}</p>
                <p className="text-xs text-gray-600 mt-1">{scheduledCancelModalApp.job.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(scheduledCancelModalApp.job.work_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* キャンセル率への影響警告 */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">ご注意ください</p>
                    <p className="text-xs text-red-700 mt-1">
                      このキャンセルはキャンセル率に影響します。キャンセル率は施設から確認できます。
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setScheduledCancelModalApp(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCancelScheduled}
                disabled={scheduledCancelling}
                className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {scheduledCancelling ? 'キャンセル中...' : 'キャンセルする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
