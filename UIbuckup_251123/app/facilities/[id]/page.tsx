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
  Phone,
  Globe,
  Calendar,
} from 'lucide-react';
import { facilities } from '@/data/facilities';
import { jobs } from '@/data/jobs';
import { reviews } from '@/data/reviews';
import { JobCard } from '@/components/job/JobCard';
import { BottomNav } from '@/components/layout/BottomNav';

type SortType = 'newest' | 'highest' | 'lowest';
type FilterType = 'all' | '5' | '4' | '3' | '2' | '1';

export default function FacilityDetail({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [sortType, setSortType] = useState<SortType>('newest');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const facilityId = parseInt(id);
  const facility = facilities.find((f) => f.id === facilityId);
  const facilityJobs = jobs.filter((j) => j.facilityId === facilityId);
  const allReviews = reviews.filter((r) => r.facilityId === facilityId);

  if (!facility) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>施設が見つかりません</p>
      </div>
    );
  }

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    alert(isFavorite ? 'お気に入りから削除しました' : 'お気に入りに追加しました');
  };

  const handleShare = () => {
    alert('共有機能は開発中です');
  };

  // フィルター・ソート処理
  let filteredReviews = [...allReviews];

  // フィルター
  if (filterType !== 'all') {
    const ratingFilter = parseInt(filterType);
    filteredReviews = filteredReviews.filter((r) => r.rating === ratingFilter);
  }

  // ソート
  if (sortType === 'newest') {
    filteredReviews.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sortType === 'highest') {
    filteredReviews.sort((a, b) => b.rating - a.rating);
  } else if (sortType === 'lowest') {
    filteredReviews.sort((a, b) => a.rating - b.rating);
  }

  // 表示するレビュー
  const displayedReviews = showAllReviews ? filteredReviews : filteredReviews.slice(0, 3);

  // レビュー統計
  const averageRating =
    allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

  const ratingDistribution = {
    5: allReviews.filter((r) => r.rating === 5).length,
    4: allReviews.filter((r) => r.rating === 4).length,
    3: allReviews.filter((r) => r.rating === 3).length,
    2: allReviews.filter((r) => r.rating === 2).length,
    1: allReviews.filter((r) => r.rating === 1).length,
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
            <button onClick={handleFavorite}>
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
          src={facility.image}
          alt={facility.name}
          fill
          className="object-cover"
        />
      </div>

      {/* 施設情報 */}
      <div className="bg-white p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-2">{facility.name}</h1>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-lg font-semibold">
                {facility.rating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">
                ({facility.reviewCount}件のレビュー)
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
            {facility.type}
          </span>
        </div>
      </div>

      {/* 施設の特徴 */}
      {(facility as any).features && (
        <div className="bg-white p-4 mb-4">
          <h2 className="font-bold text-lg mb-3">施設の特徴</h2>
          <ul className="space-y-2">
            {(facility as any).features.map((feature: string, index: number) => (
              <li key={index} className="text-sm text-gray-700 flex items-start">
                <span className="mr-2">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* レビューセクション */}
      <div className="bg-white p-4 mb-4">
        <h2 className="font-bold text-lg mb-4">レビュー</h2>

        {allReviews.length > 0 ? (
          <>
            {/* レビュー統計 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {averageRating.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-1 justify-center mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.round(averageRating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {allReviews.length}件
                  </div>
                </div>

                {/* 評価分布 */}
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      onClick={() =>
                        setFilterType(
                          filterType === rating.toString()
                            ? 'all'
                            : (rating.toString() as FilterType)
                        )
                      }
                      className={`w-full flex items-center gap-2 hover:bg-gray-100 rounded p-1 ${
                        filterType === rating.toString() ? 'bg-primary-light' : ''
                      }`}
                    >
                      <span className="text-xs text-gray-600 w-4">{rating}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{
                            width: `${
                              allReviews.length > 0
                                ? (ratingDistribution[
                                    rating as keyof typeof ratingDistribution
                                  ] /
                                    allReviews.length) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-6">
                        {
                          ratingDistribution[
                            rating as keyof typeof ratingDistribution
                          ]
                        }
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* フィルター・ソート */}
            {showAllReviews && (
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">並び替え:</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSortType('newest')}
                    className={`text-xs px-3 py-1 rounded-full ${
                      sortType === 'newest'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    新しい順
                  </button>
                  <button
                    onClick={() => setSortType('highest')}
                    className={`text-xs px-3 py-1 rounded-full ${
                      sortType === 'highest'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    評価が高い順
                  </button>
                  <button
                    onClick={() => setSortType('lowest')}
                    className={`text-xs px-3 py-1 rounded-full ${
                      sortType === 'lowest'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    評価が低い順
                  </button>
                </div>
              </div>
            )}

            {/* レビュー一覧 */}
            <div className="space-y-4">
              {displayedReviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <span>{review.age}</span>
                    <span>•</span>
                    <span>{review.gender}</span>
                    <span>•</span>
                    <span>{review.occupation}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{review.goodPoints}</p>
                  {review.improvements && (
                    <p className="text-sm text-gray-600 italic">
                      改善点: {review.improvements}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {!showAllReviews && filteredReviews.length > 3 && (
              <button
                onClick={() => setShowAllReviews(true)}
                className="block w-full text-center py-3 text-sm text-primary hover:underline mt-4"
              >
                さらに{filteredReviews.length - 3}件のレビューを見る
              </button>
            )}
            {showAllReviews && (
              <button
                onClick={() => setShowAllReviews(false)}
                className="block w-full text-center py-3 text-sm text-gray-600 hover:underline mt-4"
              >
                レビューを閉じる
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>まだレビューがありません</p>
            <p className="text-sm mt-2">最初のレビューを投稿しませんか？</p>
          </div>
        )}

        {/* レビュー投稿ボタン */}
        <Link
          href={`/facilities/${facilityId}/review/new`}
          className="block w-full mt-4 py-3 bg-primary text-white text-center rounded-lg hover:bg-primary/90 transition-colors"
        >
          レビューを投稿する
        </Link>
      </div>

      {/* この施設の求人 */}
      {facilityJobs.length > 0 && (
        <div className="bg-white p-4 mb-4">
          <h2 className="font-bold text-lg mb-4">この施設の求人</h2>
          <div className="grid grid-cols-2 gap-3">
            {facilityJobs.map((job) => (
              <JobCard key={job.id} job={job} facility={facility} />
            ))}
          </div>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
