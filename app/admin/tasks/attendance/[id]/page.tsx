'use client';

/**
 * 勤怠変更申請詳細ページ（施設管理者向け）
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { ModificationRequestDetail as ModificationRequestDetailComponent } from '@/components/admin/attendance/ModificationRequestDetail';
import {
  getModificationRequestDetail,
  approveModificationRequest,
  rejectModificationRequest,
} from '@/src/lib/actions/attendance-admin';
import type { ModificationRequestDetail } from '@/src/types/attendance';

export default function AttendanceApprovalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const modificationId = params.id ? parseInt(params.id as string) : null;

  const [request, setRequest] = useState<ModificationRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isAdminLoading && (!isAdmin || !admin)) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!modificationId || !admin?.facilityId) {
        if (!isAdminLoading && !admin?.facilityId) {
          toast.error('申請IDが不正です');
          router.push('/admin/tasks/attendance');
        }
        return;
      }

      try {
        const data = await getModificationRequestDetail(admin.facilityId, modificationId);
        if (!data) {
          toast.error('申請が見つかりません');
          router.push('/admin/tasks/attendance');
          return;
        }
        setRequest(data);
      } catch (error) {
        console.error('データ取得エラー:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (admin?.facilityId) {
      fetchData();
    }
  }, [modificationId, admin?.facilityId, isAdminLoading, router]);

  const handleApprove = async (comment: string) => {
    if (!modificationId || !admin?.facilityId) return;

    setIsProcessing(true);
    try {
      const result = await approveModificationRequest(admin.facilityId, modificationId, {
        adminComment: comment,
      });

      if (result.success) {
        toast.success(result.message);
        router.push('/admin/tasks/attendance');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('承認エラー:', error);
      toast.error('承認に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (comment: string) => {
    if (!modificationId || !admin?.facilityId) return;

    setIsProcessing(true);
    try {
      const result = await rejectModificationRequest(admin.facilityId, modificationId, {
        adminComment: comment,
      });

      if (result.success) {
        toast.success(result.message);
        router.push('/admin/tasks/attendance');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('却下エラー:', error);
      toast.error('却下に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">勤怠変更申請詳細</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <ModificationRequestDetailComponent
          request={request}
          onApprove={handleApprove}
          onReject={handleReject}
          isLoading={isProcessing}
        />
      </div>
    </div>
  );
}
