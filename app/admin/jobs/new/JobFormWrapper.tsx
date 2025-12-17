'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import JobForm from '@/components/admin/JobForm';
import { getAdminJobTemplates, getFacilityInfo } from '@/src/lib/actions';

interface JobFormWrapperProps {
  mode: 'create' | 'edit';
  jobId?: string;
  initialFormats: { id: number; label: string; content: string }[];
  initialDismissalReasons: string;
}

export default function JobFormWrapper({
  mode,
  jobId,
  initialFormats,
  initialDismissalReasons,
}: JobFormWrapperProps) {
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const router = useRouter();

  // Admin依存のデータ
  const [templates, setTemplates] = useState<any[]>([]);
  const [facilityInfo, setFacilityInfo] = useState<any>(null);
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
        const [templatesData, facilityData] = await Promise.all([
          getAdminJobTemplates(admin.facilityId),
          getFacilityInfo(admin.facilityId),
        ]);

        setTemplates(templatesData);
        setFacilityInfo(facilityData);
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadAdminData();
  }, [admin, isAdmin, isAdminLoading, router]);

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
    />
  );
}
