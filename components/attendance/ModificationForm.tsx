'use client';

/**
 * 勤怠変更申請フォームコンポーネント
 * - 勤務時間の変更をスクロールホイール型ピッカーで入力
 * - 休憩時間は元の求人設定値を引き継ぎ（ワーカーからの変更不可）
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { calculateSalary, formatCurrency, formatMinutesToHoursAndMinutes } from '@/src/lib/salary-calculator';
import { TimeWheelPicker } from '@/components/ui/TimeWheelPicker';

interface ModificationFormProps {
  attendance: {
    checkInTime: Date;
    checkOutTime: Date;
  };
  scheduledTime: {
    startTime: string;
    endTime: string;
    breakTime: number;
    hourlyWage: number;
    transportationFee: number;
  };
  workDate: Date;
  onSubmit: (data: ModificationFormData) => void;
  isResubmit?: boolean;
  previousRejection?: {
    adminComment: string;
    rejectedAt: Date;
  };
  isLoading?: boolean;
}

export interface ModificationFormData {
  startTime: string;
  endTime: string;
  breakTime: number;
  hasBreak: boolean;
  comment: string;
}

export function ModificationForm({
  attendance,
  scheduledTime,
  workDate,
  onSubmit,
  isResubmit = false,
  previousRejection,
  isLoading = false,
}: ModificationFormProps) {
  // フォーム状態
  const [startTime, setStartTime] = useState(scheduledTime.startTime);
  const [endTime, setEndTime] = useState(scheduledTime.endTime);
  const [comment, setComment] = useState('');

  // 休憩時間は元の求人設定値を固定で使用
  const breakTime = scheduledTime.breakTime;

  // 計算結果
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [workedMinutes, setWorkedMinutes] = useState(0);

  // 金額計算
  useEffect(() => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const start = new Date(workDate);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(workDate);
    end.setHours(endHour, endMinute, 0, 0);
    // 終了時刻が開始時刻より前の場合は翌日
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    const result = calculateSalary({
      startTime: start,
      endTime: end,
      breakMinutes: breakTime,
      hourlyRate: scheduledTime.hourlyWage,
    });

    setCalculatedAmount(result.totalPay + scheduledTime.transportationFee);
    setWorkedMinutes(result.workedMinutes);
  }, [startTime, endTime, breakTime, scheduledTime, workDate]);

  const handleSubmit = () => {
    if (!comment.trim()) {
      alert('コメントを入力してください');
      return;
    }

    onSubmit({
      startTime,
      endTime,
      breakTime,
      hasBreak: breakTime > 0,
      comment,
    });
  };

  // 打刻時間のフォーマット
  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* 再申請の場合は却下理由を表示 */}
      {isResubmit && previousRejection && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">前回の申請は却下されました</p>
              <p className="text-sm text-red-700 mt-1">
                却下理由: {previousRejection.adminComment}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {new Date(previousRejection.rejectedAt).toLocaleDateString('ja-JP')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 打刻時間の表示 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">打刻時間</h4>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            {formatTime(attendance.checkInTime)} 〜 {formatTime(attendance.checkOutTime)}
          </span>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          定刻: {scheduledTime.startTime} 〜 {scheduledTime.endTime}（休憩{scheduledTime.breakTime}分）
        </div>
      </div>

      {/* 勤務時間入力（スクロールホイール型ピッカー） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          勤務時間
        </label>
        <div className="flex items-center justify-center gap-3">
          <TimeWheelPicker
            value={startTime}
            onChange={setStartTime}
            label="開始"
            className="flex-1"
          />
          <span className="text-gray-400 text-lg font-medium">〜</span>
          <TimeWheelPicker
            value={endTime}
            onChange={setEndTime}
            label="終了"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          実働時間: {formatMinutesToHoursAndMinutes(workedMinutes)}
          {breakTime > 0 && `（休憩${breakTime}分を含む）`}
        </p>
      </div>

      {/* コメント */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          コメント <span className="text-red-500">*</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="遅刻・早退・残業の理由をご記入ください"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#66cc99] resize-none"
        />
      </div>

      {/* 概算金額 */}
      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">概算報酬額</span>
          <span className="text-xl font-bold text-green-700">
            {formatCurrency(calculatedAmount)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          ※交通費 {formatCurrency(scheduledTime.transportationFee)} を含む
        </p>
      </div>

      {/* 送信ボタン */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !comment.trim()}
        className={`w-full py-4 rounded-lg font-medium transition-colors ${
          isLoading || !comment.trim()
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'
        }`}
      >
        {isLoading ? '送信中...' : '差額を確認する'}
      </button>
    </div>
  );
}
