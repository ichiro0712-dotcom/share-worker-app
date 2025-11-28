'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Star, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface PendingReview {
  applicationId: number;
  jobId: number;
  jobTitle: string;
  jobDate: string;
  facilityId: number;
  facilityName: string;
  facilityAddress: string;
  completedAt: string;
}

interface MyReview {
  id: number;
  facilityId: number;
  facilityName: string;
  jobTitle: string;
  jobDate: string;
  rating: number;
  goodPoints: string | null;
  improvements: string | null;
  createdAt: string;
}

type TabType = 'pending' | 'completed';

interface ReviewsClientProps {
  pendingReviews: PendingReview[];
  myReviews: MyReview[];
}

export default function ReviewsClient({ pendingReviews, myReviews }: ReviewsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">レビュー</h1>
          <div className="w-6"></div>
        </div>

        {/* タブ */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500'
            }`}
          >
            評価待ち
            {pendingReviews.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingReviews.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500'
            }`}
          >
            投稿済み
          </button>
        </div>
      </div>

      {activeTab === 'pending' ? (
        /* 評価待ち一覧 */
        <div className="divide-y divide-gray-200">
          {pendingReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-center">評価待ちの勤務はありません</p>
              <p className="text-sm text-gray-400 mt-2">
                勤務完了後に施設の評価ができます
              </p>
            </div>
          ) : (
            pendingReviews.map((item) => (
              <button
                key={item.applicationId}
                onClick={() => router.push(`/mypage/reviews/${item.applicationId}`)}
                className="w-full bg-white hover:bg-gray-50 px-4 py-4 text-left transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 施設アイコン */}
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-lg">
                      {item.facilityName.charAt(0)}
                    </span>
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 mb-1">{item.facilityName}</h3>
                    <p className="text-sm text-gray-600 mb-2">{item.jobTitle}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{item.jobDate}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{item.facilityAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-yellow-800">
                    レビューを投稿してください
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        /* 投稿済み一覧 */
        <div className="divide-y divide-gray-200">
          {myReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-center">投稿したレビューはありません</p>
            </div>
          ) : (
            myReviews.map((review) => (
              <div key={review.id} className="bg-white px-4 py-4">
                <div className="flex items-start gap-3 mb-3">
                  {/* 施設アイコン */}
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold">
                      {review.facilityName.charAt(0)}
                    </span>
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 truncate">
                        {review.facilityName}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {review.jobTitle} - {review.jobDate}
                    </p>

                    {/* 評価 */}
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className={`w-4 h-4 ${
                            value <= review.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-sm font-semibold text-gray-700">
                        {review.rating.toFixed(1)}
                      </span>
                    </div>

                    {/* 良かった点 */}
                    {review.goodPoints && (
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-2">
                        <h4 className="text-xs font-bold text-green-900 mb-1">
                          良かった点
                        </h4>
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {review.goodPoints}
                        </p>
                      </div>
                    )}

                    {/* 改善点 */}
                    {review.improvements && (
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-orange-900 mb-1">
                          改善点
                        </h4>
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {review.improvements}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
