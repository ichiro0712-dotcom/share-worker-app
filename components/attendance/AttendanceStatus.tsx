'use client';

/**
 * 出退勤状態表示コンポーネント
 */

import { Clock, MapPin, AlertTriangle, Building2 } from 'lucide-react';
import type { CheckInStatusResponse } from '@/src/types/attendance';

interface AttendanceStatusProps {
  status: CheckInStatusResponse;
}

export function AttendanceStatus({ status }: AttendanceStatusProps) {
  if (!status.isCheckedIn) {
    return null;
  }

  const checkInTime = status.checkInTime
    ? new Date(status.checkInTime).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="font-medium text-gray-800">出勤中</span>
      </div>

      <div className="space-y-2 text-sm">
        {status.facilityName && (
          <div className="flex items-center gap-2 text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{status.facilityName}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span>出勤時刻: {checkInTime}</span>
        </div>

        {status.usedEmergencyCode && (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span>緊急時番号で出勤</span>
          </div>
        )}

        {status.isLate && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>遅刻しています（退勤時に勤怠変更申請が必要）</span>
          </div>
        )}
      </div>
    </div>
  );
}
