'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Star } from 'lucide-react';
import { submitReview } from '@/src/lib/actions';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface ApplicationData {
  applicationId: number;
  status: string;
  workerReviewStatus: string;
  jobId: number;
  jobTitle: string;
  jobDate: string;
  facilityId: number;
  facilityName: string;
  facilityAddress: string | null;
}

interface ReviewFormClientProps {
  applicationData: ApplicationData;
}

export default function ReviewFormClient({ applicationData }: ReviewFormClientProps) {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [formData, setFormData] = useState({
    goodPoints: '',
    improvements: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('総合評価を選択してください');
      return;
    }

    if (!formData.goodPoints.trim()) {
      toast.error('良かった点を入力してください');
      return;
    }

    if (!formData.improvements.trim()) {
      toast.error('改善点を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitReview(
        applicationData.jobId.toString(),
        rating,
        formData.goodPoints,
        formData.improvements
      );

      if (result.success) {
        toast.success('レビューを投稿しました！');
        router.push('/mypage/reviews');
        router.refresh();
      } else {
        showDebugError({
          type: 'save',
          operation: 'レビュー投稿',
          message: result.error || 'レビューの投稿に失敗しました',
          context: { applicationId: applicationData.applicationId, jobId: applicationData.jobId }
        });
        toast.error(result.error || 'レビューの投稿に失敗しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: 'レビュー投稿（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { applicationId: applicationData.applicationId, jobId: applicationData.jobId }
      });
      console.error('Failed to submit review:', error);
      toast.error('レビューの投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">レビュー投稿</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* 施設情報 */}
      <div className="bg-white p-4 mb-4">
        <h2 className="font-bold text-lg mb-2">{applicationData.facilityName}</h2>
        <p className="text-sm text-gray-600 mb-1">{applicationData.facilityAddress}</p>
        <div className="mt-2 text-sm text-gray-500">
          <span>{applicationData.jobTitle}</span>
          <span className="mx-2">•</span>
          <span>{applicationData.jobDate}</span>
        </div>
      </div>

      {/* レビューフォーム */}
      <form onSubmit={handleSubmit} className="bg-white p-4 mb-4">
        {/* 総合評価 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">
            総合評価 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${value <= (hoveredRating || rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                    }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-lg font-semibold text-primary">{rating}.0</span>
            )}
          </div>
        </div>

        {/* 良かった点 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            良かった点 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.goodPoints}
            onChange={(e) => setFormData({ ...formData, goodPoints: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            rows={5}
            placeholder="この施設で働いて良かった点を具体的に教えてください"
            disabled={isSubmitting}
          />
        </div>

        {/* 改善点 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            改善点 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.improvements}
            onChange={(e) => setFormData({ ...formData, improvements: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            rows={5}
            placeholder="改善が必要だと感じた点を具体的に教えてください"
            disabled={isSubmitting}
          />
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '投稿中...' : 'レビューを投稿する'}
        </button>
      </form>

      {/* 注意事項 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mx-4">
        <h3 className="font-semibold text-sm text-yellow-800 mb-2">投稿時の注意事項</h3>
        <ul className="text-xs text-yellow-700 space-y-1">
          <li>• 個人を特定できる情報は記載しないでください</li>
          <li>• 誹謗中傷や不適切な表現は控えてください</li>
          <li>• 投稿内容は運営側で確認後、公開されます</li>
          <li>• 一度投稿したレビューは編集・削除できません</li>
        </ul>
      </div>
    </div>
  );
}
