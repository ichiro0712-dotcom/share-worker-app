'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, VolumeX, Volume2, Building2 } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface MutedFacility {
  facilityId: number;
  facilityName: string;
  mutedAt: string;
}

export default function MutedFacilitiesPage() {
  const router = useRouter();
  const [mutedFacilities, setMutedFacilities] = useState<MutedFacility[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // localStorageからミュート情報を読み込み
    const loadMutedFacilities = () => {
      try {
        const stored = localStorage.getItem('mutedFacilities');
        if (stored) {
          const data = JSON.parse(stored);
          setMutedFacilities(data);
        }
      } catch (error) {
        console.error('Failed to load muted facilities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMutedFacilities();
  }, []);

  const handleUnmute = (facilityId: number) => {
    const updated = mutedFacilities.filter((f) => f.facilityId !== facilityId);
    setMutedFacilities(updated);
    localStorage.setItem('mutedFacilities', JSON.stringify(updated));

    // 求人一覧のミュートリストも更新
    const mutedIds = updated.map((f) => f.facilityId);
    localStorage.setItem('mutedFacilityIds', JSON.stringify(mutedIds));
  };

  const handleUnmuteAll = () => {
    if (confirm('すべてのミュートを解除しますか？')) {
      setMutedFacilities([]);
      localStorage.setItem('mutedFacilities', JSON.stringify([]));
      localStorage.setItem('mutedFacilityIds', JSON.stringify([]));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 mr-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">ミュート施設</h1>
        </div>
      </div>

      {/* 説明 */}
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-3">
        <p className="text-sm text-orange-800">
          ミュートした施設の求人は一覧に表示されません。
          ミュートを解除すると再度表示されます。
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : mutedFacilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Volume2 className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">
            ミュートしている施設はありません
          </p>
          <p className="text-sm text-gray-400 text-center mt-2">
            求人詳細ページからミュートできます
          </p>
        </div>
      ) : (
        <>
          {/* 一括解除ボタン */}
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <button
              onClick={handleUnmuteAll}
              className="text-sm text-red-500 hover:text-red-600"
            >
              すべてのミュートを解除
            </button>
          </div>

          {/* ミュート施設一覧 */}
          <div className="bg-white">
            {mutedFacilities.map((facility) => (
              <div
                key={facility.facilityId}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {facility.facilityName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(facility.mutedAt).toLocaleDateString('ja-JP')} にミュート
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnmute(facility.facilityId)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-orange-500 border border-orange-500 rounded-lg hover:bg-orange-50 flex-shrink-0"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>解除</span>
                </button>
              </div>
            ))}
          </div>

          {/* 件数表示 */}
          <div className="px-4 py-3 text-center">
            <p className="text-sm text-gray-500">
              {mutedFacilities.length}件の施設をミュート中
            </p>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
