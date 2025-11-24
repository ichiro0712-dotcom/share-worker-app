'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft,
  MapPin,
  Star,
  Heart,
  Share2,
} from 'lucide-react';
import { JobCard } from '@/components/job/JobCard';
import { BottomNav } from '@/components/layout/BottomNav';
import { toggleFacilityFavorite } from '@/src/lib/actions';

interface FacilityDetailClientProps {
  facility: any;
  jobs: any[];
  initialIsFavorite: boolean;
}

export function FacilityDetailClient({
  facility,
  jobs,
  initialIsFavorite,
}: FacilityDetailClientProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFavorite = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await toggleFacilityFavorite(String(facility.id));
      if (result.success && result.isFavorite !== undefined) {
        setIsFavorite(result.isFavorite);
      }
    } catch (error) {
      console.error('Favorite toggle error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = () => {
    // Phase 2で実装予定: Web Share API
    alert('共有機能は開発中です');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <button onClick={handleShare}>
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={handleFavorite} disabled={isProcessing}>
              <Heart
                className={`w-5 h-5 ${
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* メイン画像 */}
      <div className="relative w-full h-64">
        <Image
          src={facility.images?.[0] || '/placeholder-facility.jpg'}
          alt={facility.facility_name}
          fill
          className="object-cover"
        />
      </div>

      {/* 施設情報 */}
      <div className="bg-white p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-2">{facility.facility_name}</h1>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-lg font-semibold">
                {facility.rating?.toFixed(1) || '0.0'}
              </span>
              <span className="text-sm text-gray-500">
                ({facility.review_count || 0}件のレビュー)
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{facility.address}</span>
            </div>
          </div>
        </div>

        {/* 施設タイプ */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm bg-primary-light text-primary px-3 py-1 rounded-full">
            {facility.facility_type}
          </span>
        </div>
      </div>

      {/* 施設の説明 */}
      {facility.description && (
        <div className="bg-white p-4 mb-4">
          <h2 className="font-bold text-lg mb-3">施設について</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {facility.description}
          </p>
        </div>
      )}

      {/* レビューセクション（Phase 2で実装予定） */}
      <div className="bg-white p-4 mb-4">
        <h2 className="font-bold text-lg mb-4">レビュー</h2>
        <div className="text-center py-8 text-gray-500">
          <p>レビュー機能はPhase 2で実装予定です</p>
        </div>
      </div>

      {/* この施設の求人 */}
      {jobs.length > 0 && (
        <div className="bg-white p-4 mb-4">
          <h2 className="font-bold text-lg mb-4">この施設の求人</h2>
          <div className="grid grid-cols-2 gap-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} facility={facility} />
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="bg-white p-4 mb-4">
          <h2 className="font-bold text-lg mb-4">この施設の求人</h2>
          <div className="text-center py-8 text-gray-500">
            <p>現在募集中の求人はありません</p>
          </div>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
