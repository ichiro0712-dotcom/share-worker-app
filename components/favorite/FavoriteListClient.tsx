'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Heart, MapPin } from 'lucide-react';
import { toggleFacilityFavorite } from '@/src/lib/actions';

interface FavoriteListClientProps {
  initialFavorites: Array<{
    favoriteId: number;
    addedAt: string;
    facility: any;
  }>;
}

export function FavoriteListClient({ initialFavorites }: FavoriteListClientProps) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(initialFavorites);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const handleRemoveFavorite = async (favoriteId: number, facilityId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('お気に入りから削除しますか?')) return;

    setRemovingId(favoriteId);
    try {
      const result = await toggleFacilityFavorite(String(facilityId));
      if (result.success) {
        setFavorites(prev => prev.filter(f => f.favoriteId !== favoriteId));
        router.refresh();
      } else {
        alert('削除に失敗しました');
      }
    } catch (error) {
      console.error('Remove favorite error:', error);
      alert('削除に失敗しました');
    } finally {
      setRemovingId(null);
    }
  };

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
          <Heart className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-2">お気に入り施設がありません</p>
        <p className="text-sm text-gray-400 mb-6">
          気になる施設をお気に入りに追加しましょう
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          求人を探す
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {favorites.map((item) => {
        const { facility, favoriteId } = item;

        return (
          <Link
            key={favoriteId}
            href={`/facilities/${facility.id}`}
            className="block"
          >
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex gap-3">
                  {/* 画像 */}
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <Image
                      src={facility.images?.[0] || '/placeholder-facility.jpg'}
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
                      <span className="truncate">{facility.address}</span>
                    </div>

                    {/* 評価 */}
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-semibold">
                        {facility.rating?.toFixed(1) || '0.0'}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({facility.review_count || 0}件)
                      </span>
                    </div>

                    {/* 施設タイプ */}
                    <span className="inline-block text-xs bg-primary-light text-primary px-2 py-1 rounded">
                      {facility.facility_type}
                    </span>
                  </div>
                </div>

                {/* お気に入り解除ボタン */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={(e) => handleRemoveFavorite(favoriteId, facility.id, e)}
                    disabled={removingId === favoriteId}
                    className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {removingId === favoriteId ? '削除中...' : 'お気に入りから削除'}
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
