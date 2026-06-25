'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface MapPinAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLat: number;
  currentLng: number;
  facilityId: number;
  onSave: (lat: number, lng: number) => void;
}

type MoveStep = 'small' | 'medium' | 'large';

const STEP_VALUES: Record<MoveStep, number> = {
  small: 0.0001,   // 約11m
  medium: 0.0005,  // 約55m
  large: 0.001,    // 約110m
};

const STEP_LABELS: Record<MoveStep, string> = {
  small: '小（約11m）',
  medium: '中（約55m）',
  large: '大（約110m）',
};

// Google Maps Embed API キー
const MAPS_EMBED_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function MapPinAdjustModal({
  isOpen,
  onClose,
  currentLat,
  currentLng,
  facilityId,
  onSave,
}: MapPinAdjustModalProps) {
  const [lat, setLat] = useState(currentLat);
  const [lng, setLng] = useState(currentLng);
  const [step, setStep] = useState<MoveStep>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // モーダルが開いたときに初期値をセット
  useEffect(() => {
    if (isOpen) {
      setLat(currentLat);
      setLng(currentLng);
      setIframeKey(prev => prev + 1);
    }
  }, [isOpen, currentLat, currentLng]);

  // 方向ボタンによる移動
  const move = (direction: 'up' | 'down' | 'left' | 'right') => {
    const stepValue = STEP_VALUES[step];
    let newLat = lat;
    let newLng = lng;

    switch (direction) {
      case 'up':
        newLat = lat + stepValue;
        break;
      case 'down':
        newLat = lat - stepValue;
        break;
      case 'left':
        newLng = lng - stepValue;
        break;
      case 'right':
        newLng = lng + stepValue;
        break;
    }

    setLat(newLat);
    setLng(newLng);
  };

  // 斜め移動
  const moveDiagonal = (direction: 'up-left' | 'up-right' | 'down-left' | 'down-right') => {
    const stepValue = STEP_VALUES[step];
    let newLat = lat;
    let newLng = lng;

    switch (direction) {
      case 'up-left':
        newLat = lat + stepValue;
        newLng = lng - stepValue;
        break;
      case 'up-right':
        newLat = lat + stepValue;
        newLng = lng + stepValue;
        break;
      case 'down-left':
        newLat = lat - stepValue;
        newLng = lng - stepValue;
        break;
      case 'down-right':
        newLat = lat - stepValue;
        newLng = lng + stepValue;
        break;
    }

    setLat(newLat);
    setLng(newLng);
  };

  // プレビュー更新（iframeを再レンダリング）
  const handlePreview = () => {
    setIframeKey(prev => prev + 1);
  };

  // リセット
  const handleReset = () => {
    setLat(currentLat);
    setLng(currentLng);
    setIframeKey(prev => prev + 1);
  };

  // 保存（緯度経度のみ更新）
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { updateFacilityLatLng } = await import('@/src/lib/actions');
      const result = await updateFacilityLatLng(facilityId, lat, lng);

      if (result.success) {
        onSave(lat, lng);
        onClose();
      } else {
        alert(result.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Embed API URL
  const embedUrl = `https://www.google.com/maps/embed/v1/place?q=${lat},${lng}&zoom=16&key=${MAPS_EMBED_API_KEY}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">マップピンを調整</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 space-y-4">
          {/* 地図プレビュー（Embed API） */}
          <div className="w-full h-[60vh] min-h-[360px] bg-gray-100 rounded-lg border border-gray-300 overflow-hidden">
            <iframe
              key={iframeKey}
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="地図プレビュー"
            />
          </div>

          {/* 地図操作のヒント */}
          <p className="text-xs text-gray-500 -mt-1">
            地図内の <span className="font-medium">＋ / －</span> ボタンやスクロールで拡大・縮小して位置を確認できます。ピン（赤●）の位置は下の方向ボタンで調整してください。
          </p>

          {/* 現在の座標表示 */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">緯度:</span>{' '}
                <span className="font-mono">{lat.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-gray-500">経度:</span>{' '}
                <span className="font-mono">{lng.toFixed(6)}</span>
              </div>
            </div>
          </div>

          {/* 方向ボタン */}
          <div className="flex flex-col items-center">
            <p className="text-sm text-gray-600 mb-2">📍 ピン位置の微調整</p>
            <div className="grid grid-cols-3 gap-1">
              {/* 上段: 斜め左上、上、斜め右上 */}
              <button
                onClick={() => moveDiagonal('up-left')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              >
                <span className="text-lg">↖</span>
              </button>
              <button
                onClick={() => move('up')}
                className="w-12 h-12 bg-admin-primary text-white hover:bg-admin-primary-dark rounded-lg flex items-center justify-center transition-colors"
              >
                <ChevronUp className="w-6 h-6" />
              </button>
              <button
                onClick={() => moveDiagonal('up-right')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              >
                <span className="text-lg">↗</span>
              </button>

              {/* 中段: 左、中央、右 */}
              <button
                onClick={() => move('left')}
                className="w-12 h-12 bg-admin-primary text-white hover:bg-admin-primary-dark rounded-lg flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">●</span>
              </div>
              <button
                onClick={() => move('right')}
                className="w-12 h-12 bg-admin-primary text-white hover:bg-admin-primary-dark rounded-lg flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* 下段: 斜め左下、下、斜め右下 */}
              <button
                onClick={() => moveDiagonal('down-left')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              >
                <span className="text-lg">↙</span>
              </button>
              <button
                onClick={() => move('down')}
                className="w-12 h-12 bg-admin-primary text-white hover:bg-admin-primary-dark rounded-lg flex items-center justify-center transition-colors"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
              <button
                onClick={() => moveDiagonal('down-right')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              >
                <span className="text-lg">↘</span>
              </button>
            </div>
          </div>

          {/* 移動量選択 */}
          <div>
            <p className="text-sm text-gray-600 mb-2">移動量:</p>
            <div className="flex gap-2">
              {(Object.keys(STEP_VALUES) as MoveStep[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                    step === s
                      ? 'bg-admin-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {STEP_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              className="flex-1 px-4 py-2.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              プレビュー更新
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              リセット
            </button>
          </div>
        </div>

        {/* フッター */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm bg-admin-primary text-white rounded-lg hover:bg-admin-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
