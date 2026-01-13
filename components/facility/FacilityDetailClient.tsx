'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ChevronLeft,
  MapPin,
  Star,
  Heart,
} from 'lucide-react';
import { JobCard } from '@/components/job/JobCard';
import { toggleFacilityFavorite } from '@/src/lib/actions';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface Review {
  id: number;
  rating: number;
  goodPoints: string | null;
  improvements: string | null;
  createdAt: string;
  ageGroup: string;
  qualification: string;
  userQualifications: string[];
  jobTitle: string;
  jobDate: string;
}

interface FacilityDetailClientProps {
  facility: any;
  jobs: any[];
  initialIsFavorite: boolean;
  reviews: Review[];
}

export function FacilityDetailClient({
  facility,
  jobs,
  initialIsFavorite,
  reviews,
}: FacilityDetailClientProps) {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayedReviewCount, setDisplayedReviewCount] = useState(5);

  const handleLoadMoreReviews = () => {
    setDisplayedReviewCount((prev) => Math.min(prev + 10, reviews.length));
  };

  const handleFavorite = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await toggleFacilityFavorite(String(facility.id));
      if (result.success && result.isFavorite !== undefined) {
        setIsFavorite(result.isFavorite);
        toast.success(result.isFavorite ? 'お気に入りに追加しました' : 'お気に入りから削除しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: 'お気に入り切り替え',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { facilityId: facility.id }
      });
      console.error('Favorite toggle error:', error);
      toast.error('エラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={handleFavorite} disabled={isProcessing}>
            <Heart
              className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
                }`}
            />
          </button>
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

      {/* レビューセクション */}
      <div className="bg-white p-4 mb-4">
        <h2 className="font-bold text-lg mb-4">
          レビュー ({reviews.length}件)
        </h2>
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Star className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>まだレビューがありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 評価分布バー */}
            {(() => {
              const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
              const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
              reviews.forEach((r) => {
                if (ratingCounts[r.rating] !== undefined) {
                  ratingCounts[r.rating]++;
                }
              });

              return (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-xl font-bold">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">({reviews.length}件)</span>
                  </div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = ratingCounts[rating];
                      const percentage = (count / reviews.length) * 100;
                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <span className="text-xs w-3">{rating}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {reviews.slice(0, displayedReviewCount).map((review) => (
              <div key={review.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                <div className="mb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {/* 匿名化された属性情報: 年代/資格 */}
                    <span className="font-medium text-sm text-gray-700">
                      {review.ageGroup}/{review.qualification}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(review.createdAt).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {/* 評価 */}
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={`w-3.5 h-3.5 ${value <= review.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                          }`}
                      />
                    ))}
                    <span className="ml-1 text-sm font-semibold text-gray-700">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {review.jobTitle} ({review.jobDate})
                  </p>
                </div>

                {/* 良かった点 */}
                <div className="bg-green-50 border border-green-100 rounded-lg p-2 mb-2">
                  <h4 className="text-xs font-bold text-green-900 mb-1 flex items-center gap-1">
                    <span>👍</span>
                    <span>良かった点</span>
                  </h4>
                  <p className="text-xs text-gray-700 line-clamp-3">{review.goodPoints || 'とくにないです'}</p>
                </div>

                {/* 改善点 */}
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-2">
                  <h4 className="text-xs font-bold text-orange-900 mb-1 flex items-center gap-1">
                    <span>💡</span>
                    <span>改善点</span>
                  </h4>
                  <p className="text-xs text-gray-700 line-clamp-3">{review.improvements || 'とくにないです'}</p>
                </div>
              </div>
            ))}
            {reviews.length > displayedReviewCount && (
              <button
                onClick={handleLoadMoreReviews}
                className="w-full py-3 text-sm text-primary border border-primary rounded-lg hover:bg-primary-light transition-colors"
              >
                さらに10件表示する（残り{reviews.length - displayedReviewCount}件）
              </button>
            )}
          </div>
        )}
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
    </div>
  );
}
