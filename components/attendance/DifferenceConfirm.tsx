'use client';

/**
 * 差額確認コンポーネント
 */

import { useState } from 'react';
import { ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/src/lib/salary-calculator';

interface DifferenceConfirmProps {
  originalAmount: number;
  requestedAmount: number;
  scheduledTime: {
    startTime: string;
    endTime: string;
    breakTime: number;
  };
  requestedTime: {
    startTime: string;
    endTime: string;
    breakTime: number;
  };
  transportationFee: number;
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function DifferenceConfirm({
  originalAmount,
  requestedAmount,
  scheduledTime,
  requestedTime,
  transportationFee,
  onConfirm,
  onBack,
  isLoading = false,
}: DifferenceConfirmProps) {
  const [isChecked, setIsChecked] = useState(false);

  const difference = requestedAmount - originalAmount;
  const isDecrease = difference < 0;

  // 金額内訳（給与部分）
  const originalWage = originalAmount - transportationFee;
  const requestedWage = requestedAmount - transportationFee;

  return (
    <div className="space-y-6">
      {/* 時間比較 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">勤務時間</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">定刻</p>
            <p className="font-medium">
              {scheduledTime.startTime} 〜 {scheduledTime.endTime}
            </p>
            <p className="text-gray-500">
              休憩: {scheduledTime.breakTime > 0 ? `${scheduledTime.breakTime}分` : 'なし'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">申請内容</p>
            <p className="font-medium">
              {requestedTime.startTime} 〜 {requestedTime.endTime}
            </p>
            <p className="text-gray-500">
              休憩: {requestedTime.breakTime > 0 ? `${requestedTime.breakTime}分` : 'なし'}
            </p>
          </div>
        </div>
      </div>

      {/* 金額比較 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 divide-x">
          {/* 規定の金額 */}
          <div className="p-4">
            <h4 className="text-sm text-gray-500 mb-3">規定の報酬</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">給与</span>
                <span>{formatCurrency(originalWage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">交通費</span>
                <span>{formatCurrency(transportationFee)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-medium">
                <span>合計</span>
                <span>{formatCurrency(originalAmount)}</span>
              </div>
            </div>
          </div>

          {/* 申請の金額 */}
          <div className="p-4 bg-blue-50">
            <h4 className="text-sm text-gray-500 mb-3">申請の報酬</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">給与</span>
                <span>{formatCurrency(requestedWage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">交通費</span>
                <span>{formatCurrency(transportationFee)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-medium">
                <span>合計</span>
                <span className="text-blue-700">{formatCurrency(requestedAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 差額 */}
        <div
          className={`p-4 border-t ${
            isDecrease ? 'bg-amber-50' : 'bg-green-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDecrease ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              <span className="font-medium">差額</span>
            </div>
            <span
              className={`text-xl font-bold ${
                isDecrease ? 'text-amber-700' : 'text-green-700'
              }`}
            >
              {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
            </span>
          </div>
        </div>
      </div>

      {/* 確認チェックボックス */}
      <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
          className="w-5 h-5 mt-0.5 text-[#66cc99] rounded"
        />
        <span className="text-sm text-gray-700">
          報酬の差額を確認しました。
          {isDecrease && '規定より少ない報酬となることを理解しています。'}
        </span>
      </label>

      {/* ボタン */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
        >
          入力画面に戻る
        </button>
        <button
          onClick={onConfirm}
          disabled={!isChecked || isLoading}
          className={`flex-1 py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
            !isChecked || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'
          }`}
        >
          {isLoading ? '送信中...' : '勤怠変更申請を提出する'}
          {!isLoading && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
