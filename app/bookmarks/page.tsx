import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BookmarkListClient } from '@/components/bookmark/BookmarkListClient';
import { getBookmarkedJobs } from '@/src/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';

// ミドルウェアで認証済み。Suspense内で動的データ取得

// ローディングスケルトン
function BookmarkListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

// データ取得用Server Component
async function BookmarkDataLoader() {
  const bookmarks = await getBookmarkedJobs('WATCH_LATER');
  return <BookmarkListClient initialBookmarks={bookmarks} />;
}

export default function BookmarksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー - 即座に表示 */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <Link href="/mypage">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center text-lg font-bold">ブックマーク求人</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* ブックマーク求人リスト - Suspenseでストリーミング */}
      <div className="px-4 py-4">
        <Suspense fallback={<BookmarkListSkeleton />}>
          <BookmarkDataLoader />
        </Suspense>
      </div>
    </div>
  );
}
