'use client';

/**
 * 勤怠変更申請一覧コンポーネント
 * カイテクの表示形式に準拠
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, AlertCircle, CheckCircle, XCircle, RefreshCw, Mail } from 'lucide-react';
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
    label: '申請済み',
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

  // 日付と時間のフォーマット
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[d.getDay()];
    return `${year}/${month}/${day}（${weekday}）`;
  };

  const formatTimeRange = (startTime: string, endTime: string) => {
    // "09:00:00" → "9時" 形式
    const formatTime = (time: string) => {
      if (!time) return '';
      const [hours, minutes] = time.split(':');
      const h = parseInt(hours, 10);
      const m = parseInt(minutes, 10);
      if (m === 0) {
        return `${h}時`;
      }
      return `${h}時${m}分`;
    };
    return `${formatTime(startTime)}〜${formatTime(endTime)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                詳細
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                求人ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                <div>勤怠変更</div>
                <div>申請状況</div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                日時
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                事業所
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                ワーカー
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                連絡
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const config = STATUS_CONFIG[item.status];
              const workDate = new Date(item.workDate);

              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  {/* 詳細ボタン */}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => router.push(`/admin/tasks/attendance/${item.id}`)}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded transition-colors"
                    >
                      詳細
                    </button>
                  </td>
                  {/* 求人ID（リンク） */}
                  <td className="px-3 py-3">
                    {item.jobId > 0 ? (
                      <Link
                        href={`/admin/jobs/${item.jobId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.jobId}
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  {/* 勤怠変更申請状況 */}
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${config.color}`}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                  </td>
                  {/* 日時 */}
                  <td className="px-3 py-3">
                    <div className="text-sm text-gray-900">
                      {formatDate(workDate)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeRange(item.scheduledStartTime, item.scheduledEndTime)}
                    </div>
                  </td>
                  {/* 事業所 */}
                  <td className="px-3 py-3">
                    <span className="text-sm text-gray-900">{item.facilityName}</span>
                  </td>
                  {/* ワーカー（リンク） */}
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/workers/${item.workerId}`}
                      className="text-pink-600 hover:text-pink-800 hover:underline text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.workerName}
                    </Link>
                  </td>
                  {/* 連絡アイコン（メッセージリンク） */}
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/messages?workerId=${item.workerId}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      title={`${item.workerName}にメッセージを送る`}
                    >
                      <Mail className="w-5 h-5 text-gray-500 hover:text-gray-700" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 件数表示 */}
      <div className="px-4 py-3 border-t bg-gray-50 text-sm text-gray-600">
        {items.length}件のうち1 - {items.length}
      </div>
    </div>
  );
}
