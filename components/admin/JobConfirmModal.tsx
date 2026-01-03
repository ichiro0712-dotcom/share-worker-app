'use client';

import { X, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface JobConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onOpenPreview: () => void;
  selectedDatesCount: number;
  isSubmitting: boolean;
}

export function JobConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onOpenPreview,
  selectedDatesCount,
  isSubmitting,
}: JobConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold">求人公開の確認</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          <p className="text-center text-gray-700 mb-4">
            本当に公開しますか？
          </p>
          <p className="text-center text-sm text-gray-500 mb-6">
            {selectedDatesCount}件の求人が作成されます
          </p>

          {/* プレビューリンク */}
          <button
            onClick={onOpenPreview}
            className="w-full flex items-center justify-center gap-2 text-primary hover:text-primary/80 transition-colors mb-6"
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm underline">プレビューで内容を確認する</span>
          </button>
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                公開中...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                公開する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
