'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { reviews } from '@/data/reviews';
import { facilities } from '@/data/facilities';
import { ArrowUpDown, Sparkles, X, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';

type SortType = 'rating-high' | 'rating-low' | 'newest' | 'oldest';

export default function AdminReviewsPage() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [sortType, setSortType] = useState<SortType>('newest');
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

  const facility = useMemo(() => {
    if (!admin) return null;
    return facilities.find(f => f.id === admin.facilityId);
  }, [admin]);

  const facilityReviews = useMemo(() => {
    if (!admin) return [];
    const filtered = reviews.filter(r => r.facilityId === admin.facilityId);

    // ソート処理
    const sorted = [...filtered].sort((a, b) => {
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

    return sorted;
  }, [admin, sortType]);

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

  if (!isAdmin || !admin || !facility) {
    return null;
  }

  const displayedReviews = showAll ? facilityReviews : facilityReviews.slice(0, 10);

  return (
    <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">レビュー一覧</h1>
          <p className="text-sm text-gray-600 mt-1">{facility.name}に対するレビューを確認できます</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* 評価サマリー */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-yellow-500 text-3xl">★</span>
              <span className="text-4xl font-bold text-gray-800">{facility.rating.toFixed(1)}</span>
            </div>
            <div className="text-gray-600">
              <p className="text-sm">全{facility.reviewCount}件のレビュー</p>
              <p className="text-xs text-gray-500 mt-1">直近のワーカーからの評価</p>
            </div>
          </div>

          {/* 評価分布バー */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const distributionRates = [0.52, 0.34, 0.07, 0.03, 0.03];
              const rate = distributionRates[5 - rating];
              const count = Math.floor(facility.reviewCount * rate);
              const percentage = rate * 100;

              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-yellow-500">★</span>
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
                disabled={isAnalyzing || facilityReviews.length === 0}
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
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="newest">新着順</option>
                  <option value="oldest">古い順</option>
                  <option value="rating-high">評価が高い順</option>
                  <option value="rating-low">評価が低い順</option>
                </select>
              </div>
            </div>
          </div>

          {facilityReviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">まだレビューがありません</p>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium text-gray-800">{review.rating.toFixed(1)}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {review.age} / {review.gender} / {review.occupation} / {review.period}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-green-900 mb-2">✓ 良かった点</h3>
                        <p className="text-sm text-gray-700 leading-relaxed">{review.goodPoints}</p>
                      </div>

                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-orange-900 mb-2">△ 改善点</h3>
                        <p className="text-sm text-gray-700 leading-relaxed">{review.improvements}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!showAll && facilityReviews.length > 10 && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="px-6 py-2 bg-white border border-primary text-primary rounded-lg hover:bg-primary-light transition-colors"
                  >
                    もっと見る（残り{facilityReviews.length - 10}件）
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
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            improvement.priority === 'high'
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
