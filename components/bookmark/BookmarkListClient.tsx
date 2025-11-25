'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, Calendar, MapPin, Clock } from 'lucide-react';
import { removeJobBookmark } from '@/src/lib/actions';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/ui/EmptyState';

interface BookmarkListClientProps {
  initialBookmarks: Array<{
    bookmarkId: number;
    addedAt: string;
    job: any;
  }>;
}

export function BookmarkListClient({ initialBookmarks }: BookmarkListClientProps) {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const handleRemoveBookmark = async (bookmarkId: number, jobId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('ブックマークから削除しますか？')) return;

    setRemovingId(bookmarkId);
    try {
      const result = await removeJobBookmark(String(jobId), 'WATCH_LATER');
      if (result.success) {
        setBookmarks(prev => prev.filter(b => b.bookmarkId !== bookmarkId));
        router.refresh(); // Server Componentを再取得
      } else {
        toast.error('削除に失敗しました');
      }
    } catch (error) {
      console.error('Remove bookmark error:', error);
      toast.error('削除に失敗しました');
    } finally {
      setRemovingId(null);
    }
  };

  if (bookmarks.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="保存した求人はまだありません"
        description="気になる求人をブックマークして、後で見返しましょう"
        actionLabel="求人を探す"
        actionLink="/"
      />
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((item) => {
        const { job, bookmarkId } = item;
        const facility = job.facility;

        return (
          <Link
            key={bookmarkId}
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
                      alt={facility.facility_name}
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm mb-1">
                      {facility.facility_name}
                    </h3>

                    {/* 住所 */}
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{job.address}</span>
                    </div>

                    {/* 勤務日時 */}
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                      <Calendar className="w-3 h-3" />
                      <span>{job.work_date instanceof Date ? job.work_date.toISOString().split('T')[0] : String(job.work_date).split('T')[0]}</span>
                      <Clock className="w-3 h-3 ml-2" />
                      <span>
                        {job.start_time}-{job.end_time}
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
                    onClick={(e) => handleRemoveBookmark(bookmarkId, job.id, e)}
                    disabled={removingId === bookmarkId}
                    className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {removingId === bookmarkId ? '削除中...' : 'ブックマークから削除'}
                  </button>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
