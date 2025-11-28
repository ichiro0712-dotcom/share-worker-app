import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { FavoriteListClient } from '@/components/favorite/FavoriteListClient';
import { getFavoriteFacilities } from '@/src/lib/actions';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const favorites = await getFavoriteFacilities();

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <Link href="/mypage">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center text-lg font-bold">お気に入り施設</h1>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="px-4 py-4">
        <FavoriteListClient initialFavorites={favorites} />
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
