'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Star, Phone, Mail, Briefcase } from 'lucide-react';
import { getWorkerDetail } from '@/src/lib/actions';
import { useAuth } from '@/contexts/AuthContext';

interface WorkerDetailData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  qualifications: string[];
  totalWorkDays: number;
  averageRating: number;
  reviewCount: number;
  workHistory: {
    id: number;
    jobTitle: string;
    workDate: string;
    status: string;
  }[];
  evaluations: {
    id: number;
    jobTitle: string;
    jobDate: string;
    rating: number;
    comment: string | null;
  }[];
}

export default function WorkerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(params.id);
  const [worker, setWorker] = useState<WorkerDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadWorker = async () => {
      setLoading(true);
      try {
        const data = await getWorkerDetail(workerId, admin.facilityId);
        setWorker(data);
      } catch (error) {
        console.error('Failed to load worker:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorker();
  }, [workerId, admin, isAdmin, isAdminLoading, router]);

  if (loading || isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ワーカーが見つかりません</p>
          <button
            onClick={() => router.back()}
            className="text-primary hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">ワーカー詳細</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 基本情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex gap-4 mb-4">
            {/* 顔写真 */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden">
                {worker.profileImage ? (
                  <img
                    src={worker.profileImage}
                    alt={worker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-3xl">{worker.name.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 名前・評価 */}
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">{worker.name}</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg font-bold">
                    {worker.averageRating.toFixed(1)}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  ({worker.reviewCount}件の評価)
                </span>
              </div>
            </div>
          </div>

          {/* 詳細情報 */}
          <div className="space-y-3 pt-3 border-t border-gray-200">
            {worker.phone && (
              <div className="flex gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <span>{worker.phone}</span>
              </div>
            )}
            <div className="flex gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span>{worker.email}</span>
            </div>
          </div>
        </div>

        {/* 勤務実績サマリー */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">勤務実績（当施設）</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">勤務回数</div>
              <div className="text-2xl font-bold text-primary">
                {worker.totalWorkDays}
                <span className="text-sm text-gray-600 ml-1">回</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">評価件数</div>
              <div className="text-2xl font-bold text-primary">
                {worker.reviewCount}
                <span className="text-sm text-gray-600 ml-1">件</span>
              </div>
            </div>
          </div>
        </div>

        {/* 資格 */}
        {worker.qualifications.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold mb-3">保有資格</h3>
            <div className="flex flex-wrap gap-2">
              {worker.qualifications.map((qual, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary-light text-primary text-sm rounded-full"
                >
                  {qual}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 勤務履歴 */}
        {worker.workHistory.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold mb-3">勤務履歴（当施設）</h3>
            <div className="space-y-3">
              {worker.workHistory.slice(0, 10).map((history) => (
                <div
                  key={history.id}
                  className="pb-3 border-b border-gray-200 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-sm">{history.jobTitle}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${history.status === 'COMPLETED_RATED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                      }`}>
                      {history.status === 'COMPLETED_RATED' ? '評価済' : '完了'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 ml-6">
                    {history.workDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 最近の評価 */}
        {worker.evaluations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold mb-3">評価履歴（当施設）</h3>
            <div className="space-y-4">
              {worker.evaluations.slice(0, 5).map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="pb-4 border-b border-gray-200 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">
                        {evaluation.jobTitle}
                      </div>
                      <div className="text-xs text-gray-500">
                        {evaluation.jobDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">
                        {evaluation.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  {evaluation.comment && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {evaluation.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
