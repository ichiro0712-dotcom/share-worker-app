'use client';

import { useState } from 'react';
import { ChevronLeft, Star, Calendar, MapPin, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';
import { jobs } from '@/data/jobs';
import { facilities } from '@/data/facilities';

interface BookmarkedJob {
  jobId: number;
  addedAt: string;
}

// ダミーデータ
const dummyBookmarks: BookmarkedJob[] = [
  {
    jobId: 1,
    addedAt: '2025-01-16T10:30:00',
  },
  {
    jobId: 3,
    addedAt: '2025-01-15T15:20:00',
  },
  {
    jobId: 5,
    addedAt: '2025-01-14T09:00:00',
  },
];

export default function Bookmarks() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkedJob[]>(dummyBookmarks);

  const handleRemoveBookmark = (jobId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm('ブックマークから削除しますか？')) {
      setBookmarks(prev => prev.filter(b => b.jobId !== jobId));
    }
  };

  const bookmarkedJobs = bookmarks
    .map(bookmark => {
      const job = jobs.find(j => j.id === bookmark.jobId);
      if (!job) return null;

      const facility = facilities.find(f => f.id === job.facilityId);
      if (!facility) return null;

      return { ...bookmark, job, facility };
    })
    .filter(item => item !== null);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">ブックマーク求人</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* ブックマーク求人リスト */}
      <div className="px-4 py-4">
        {bookmarkedJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <Star className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">ブックマーク求人がありません</p>
            <p className="text-sm text-gray-400 mb-6">
              気になる求人をブックマークしましょう
            </p>
            <Link
              href="/job-list"
              className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              求人を探す
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookmarkedJobs.map((item) => {
              if (!item) return null;
              const { job, facility } = item;

              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block"
                >
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm mb-1">
                            {facility.name}
                          </h3>

                          {/* 住所 */}
                          <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{job.address}</span>
                          </div>

                          {/* 勤務日時 */}
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                            <Calendar className="w-3 h-3" />
                            <span>{job.workDate}</span>
                            <Clock className="w-3 h-3 ml-2" />
                            <span>
                              {job.startTime}-{job.endTime}
                            </span>
                          </div>

                          {/* 日給 */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">日給</span>
                            <span className="text-red-500 font-bold text-sm">
                              {job.wage.toLocaleString()}円
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ブックマーク解除ボタン */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={(e) => handleRemoveBookmark(job.id, e)}
                          className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          ブックマークから削除
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
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
