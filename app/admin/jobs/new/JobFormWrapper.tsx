'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import JobForm from '@/components/admin/JobForm';
import { getAdminJobTemplates, getFacilityInfo, getWorkerDetail } from '@/src/lib/actions';

interface JobFormWrapperProps {
  mode: 'create' | 'edit';
  jobId?: string;
  initialFormats: { id: number; label: string; content: string }[];
  initialDismissalReasons: string;
}

interface OfferTargetWorker {
  id: number;
  name: string;
  profileImage: string | null;
}

export default function JobFormWrapper({
  mode,
  jobId,
  initialFormats,
  initialDismissalReasons,
}: JobFormWrapperProps) {
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // オファーモード判定
  const isOfferMode = searchParams?.get('mode') === 'offer';
  const offerWorkerId = searchParams?.get('workerId');

  // Admin依存のデータ
  const [templates, setTemplates] = useState<any[]>([]);
  const [facilityInfo, setFacilityInfo] = useState<any>(null);
  const [offerTargetWorker, setOfferTargetWorker] = useState<OfferTargetWorker | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // adminが確立されたらadmin依存のデータを即座に取得
  useEffect(() => {
    if (isAdminLoading) return;

    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadAdminData = async () => {
      try {
        // admin依存のデータを並列取得
        const promises: Promise<any>[] = [
          getAdminJobTemplates(admin.facilityId),
          getFacilityInfo(admin.facilityId),
        ];

        // オファーモードの場合、対象ワーカー情報も取得
        if (isOfferMode && offerWorkerId) {
          promises.push(getWorkerDetail(parseInt(offerWorkerId), admin.facilityId));
        }

        const results = await Promise.all(promises);

        setTemplates(results[0]);
        setFacilityInfo(results[1]);

        // オファー対象ワーカー情報をセット
        if (isOfferMode && results[2]) {
          const workerData = results[2];
          // hasCompletedRatedがtrueでない場合はオファー不可
          if (!workerData.hasCompletedRated) {
            alert('このワーカーにはオファーを送れません（レビュー完了済みではありません）');
            router.push('/admin/workers');
            return;
          }
          setOfferTargetWorker({
            id: workerData.id,
            name: workerData.name,
            profileImage: workerData.profileImage,
          });
        }
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadAdminData();
  }, [admin, isAdmin, isAdminLoading, router, isOfferMode, offerWorkerId]);

  // ローディング中のスケルトン表示
  if (isAdminLoading || isDataLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <JobForm
      mode={mode}
      jobId={jobId}
      initialData={{
        templates,
        facilityInfo,
        formats: initialFormats,
        dismissalReasons: initialDismissalReasons,
      }}
      isOfferMode={isOfferMode}
      offerTargetWorker={offerTargetWorker}
    />
  );
}
