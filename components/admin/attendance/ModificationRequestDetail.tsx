'use client';

/**
 * 勤怠変更申請詳細コンポーネント
 */

import { useState } from 'react';
import {
  User,
  Calendar,
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatMinutesToHoursAndMinutes } from '@/src/lib/salary-calculator';
import type { ModificationRequestDetail as ModificationRequestDetailType } from '@/src/types/attendance';

interface ModificationRequestDetailProps {
  request: ModificationRequestDetailType;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
  isLoading?: boolean;
}

export function ModificationRequestDetail({
  request,
  onApprove,
  onReject,
  isLoading = false,
}: ModificationRequestDetailProps) {
  const [adminComment, setAdminComment] = useState('');
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = () => {
    if (!adminComment.trim()) {
      alert('コメントを入力してください');
      return;
    }
    onApprove(adminComment);
  };

  const handleReject = () => {
    if (!adminComment.trim()) {
      alert('コメントを入力してください');
      return;
    }
    onReject(adminComment);
  };

  const attendance = request.attendance;
  const job = attendance?.application?.workDate.job;
  const workDate = attendance?.application?.workDate.workDate
    ? new Date(attendance.application.workDate.workDate)
    : null;

  // 時間フォーマット
  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // 定刻の計算
  const scheduledStartTime = job?.startTime || '--:--';
  const scheduledEndTime = job?.endTime || '--:--';
  const scheduledBreakTime = job?.breakTime ? parseInt(job.breakTime) : 0;

  // 打刻時間
  const checkInTime = attendance?.checkInTime ? formatTime(attendance.checkInTime) : '--:--';
  const checkOutTime = attendance?.checkOutTime ? formatTime(attendance.checkOutTime) : '--:--';

  // 申請時間
  const requestedStartTime = formatTime(request.requestedStartTime);
  const requestedEndTime = formatTime(request.requestedEndTime);

  // 差額
  const difference = request.requestedAmount - request.originalAmount;

  // 承認/却下済みかどうか
  const isProcessed = ['APPROVED', 'REJECTED'].includes(request.status);

  return (
    <div className="space-y-6">
      {/* ワーカー情報 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            {attendance?.user?.profileImage ? (
              <img
                src={attendance.user.profileImage}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {attendance?.user?.name || '不明'}
            </p>
            <p className="text-sm text-gray-500">{attendance?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* 勤務情報 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {workDate?.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
        </div>
        <p className="font-medium text-gray-900">{job?.title || '不明'}</p>
      </div>

      {/* 時間比較テーブル */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                &nbsp;
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                出勤
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                退勤
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                休憩
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-3 text-sm font-medium text-gray-700">定刻</td>
              <td className="px-4 py-3 text-center text-sm">{scheduledStartTime}</td>
              <td className="px-4 py-3 text-center text-sm">{scheduledEndTime}</td>
              <td className="px-4 py-3 text-center text-sm">{scheduledBreakTime}分</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">打刻</td>
              <td className="px-4 py-3 text-center text-sm">{checkInTime}</td>
              <td className="px-4 py-3 text-center text-sm">{checkOutTime}</td>
              <td className="px-4 py-3 text-center text-sm">-</td>
            </tr>
            <tr className="bg-blue-50">
              <td className="px-4 py-3 text-sm font-medium text-blue-700">申請</td>
              <td className="px-4 py-3 text-center text-sm text-blue-700">
                {requestedStartTime}
              </td>
              <td className="px-4 py-3 text-center text-sm text-blue-700">
                {requestedEndTime}
              </td>
              <td className="px-4 py-3 text-center text-sm text-blue-700">
                {request.requestedBreakTime}分
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 金額比較 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">金額</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">規定額</p>
            <p className="text-lg font-medium">{formatCurrency(request.originalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">申請額</p>
            <p className="text-lg font-medium text-blue-700">
              {formatCurrency(request.requestedAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">差額</p>
            <p
              className={`text-lg font-medium ${
                difference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {difference >= 0 ? '+' : ''}
              {formatCurrency(difference)}
            </p>
          </div>
        </div>
      </div>

      {/* ワーカーコメント */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-700">ワーカーコメント</h4>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">
          {request.workerComment}
        </p>
      </div>

      {/* 承認/却下フォーム */}
      {!isProcessed && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              管理者コメント <span className="text-red-500">*</span>
            </label>
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="承認/却下の理由を入力してください"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#66cc99] resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isLoading || !adminComment.trim()}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                isLoading || !adminComment.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              承認する
            </button>
            <button
              onClick={handleReject}
              disabled={isLoading || !adminComment.trim()}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                isLoading || !adminComment.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <XCircle className="w-5 h-5" />
              却下する
            </button>
          </div>
        </div>
      )}

      {/* 処理済みの場合 */}
      {isProcessed && (
        <div
          className={`rounded-lg p-4 ${
            request.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {request.status === 'APPROVED' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <span
              className={`font-medium ${
                request.status === 'APPROVED' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {request.status === 'APPROVED' ? '承認済み' : '却下済み'}
            </span>
          </div>
          {request.adminComment && (
            <p
              className={`text-sm ${
                request.status === 'APPROVED' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              コメント: {request.adminComment}
            </p>
          )}
          {request.reviewedAt && (
            <p
              className={`text-xs mt-1 ${
                request.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {new Date(request.reviewedAt).toLocaleString('ja-JP')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
