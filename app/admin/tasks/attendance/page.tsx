'use client';

/**
 * 勤怠承認一覧ページ（施設管理者向け）
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Filter, RefreshCw } from 'lucide-react';
import { ModificationRequestList } from '@/components/admin/attendance/ModificationRequestList';
import { getPendingModificationRequests } from '@/src/lib/actions/attendance-admin';
import type { PendingModificationItem } from '@/src/types/attendance';

type StatusFilter = 'all' | 'PENDING' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED';

export default function AttendanceApprovalListPage() {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [items, setItems] = useState<PendingModificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchData = async () => {
    if (!admin?.facilityId) return;
    setIsLoading(true);
    try {
      const result = await getPendingModificationRequests(admin.facilityId, {
        status: statusFilter,
        limit: 50,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminLoading && (!isAdmin || !admin)) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  useEffect(() => {
    if (admin?.facilityId) {
      fetchData();
    }
  }, [statusFilter, admin?.facilityId]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold">勤怠変更申請</h1>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-sm rounded-full">
                {total}件
              </span>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">ステータス</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'すべて' },
              { value: 'PENDING', label: '未承認' },
              { value: 'RESUBMITTED', label: '再申請' },
              { value: 'APPROVED', label: '承認済み' },
              { value: 'REJECTED', label: '却下' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value as StatusFilter)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === option.value
                    ? 'bg-[#66cc99] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 一覧 */}
        <ModificationRequestList items={items} isLoading={isLoading} />
      </div>
    </div>
  );
}
