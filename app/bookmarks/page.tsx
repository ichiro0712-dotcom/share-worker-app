import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { BookmarkListClient } from '@/components/bookmark/BookmarkListClient';
import { getBookmarkedJobs } from '@/src/lib/actions';

export default async function BookmarksPage() {
  const bookmarks = await getBookmarkedJobs('WATCH_LATER');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <Link href="/mypage">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center text-lg font-bold">ブックマーク求人</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* ブックマーク求人リスト */}
      <div className="px-4 py-4">
        <BookmarkListClient initialBookmarks={bookmarks} />
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
