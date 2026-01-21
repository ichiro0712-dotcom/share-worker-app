'use client';

/**
 * 勤怠変更申請一覧コンポーネント
 */

import { useRouter } from 'next/navigation';
import { ChevronRight, Clock, User, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/src/lib/salary-calculator';
import type { PendingModificationItem, ModificationStatus } from '@/src/types/attendance';

interface ModificationRequestListProps {
  items: PendingModificationItem[];
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<
  ModificationStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: '未承認',
    color: 'bg-amber-100 text-amber-800',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  RESUBMITTED: {
    label: '再申請',
    color: 'bg-blue-100 text-blue-800',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
  },
  APPROVED: {
    label: '承認済み',
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  REJECTED: {
    label: '却下',
    color: 'bg-red-100 text-red-800',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

export function ModificationRequestList({
  items,
  isLoading = false,
}: ModificationRequestListProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">承認待ちの申請はありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                詳細
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ワーカー
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                勤務日
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状況
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                申請金額
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                申請日時
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const config = STATUS_CONFIG[item.status];
              const workDate = new Date(item.workDate);
              const createdAt = new Date(item.createdAt);
              const difference = item.requestedAmount - item.originalAmount;

              return (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/admin/tasks/attendance/${item.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-4">
                    <button className="p-2 rounded-full hover:bg-gray-100">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {item.workerName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {workDate.toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </div>
                    <div className="text-xs text-gray-500">{item.jobTitle}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                    >
                      {config.icon}
                      {config.label}
                      {item.resubmitCount > 0 && ` (${item.resubmitCount}回目)`}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.requestedAmount)}
                    </div>
                    <div
                      className={`text-xs ${
                        difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {difference >= 0 ? '+' : ''}
                      {formatCurrency(difference)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-500">
                      {createdAt.toLocaleDateString('ja-JP')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {createdAt.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
