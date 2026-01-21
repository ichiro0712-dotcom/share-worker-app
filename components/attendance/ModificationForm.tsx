'use client';

/**
 * 勤怠変更申請フォームコンポーネント
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Clock, Coffee } from 'lucide-react';
import { calculateSalary, formatCurrency, formatMinutesToHoursAndMinutes } from '@/src/lib/salary-calculator';

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

// 時間オプション生成（00:00〜23:30を30分刻み）
const generateTimeOptions = () => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

// 休憩時間オプション
const BREAK_OPTIONS = [0, 15, 30, 45, 60, 90, 120];

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
  const [hasBreak, setHasBreak] = useState(scheduledTime.breakTime > 0);
  const [breakTime, setBreakTime] = useState(scheduledTime.breakTime);
  const [comment, setComment] = useState('');

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
      breakMinutes: hasBreak ? breakTime : 0,
      hourlyRate: scheduledTime.hourlyWage,
    });

    setCalculatedAmount(result.totalPay + scheduledTime.transportationFee);
    setWorkedMinutes(result.workedMinutes);
  }, [startTime, endTime, hasBreak, breakTime, scheduledTime, workDate]);

  const handleSubmit = () => {
    if (!comment.trim()) {
      alert('コメントを入力してください');
      return;
    }

    onSubmit({
      startTime,
      endTime,
      breakTime: hasBreak ? breakTime : 0,
      hasBreak,
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
      </div>

      {/* 勤務時間入力 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          勤務時間
        </label>
        <div className="flex items-center gap-2">
          <select
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#66cc99]"
          >
            {TIME_OPTIONS.map((time) => (
              <option key={`start-${time}`} value={time}>
                {time}
              </option>
            ))}
          </select>
          <span className="text-gray-500">〜</span>
          <select
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#66cc99]"
          >
            {TIME_OPTIONS.map((time) => (
              <option key={`end-${time}`} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          実働時間: {formatMinutesToHoursAndMinutes(workedMinutes)}
        </p>
      </div>

      {/* 休憩時間 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          休憩時間
        </label>
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!hasBreak}
                onChange={() => setHasBreak(false)}
                className="w-4 h-4 text-[#66cc99]"
              />
              <span>なし</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={hasBreak}
                onChange={() => setHasBreak(true)}
                className="w-4 h-4 text-[#66cc99]"
              />
              <span>あり</span>
            </label>
          </div>

          {hasBreak && (
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-gray-400" />
              <select
                value={breakTime}
                onChange={(e) => setBreakTime(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#66cc99]"
              >
                {BREAK_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}分
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
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
