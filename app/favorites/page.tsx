'use client';

import { useState } from 'react';
import { ChevronLeft, Star, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/BottomNav';
import { JobCard } from '@/components/job/JobCard';
import { facilities } from '@/data/facilities';
import { jobs } from '@/data/jobs';

interface FavoriteFacility {
  facilityId: number;
  addedAt: string;
}

// ダミーデータ
const dummyFavorites: FavoriteFacility[] = [
  {
    facilityId: 1,
    addedAt: '2025-01-15T10:30:00',
  },
  {
    facilityId: 2,
    addedAt: '2025-01-14T15:20:00',
  },
  {
    facilityId: 3,
    addedAt: '2025-01-13T09:00:00',
  },
];

export default function Favorites() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteFacility[]>(dummyFavorites);

  const handleRemoveFavorite = (facilityId: number) => {
    if (confirm('お気に入りから削除しますか？')) {
      setFavorites(prev => prev.filter(f => f.facilityId !== facilityId));
    }
  };

  // お気に入り施設の求人を取得
  const favoriteJobs = favorites.flatMap(fav => {
    const facility = facilities.find(f => f.id === fav.facilityId);
    if (!facility) return [];

    const facilityJobs = jobs.filter(j => j.facilityId === fav.facilityId);
    return facilityJobs.map(job => ({ job, facility }));
  });

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">お気に入り施設</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* お気に入り施設の求人リスト */}
      <div className="px-4 py-4">
        {favoriteJobs.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4">
            {favoriteJobs.map(({ job, facility }) => (
              <JobCard key={job.id} job={job} facility={facility} />
            ))}
          </div>
        )}
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
