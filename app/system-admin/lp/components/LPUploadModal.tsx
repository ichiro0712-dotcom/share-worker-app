'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileArchive, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { uploadLandingPage } from '@/lib/lp-actions';

type LPUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editLpNumber?: number; // 上書き時のLP番号
};

export default function LPUploadModal({
  isOpen,
  onClose,
  onSuccess,
  editLpNumber,
}: LPUploadModalProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.zip')) {
        setError('ZIPファイルを選択してください');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      // ファイル名からデフォルトのLP名を設定
      if (!name) {
        setName(selectedFile.name.replace('.zip', ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSuccess(null);

    if (!file) {
      setError('ZIPファイルを選択してください');
      return;
    }

    if (!name.trim()) {
      setError('LP名を入力してください');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      if (editLpNumber !== undefined) {
        formData.append('lpNumber', editLpNumber.toString());
      }

      const result = await uploadLandingPage(formData);

      if (result.success) {
        setSuccess(
          editLpNumber !== undefined
            ? `LP ${editLpNumber} を更新しました`
            : `LP ${result.lpNumber} を作成しました`
        );
        // 一部ファイル失敗時の警告を表示
        if (result.warning) {
          setWarning(result.warning);
        }
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, result.warning ? 3000 : 1500); // 警告がある場合は長めに表示
      } else {
        setError(result.error || 'アップロードに失敗しました');
      }
    } catch (err: any) {
      setError(err.message || 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setFile(null);
    setError(null);
    setWarning(null);
    setSuccess(null);
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.zip')) {
        setError('ZIPファイルを選択してください');
        return;
      }
      setFile(droppedFile);
      setError(null);
      if (!name) {
        setName(droppedFile.name.replace('.zip', ''));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editLpNumber !== undefined ? `LP ${editLpNumber} を更新` : '新規LPアップロード'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* LP名入力 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LP名（管理用）
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
              placeholder="例: 看護師向けLP 2024年夏"
            />
          </div>

          {/* ファイルアップロード */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIPファイル
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors
                ${file
                  ? 'border-rose-300 bg-rose-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center text-center">
                {file ? (
                  <>
                    <FileArchive className="w-10 h-10 text-rose-500 mb-2" />
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      クリックまたはドラッグ＆ドロップ
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      index.html + 画像を含むZIPファイル
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 自動挿入の説明 */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>自動挿入されるタグ：</strong>
              <br />
              GTMスニペット、LINE Tag、tracking.js が自動的に挿入されます。
              既にタグが含まれている場合はスキップされます。
            </p>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 警告表示（一部ファイル失敗時） */}
          {warning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">{warning}</p>
            </div>
          )}

          {/* 成功表示 */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* ボタン */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  アップロード
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
