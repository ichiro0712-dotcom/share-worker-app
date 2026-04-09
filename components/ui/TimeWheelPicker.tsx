'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface TimeWheelPickerProps {
  value: string; // "HH:MM" 形式
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  suffix?: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function WheelColumn({ items, selectedIndex, onSelect, suffix = '' }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const lastMoveTime = useRef(0);
  const lastMoveY = useRef(0);
  const velocity = useRef(0);
  const animationRef = useRef<number | null>(null);
  const isSettling = useRef(false);

  // スクロール位置を選択項目に合わせる
  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!containerRef.current) return;
    const targetScroll = index * ITEM_HEIGHT;
    if (smooth) {
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    } else {
      containerRef.current.scrollTop = targetScroll;
    }
  }, []);

  // 初期位置設定
  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, scrollToIndex]);

  // スクロール停止後にスナップ
  const settleToNearest = useCallback(() => {
    if (!containerRef.current || isSettling.current) return;
    isSettling.current = true;
    const scrollTop = containerRef.current.scrollTop;
    const nearestIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));
    scrollToIndex(clampedIndex, true);
    if (clampedIndex !== selectedIndex) {
      onSelect(clampedIndex);
    }
    setTimeout(() => { isSettling.current = false; }, 200);
  }, [items.length, selectedIndex, onSelect, scrollToIndex]);

  // タッチ開始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startScrollTop.current = containerRef.current?.scrollTop ?? 0;
    lastMoveTime.current = Date.now();
    lastMoveY.current = e.touches[0].clientY;
    velocity.current = 0;
  }, []);

  // タッチ移動
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    e.preventDefault();
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    containerRef.current.scrollTop = startScrollTop.current + diff;

    const now = Date.now();
    const dt = now - lastMoveTime.current;
    if (dt > 0) {
      velocity.current = (lastMoveY.current - currentY) / dt;
    }
    lastMoveTime.current = now;
    lastMoveY.current = currentY;
  }, []);

  // タッチ終了 — 慣性スクロール
  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (!containerRef.current) return;

    const v = velocity.current;
    if (Math.abs(v) > 0.3) {
      // 慣性: 速度に応じて追加スクロール
      const momentum = v * 150;
      const target = containerRef.current.scrollTop + momentum;
      const nearestIndex = Math.round(target / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));
      scrollToIndex(clampedIndex, true);
      if (clampedIndex !== selectedIndex) {
        onSelect(clampedIndex);
      }
    } else {
      settleToNearest();
    }
  }, [items.length, selectedIndex, onSelect, scrollToIndex, settleToNearest]);

  // マウスホイール対応（PC）
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + direction));
    if (newIndex !== selectedIndex) {
      onSelect(newIndex);
      scrollToIndex(newIndex, true);
    }
  }, [items.length, selectedIndex, onSelect, scrollToIndex]);

  // 項目クリック
  const handleItemClick = useCallback((index: number) => {
    if (index !== selectedIndex) {
      onSelect(index);
    }
    scrollToIndex(index, true);
  }, [selectedIndex, onSelect, scrollToIndex]);

  return (
    <div className="relative" style={{ height: WHEEL_HEIGHT }}>
      {/* 選択行のハイライト */}
      <div
        className="absolute left-0 right-0 bg-[#66cc99]/10 border-y border-[#66cc99]/30 pointer-events-none z-10"
        style={{ top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT }}
      />
      {/* グラデーションマスク（上下のフェード） */}
      <div className="absolute inset-0 pointer-events-none z-20 bg-gradient-to-b from-white via-transparent to-white" style={{ backgroundSize: '100% 100%', backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.95) 100%)' }} />
      <div
        ref={containerRef}
        className="h-full overflow-hidden touch-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* 上下のパディング（2アイテム分） */}
        <div style={{ height: ITEM_HEIGHT * 2 }} />
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={index}
              className={`flex items-center justify-center cursor-pointer select-none transition-colors ${
                isSelected ? 'text-gray-900 font-bold text-lg' : 'text-gray-400 text-base'
              }`}
              style={{ height: ITEM_HEIGHT }}
              onClick={() => handleItemClick(index)}
            >
              {item}{suffix}
            </div>
          );
        })}
        <div style={{ height: ITEM_HEIGHT * 2 }} />
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

export function TimeWheelPicker({ value, onChange, label, className = '' }: TimeWheelPickerProps) {
  const [hour, minute] = value.split(':');
  const hourIndex = HOURS.indexOf(hour) >= 0 ? HOURS.indexOf(hour) : 0;
  const minuteIndex = MINUTES.indexOf(minute) >= 0 ? MINUTES.indexOf(minute) : 0;

  const [isOpen, setIsOpen] = useState(false);
  const [tempHour, setTempHour] = useState(hourIndex);
  const [tempMinute, setTempMinute] = useState(minuteIndex);

  // モーダルを開くときに現在値を同期
  const handleOpen = () => {
    setTempHour(hourIndex);
    setTempMinute(minuteIndex);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    onChange(`${HOURS[tempHour]}:${MINUTES[tempMinute]}`);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* 表示ボタン */}
      <button
        type="button"
        onClick={handleOpen}
        className={`px-4 py-3 border border-gray-300 rounded-lg bg-white text-center font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#66cc99] active:bg-gray-50 ${className}`}
      >
        {label && <span className="text-xs text-gray-500 block mb-0.5">{label}</span>}
        <span className="text-xl">{value}</span>
      </button>

      {/* ピッカーモーダル */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />
          {/* ピッカー本体 */}
          <div className="relative w-full max-w-md bg-white rounded-t-2xl pb-safe animate-slide-up">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-500 text-sm px-3 py-1"
              >
                キャンセル
              </button>
              <span className="text-sm font-medium text-gray-700">
                {label || '時刻を選択'}
              </span>
              <button
                type="button"
                onClick={handleConfirm}
                className="text-[#66cc99] font-bold text-sm px-3 py-1"
              >
                決定
              </button>
            </div>
            {/* ホイール */}
            <div className="flex items-center justify-center px-8 py-4">
              <div className="flex-1">
                <WheelColumn
                  items={HOURS}
                  selectedIndex={tempHour}
                  onSelect={setTempHour}
                />
              </div>
              <div className="text-2xl font-bold text-gray-400 mx-2">:</div>
              <div className="flex-1">
                <WheelColumn
                  items={MINUTES}
                  selectedIndex={tempMinute}
                  onSelect={setTempMinute}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TimeWheelPicker;
