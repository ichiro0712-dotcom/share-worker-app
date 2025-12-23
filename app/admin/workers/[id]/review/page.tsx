'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSWRConfig } from 'swr';

import { ChevronLeft, Star, User, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getApplicationForFacilityReview, submitFacilityReviewForWorker } from '@/src/lib/actions';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface ApplicationData {
  applicationId: number;
  userId: number;
  userName: string;
  userProfileImage: string | null;
  userQualifications: string[];
  jobId: number;
  jobTitle: string;
  jobDate: string;
  jobStartTime: string;
  jobEndTime: string;
}

export default function FacilityWorkerReviewPage() {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();

  const { showDebugError } = useDebugError();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const { admin, isAdmin } = useAuth();

  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [goodPoints, setGoodPoints] = useState('');
  const [improvements, setImprovements] = useState('');

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.facilityId || !applicationId) return;

      setIsLoading(true);
      try {
        const data = await getApplicationForFacilityReview(
          parseInt(applicationId),
          admin.facilityId
        );
        if (data) {
          setApplicationData(data);
        } else {
          toast.error('評価対象のワーカーが見つかりません');
          router.push('/admin/workers');
        }
      } catch (error) {
        const debugInfo = extractDebugInfo(error);
        showDebugError({
          type: 'fetch',
          operation: '評価対象データ取得',
          message: debugInfo.message,
          details: debugInfo.details,
          stack: debugInfo.stack,
          context: { applicationId, facilityId: admin?.facilityId }
        });
        console.error('Failed to fetch application:', error);
        toast.error('データの取得に失敗しました');
        router.push('/admin/workers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [admin?.facilityId, applicationId, router]);

  const handleSubmit = async () => {
    if (!admin?.facilityId || !applicationData) return;

    if (rating === 0) {
      toast.error('評価を選択してください');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitFacilityReviewForWorker(
        applicationData.applicationId,
        admin.facilityId,
        {
          rating,
          goodPoints: goodPoints.trim() || undefined,
          improvements: improvements.trim() || undefined,
        }
      );

      if (result.success) {
        toast.success(result.message || '評価を投稿しました');
        // SWRキャッシュをクリアして一覧を更新
        globalMutate((key) => typeof key === 'string' && key.includes('/api/admin/workers'));
        router.push('/admin/workers');
      } else {
        toast.error(result.error || '評価の投稿に失敗しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: '施設評価投稿',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { applicationId: applicationData.applicationId, facilityId: admin.facilityId, rating }
      });
      console.error('Failed to submit review:', error);
      toast.error('評価の投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-primary"></div>
      </div>
    );
  }

  if (!applicationData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">ワーカー評価</h1>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ワーカー情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              {applicationData.userProfileImage ? (
                <img
                  src={applicationData.userProfileImage}
                  alt={applicationData.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">{applicationData.userName}</h2>
              <div className="flex flex-wrap gap-1 mt-1">
                {applicationData.userQualifications.map((qual, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                  >
                    {qual}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 勤務情報 */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="font-medium text-gray-900 mb-2">{applicationData.jobTitle}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{applicationData.jobDate}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {applicationData.jobStartTime}〜{applicationData.jobEndTime}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 評価入力 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-4">総合評価</h3>

          {/* 星評価 */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${value <= (hoverRating || rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                    }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-center text-sm text-gray-600 mb-4">
              {rating === 5 && '非常に良かった'}
              {rating === 4 && '良かった'}
              {rating === 3 && '普通'}
              {rating === 2 && 'あまり良くなかった'}
              {rating === 1 && '良くなかった'}
            </p>
          )}

          {/* 良かった点 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              良かった点（任意）
            </label>
            <textarea
              value={goodPoints}
              onChange={(e) => setGoodPoints(e.target.value)}
              placeholder="勤務態度、スキル、コミュニケーションなど良かった点を記入してください"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-primary resize-none"
              rows={3}
            />
          </div>

          {/* 改善点 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              改善点（任意）
            </label>
            <textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="今後改善してほしい点があれば記入してください"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-primary resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* 投稿ボタン */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '投稿中...' : '評価を投稿する'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          ※ 投稿後の評価は修正できません
        </p>
      </div>
    </div>
  );
}
