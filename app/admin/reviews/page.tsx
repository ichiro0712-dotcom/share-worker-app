'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowUpDown, Sparkles, X, TrendingUp, TrendingDown, Lightbulb, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { getFacilityReviewsForAdmin, getFacilityReviewStats } from '@/src/lib/actions';

type SortType = 'rating-high' | 'rating-low' | 'newest' | 'oldest';

interface Review {
  id: number;
  rating: number;
  goodPoints: string | null;
  improvements: string | null;
  createdAt: string;
  userName: string;
  userQualifications: string[];
  jobTitle: string;
  jobDate: string;
}

interface ReviewStats {
  averageRating: number;
  totalCount: number;
  distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [sortType, setSortType] = useState<SortType>('newest');
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.facilityId) return;

      setIsLoading(true);
      try {
        const [reviewsData, statsData] = await Promise.all([
          getFacilityReviewsForAdmin(admin.facilityId),
          getFacilityReviewStats(admin.facilityId),
        ]);
        setReviews(reviewsData);
        setStats(statsData);
      } catch (error) {
        const debugInfo = extractDebugInfo(error);
        showDebugError({
          type: 'fetch',
          operation: '自社レビューデータ取得',
          message: debugInfo.message,
          details: debugInfo.details,
          stack: debugInfo.stack,
          context: { facilityId: admin.facilityId }
        });
        console.error('Failed to fetch reviews:', error);
        toast.error('レビューの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [admin?.facilityId]);

  // ソート処理
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortType) {
      case 'rating-high':
        return b.rating - a.rating;
      case 'rating-low':
        return a.rating - b.rating;
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
  });

  // AIレビュー分析を実行（ダミー）
  const handleAiAnalysis = () => {
    setIsAnalyzing(true);
    // ダミーの分析処理（2秒後に結果を表示）
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowAiAnalysis(true);
    }, 2000);
  };

  // ダミーのAI分析結果
  const aiAnalysisResult = {
    overallRating: 4.2,
    overallComment: '全体的に高評価を得ており、特にスタッフの対応と施設の清潔さが評価されています。一方で、交通アクセスと通信環境の改善が課題となっています。',
    goodPoints: [
      'スタッフの対応が温かく、働きやすい雰囲気が評価されている',
      '施設が新しく清潔で、設備が整っている',
      '利用者との距離が近く、やりがいを感じられる環境',
      '休憩スペースや福利厚生が充実している'
    ],
    badPoints: [
      '交通アクセスが不便で、通勤に時間がかかるという声が多い',
      'Wi-Fi環境が弱く、連絡が取りにくい場面がある',
      '交通費の補助が不十分との指摘がある',
      '繁忙期の人手不足により、業務負担が増加することがある'
    ],
    improvements: [
      {
        title: '送迎サービスの導入',
        description: '他社事例では、最寄り駅からの無料送迎バスを運行することで、交通アクセスの課題を解決し、応募率が30%向上した実績があります。',
        priority: 'high'
      },
      {
        title: 'Wi-Fi環境の強化',
        description: '施設全体のWi-Fi設備を増強し、業務用とゲスト用を分けることで、通信環境の改善と業務効率化を図ることができます。',
        priority: 'high'
      },
      {
        title: '交通費補助制度の見直し',
        description: '実費精算ではなく、定額支給制度に変更することで、ワーカーの満足度向上と事務処理の簡素化が期待できます。',
        priority: 'medium'
      },
      {
        title: 'ピークタイム対応の人員計画',
        description: '繁忙期の予測に基づいた事前の人員確保と、柔軟なシフト調整により、業務負担の平準化を図ることができます。',
        priority: 'medium'
      }
    ]
  };

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="p-6">
        {/* ヘッダー Skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* 評価サマリー Skeleton */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
              <div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 rounded w-4 animate-pulse" />
                  <div className="h-2 bg-gray-100 rounded-full flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-8 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* レビューリスト Skeleton */}
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-gray-100 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
                    <div className="h-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayedReviews = showAll ? sortedReviews : sortedReviews.slice(0, 10);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">レビュー一覧</h1>
        <p className="text-sm text-gray-600 mt-1">ワーカーからのレビューを確認できます</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* 評価サマリー */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-baseline gap-2">
              <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              <span className="text-4xl font-bold text-gray-800">{stats?.averageRating.toFixed(1) || '0.0'}</span>
            </div>
            <div className="text-gray-600">
              <p className="text-sm">全{stats?.totalCount || 0}件のレビュー</p>
              <p className="text-xs text-gray-500 mt-1">ワーカーからの評価</p>
            </div>
          </div>

          {/* 評価分布バー */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats?.distribution[rating as 1 | 2 | 3 | 4 | 5] || 0;
              const total = stats?.totalCount || 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-medium">{rating}</span>
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}件</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* レビュー一覧 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">レビュー詳細</h2>

            <div className="flex items-center gap-3">
              {/* AIレビュー分析ボタン */}
              <button
                onClick={handleAiAnalysis}
                disabled={isAnalyzing || reviews.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                {isAnalyzing ? '分析中...' : 'AI分析'}
              </button>

              {/* ソート選択 */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-gray-500" />
                <select
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value as SortType)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                >
                  <option value="newest">新着順</option>
                  <option value="oldest">古い順</option>
                  <option value="rating-high">評価が高い順</option>
                  <option value="rating-low">評価が低い順</option>
                </select>
              </div>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">まだレビューがありません</p>
              <p className="text-sm text-gray-400 mt-2">
                ワーカーが勤務完了後にレビューを投稿すると、ここに表示されます
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-3">
                        {/* ユーザーアイコン */}
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-sm">
                            {review.userName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">{review.userName}</span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((value) => (
                                <Star
                                  key={value}
                                  className={`w-4 h-4 ${value <= review.rating
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300'
                                    }`}
                                />
                              ))}
                              <span className="ml-1 text-sm font-semibold text-gray-700">
                                {review.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {review.jobTitle} ({review.jobDate})
                          </p>
                          {review.userQualifications.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {review.userQualifications.slice(0, 3).map((qual, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                                >
                                  {qual}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(review.createdAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="space-y-3 ml-13">
                      {review.goodPoints && (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                          <h3 className="text-sm font-bold text-green-900 mb-2">良かった点</h3>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.goodPoints}</p>
                        </div>
                      )}

                      {review.improvements && (
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                          <h3 className="text-sm font-bold text-orange-900 mb-2">改善点</h3>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.improvements}</p>
                        </div>
                      )}

                      {!review.goodPoints && !review.improvements && (
                        <p className="text-sm text-gray-500 italic">コメントなし</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!showAll && reviews.length > 10 && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="px-6 py-2 bg-white border border-primary text-primary rounded-lg hover:bg-primary-light transition-colors"
                  >
                    もっと見る（残り{reviews.length - 10}件）
                  </button>
                </div>
              )}

              {showAll && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      setShowAll(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI分析結果モーダル */}
      {showAiAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">AIレビュー分析結果</h2>
              </div>
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* コンテンツ */}
            <div className="p-6 space-y-6">
              {/* 総合評価 */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-yellow-500 text-3xl">★</span>
                    <span className="text-4xl font-bold text-gray-800">{aiAnalysisResult.overallRating.toFixed(1)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">総合評価</h3>
                    <p className="text-xs text-gray-500">AIによる分析結果</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysisResult.overallComment}</p>
              </div>

              {/* 良かった点 */}
              <div className="bg-white border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-bold text-green-900">良かった点</h3>
                </div>
                <ul className="space-y-3">
                  {aiAnalysisResult.goodPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700 leading-relaxed flex-1">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 悪かった点 */}
              <div className="bg-white border border-orange-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-bold text-orange-900">改善が必要な点</h3>
                </div>
                <ul className="space-y-3">
                  {aiAnalysisResult.badPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700 leading-relaxed flex-1">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 改善案 */}
              <div className="bg-white border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-blue-900">他社事例に基づく改善案</h3>
                </div>
                <div className="space-y-4">
                  {aiAnalysisResult.improvements.map((improvement, index) => (
                    <div key={index} className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-sm font-bold text-blue-900">{improvement.title}</h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${improvement.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                            }`}
                        >
                          {improvement.priority === 'high' ? '優先度: 高' : '優先度: 中'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{improvement.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 注意書き */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  ※ この分析結果はAIによる自動生成です。実際の改善施策の実施にあたっては、施設の状況や予算を考慮し、専門家と相談の上、慎重に検討してください。
                </p>
              </div>
            </div>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
