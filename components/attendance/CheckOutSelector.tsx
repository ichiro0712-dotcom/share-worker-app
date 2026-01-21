'use client';

/**
 * 退勤タイプ選択コンポーネント
 * 遅刻/緊急番号使用時は選択肢を制限
 */

import { Clock, FileEdit, AlertTriangle } from 'lucide-react';
import type { CheckOutType } from '@/src/types/attendance';

interface CheckOutSelectorProps {
  isLate: boolean;
  usedEmergencyCode: boolean;
  onSelect: (type: CheckOutType) => void;
  scheduledTime?: {
    startTime: string;
    endTime: string;
    breakTime: number;
  };
}

export function CheckOutSelector({
  isLate,
  usedEmergencyCode,
  onSelect,
  scheduledTime,
}: CheckOutSelectorProps) {
  // 遅刻または緊急番号使用の場合は勤怠変更申請が必須
  const requiresModification = isLate || usedEmergencyCode;

  return (
    <div className="space-y-4">
      {requiresModification && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                {isLate ? '遅刻が発生しています' : '緊急時番号を使用しました'}
              </p>
              <p className="text-sm text-amber-700 mt-1">
                退勤後、勤怠変更申請が必要です。
              </p>
            </div>
          </div>
        </div>
      )}

      {scheduledTime && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">本日の勤務予定</h4>
          <div className="text-sm text-gray-600">
            <p>
              {scheduledTime.startTime} 〜 {scheduledTime.endTime}
              {scheduledTime.breakTime > 0 && ` （休憩${scheduledTime.breakTime}分）`}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!requiresModification && (
          <button
            onClick={() => onSelect('ON_TIME')}
            className="w-full flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-[#66cc99] hover:bg-green-50 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">定刻で退勤する</p>
              <p className="text-sm text-gray-500">
                定刻通りの勤務であった場合
              </p>
            </div>
          </button>
        )}

        <button
          onClick={() => onSelect('MODIFICATION_REQUIRED')}
          className={`w-full flex items-center gap-4 p-4 bg-white border-2 rounded-lg transition-colors ${
            requiresModification
              ? 'border-[#66cc99] bg-green-50'
              : 'border-gray-200 hover:border-[#66cc99] hover:bg-green-50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileEdit className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-800">
              退勤後、勤怠変更申請する
            </p>
            <p className="text-sm text-gray-500">
              {requiresModification
                ? '遅刻・早退の場合は申請が必要です'
                : '残業などを実施した場合'}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
