'use client';

import { X, AlertTriangle, TrendingDown, XCircle } from 'lucide-react';
import { useEffect } from 'react';

interface CancelConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  workerName: string;
  jobTitle: string;
  workDate: string;
  isLoading?: boolean;
}

export function CancelConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  workerName,
  jobTitle,
  workDate,
  isLoading = false,
}: CancelConfirmationModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="font-bold text-lg">マッチングキャンセルの確認</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-4">
          {/* キャンセル対象情報 */}
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <p><span className="text-gray-500">ワーカー：</span>{workerName}</p>
            <p><span className="text-gray-500">求人：</span>{jobTitle}</p>
            <p><span className="text-gray-500">勤務日：</span>{workDate}</p>
          </div>

          {/* ペナルティ警告 */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              キャンセルによる影響
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-red-700">
                <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>キャンセル率に影響</strong><br />
                  施設のキャンセル率が上昇し、ワーカーからの信頼度が低下する可能性があります。
                </span>
              </li>
              <li className="flex items-start gap-2 text-red-700">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>ワーカーへの通知</strong><br />
                  ワーカーに「施設側からのキャンセル」として通知されます。
                </span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            本当にこのマッチングをキャンセルしますか？
          </p>
        </div>

        {/* フッター */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
          >
            やめる
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
          >
            {isLoading ? 'キャンセル中...' : 'キャンセルする'}
          </button>
        </div>
      </div>
    </div>
  );
}
