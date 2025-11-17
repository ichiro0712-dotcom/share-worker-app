'use client';

import { useState } from 'react';
import { ChevronLeft, Calendar, MapPin, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/Badge';
import { jobs } from '@/data/jobs';
import { facilities } from '@/data/facilities';

interface Application {
  id: number;
  jobId: number;
  appliedAt: string;
  isJobActive: boolean; // 求人がまだ掲載中かどうか
}

// ダミーデータ
const dummyApplications: Application[] = [
  {
    id: 1,
    jobId: 1,
    appliedAt: '2025-01-15T10:30:00',
    isJobActive: true,
  },
  {
    id: 2,
    jobId: 2,
    appliedAt: '2025-01-14T15:20:00',
    isJobActive: true,
  },
  {
    id: 3,
    jobId: 3,
    appliedAt: '2025-01-13T09:00:00',
    isJobActive: false, // この求人は終了している
  },
  {
    id: 4,
    jobId: 4,
    appliedAt: '2025-01-12T14:45:00',
    isJobActive: true,
  },
];

export default function Applications() {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handleJobClick = (application: Application) => {
    if (!application.isJobActive) {
      alert('この施設の求人の掲載は終了しました');
    } else {
      router.push(`/jobs/${application.jobId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">応募履歴</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* 応募リスト */}
      <div className="px-4 py-4">
        {dummyApplications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">応募履歴がありません</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              求人を探す
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {dummyApplications.map((application) => {
              const job = jobs.find((j) => j.id === application.jobId);
              const facility = job
                ? facilities.find((f) => f.id === job.facilityId)
                : null;

              if (!job || !facility) return null;

              return (
                <div
                  key={application.id}
                  onClick={() => handleJobClick(application)}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="p-4">
                    <div className="flex gap-3">
                      {/* 画像 */}
                      <div className="relative w-24 h-24 flex-shrink-0">
                        <Image
                          src={job.images[0]}
                          alt={facility.name}
                          fill
                          className="object-cover rounded-lg"
                        />
                        {!application.isJobActive && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-bold">終了</span>
                          </div>
                        )}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-1">
                          {facility.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{job.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                          <Calendar className="w-3 h-3" />
                          <span>{job.workDate}</span>
                          <Clock className="w-3 h-3 ml-2" />
                          <span>
                            {job.startTime}-{job.endTime}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">日給</span>
                            <span className="text-red-500 font-bold text-sm">
                              {job.wage.toLocaleString()}円
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            応募日: {formatDate(application.appliedAt).split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
