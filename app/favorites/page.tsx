import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FavoriteListClient } from '@/components/favorite/FavoriteListClient';
import { getFavoriteFacilities } from '@/src/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';

// ミドルウェアで認証済み。Suspense内で動的データ取得

// ローディングスケルトン
function FavoriteListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
          <Skeleton className="w-16 h-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// データ取得用Server Component
async function FavoriteDataLoader() {
  const favorites = await getFavoriteFacilities();
  return <FavoriteListClient initialFavorites={favorites} />;
}

export default function FavoritesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー - 即座に表示 */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <Link href="/mypage">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center text-lg font-bold">お気に入り施設</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* お気に入りリスト - Suspenseでストリーミング */}
      <div className="px-4 py-4">
        <Suspense fallback={<FavoriteListSkeleton />}>
          <FavoriteDataLoader />
        </Suspense>
      </div>
    </div>
  );
}
