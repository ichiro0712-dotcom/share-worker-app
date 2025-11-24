'use client';

import { useState } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { MapPin, Calendar, Clock, DollarSign, ChevronRight, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { WorkerStatus } from '@/types/worker';

interface Job {
  id: number;
  jobId: number;
  facilityName: string;
  jobTitle: string;
  jobDate: string;
  startTime: string;
  endTime: string;
  hourlyWage: number;
  transportationFee: number;
  totalPay: number;
  location: string;
  status: WorkerStatus;
  cancelledAt?: string;
  cancelReason?: string;
}

type TabType = 'scheduled' | 'working' | 'completed_pending' | 'completed_rated' | 'cancelled';

export default function MyJobsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');

  // ダミーデータ
  const [jobs] = useState<Job[]>([
    {
      id: 1,
      jobId: 1,
      facilityName: 'さくら介護施設',
      jobTitle: '訪問介護スタッフ',
      jobDate: '2025-12-01',
      startTime: '09:00',
      endTime: '17:00',
      hourlyWage: 1800,
      transportationFee: 1000,
      totalPay: 15400,
      location: '東京都渋谷区',
      status: 'scheduled',
    },
    {
      id: 2,
      jobId: 2,
      facilityName: 'ひまわりクリニック',
      jobTitle: '看護師',
      jobDate: '2025-12-05',
      startTime: '08:30',
      endTime: '16:30',
      hourlyWage: 2200,
      transportationFee: 800,
      totalPay: 18400,
      location: '東京都新宿区',
      status: 'scheduled',
    },
    {
      id: 3,
      jobId: 3,
      facilityName: 'もみじ薬局',
      jobTitle: '薬剤師',
      jobDate: '2025-11-23',
      startTime: '10:00',
      endTime: '18:00',
      hourlyWage: 2500,
      transportationFee: 1200,
      totalPay: 21200,
      location: '東京都世田谷区',
      status: 'working',
    },
    {
      id: 4,
      jobId: 4,
      facilityName: 'すみれ訪問看護ステーション',
      jobTitle: '訪問看護師',
      jobDate: '2025-11-20',
      startTime: '09:00',
      endTime: '17:00',
      hourlyWage: 2000,
      transportationFee: 1000,
      totalPay: 17000,
      location: '東京都目黒区',
      status: 'completed_pending',
    },
    {
      id: 5,
      jobId: 5,
      facilityName: 'つばきデイサービス',
      jobTitle: '介護スタッフ',
      jobDate: '2025-11-15',
      startTime: '08:00',
      endTime: '16:00',
      hourlyWage: 1600,
      transportationFee: 500,
      totalPay: 13300,
      location: '東京都品川区',
      status: 'completed_rated',
    },
  ]);

  const tabs: Array<{ id: TabType; label: string }> = [
    { id: 'scheduled', label: '仕事の予定' },
    { id: 'working', label: '勤務中' },
    { id: 'completed_pending', label: '評価待' },
    { id: 'completed_rated', label: '完了' },
    { id: 'cancelled', label: 'キャンセル' },
  ];

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'cancelled') {
      return job.status === 'scheduled' && job.cancelledAt; // キャンセルフラグがある場合
    }
    return job.status === activeTab;
  });

  const handleJobClick = (jobId: number) => {
    router.push(`/jobs/${jobId}`);
  };

  const getStatusBadge = (status: WorkerStatus) => {
    const badges = {
      scheduled: { text: '予定', color: 'bg-purple-100 text-purple-700' },
      working: { text: '勤務中', color: 'bg-green-100 text-green-700' },
      completed_pending: { text: '評価待', color: 'bg-red-100 text-red-700' },
      completed_rated: { text: '完了', color: 'bg-gray-100 text-gray-700' },
    };
    return badges[status as keyof typeof badges];
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">仕事管理</h1>
      </div>

      {/* タブ */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {(() => {
                const count = jobs.filter((job) => {
                  if (tab.id === 'cancelled') {
                    return job.status === 'scheduled' && job.cancelledAt;
                  }
                  return job.status === tab.id;
                }).length;
                return count > 0 ? ` (${count})` : '';
              })()}
            </button>
          ))}
        </div>
      </div>

      {/* 求人カード一覧 */}
      <div className="p-3 space-y-2">
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {activeTab === 'scheduled' && '予定されている仕事はありません'}
              {activeTab === 'working' && '現在勤務中の仕事はありません'}
              {activeTab === 'completed_pending' && '評価待ちの仕事はありません'}
              {activeTab === 'completed_rated' && '完了した仕事はありません'}
              {activeTab === 'cancelled' && 'キャンセルした仕事はありません'}
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => handleJobClick(job.jobId)}
              className="w-full bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-left overflow-hidden"
            >
              <div className="p-3">
                {/* 上部: ステータスと施設名・職種 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate mb-0.5">
                      {job.facilityName}
                    </h3>
                    <p className="text-xs text-gray-600 truncate">{job.jobTitle}</p>
                  </div>
                  {activeTab !== 'cancelled' && (
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${
                        getStatusBadge(job.status).color
                      }`}
                    >
                      {getStatusBadge(job.status).text}
                    </span>
                  )}
                </div>

                {/* 中部: 日時・時間・場所を1行に */}
                <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>{new Date(job.jobDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span>{job.startTime}-{job.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </div>
                </div>

                {/* 下部: 給与情報とアクションボタン */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-0.5 text-gray-600">
                      <span>時給</span>
                      <span className="font-bold">¥{job.hourlyWage.toLocaleString()}</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-0.5 text-gray-600">
                      <span>交通費</span>
                      <span className="font-medium">¥{job.transportationFee.toLocaleString()}</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-0.5 text-primary">
                      <span>総額</span>
                      <span className="font-bold">¥{job.totalPay.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* アクションボタン（コンパクト版） */}
                  {activeTab === 'scheduled' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('キャンセル:', job.id);
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/messages?roomId=${job.facilityName}`);
                        }}
                        className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                      >
                        メッセージ
                      </button>
                    </div>
                  )}

                  {activeTab === 'working' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/messages?roomId=${job.facilityName}`);
                      }}
                      className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                    >
                      メッセージ
                    </button>
                  )}

                  {activeTab === 'completed_pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.jobId}/review`);
                      }}
                      className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      評価する
                    </button>
                  )}

                  {activeTab === 'completed_rated' && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">評価済み</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  )}

                  {activeTab === 'cancelled' && job.cancelReason && (
                    <span className="text-xs text-gray-500 truncate">
                      {job.cancelReason}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
