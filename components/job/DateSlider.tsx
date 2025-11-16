'use client';

import { useRef } from 'react';
import { generateDates, formatDateForSlider } from '@/utils/date';

interface DateSliderProps {
  selectedDateIndex: number;
  onDateSelect: (index: number) => void;
}

export const DateSlider: React.FC<DateSliderProps> = ({
  selectedDateIndex,
  onDateSelect
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dates = generateDates(90);

  const handleTodayClick = () => {
    onDateSelect(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative flex gap-2">
      {/* 今日ボタン（固定） */}
      <button
        onClick={handleTodayClick}
        className="flex-shrink-0 w-16 py-2 rounded-lg text-center bg-primary text-white"
      >
        <div className="text-sm">今日</div>
      </button>

      {/* スライダー */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1"
      >
        {dates.slice(1).map((date, index) => {
          const actualIndex = index + 1;
          const formatted = formatDateForSlider(date, actualIndex);
          const isSelected = actualIndex === selectedDateIndex;

          return (
            <button
              key={actualIndex}
              onClick={() => onDateSelect(actualIndex)}
              className={`flex-shrink-0 w-16 py-2 rounded-lg text-center transition-colors ${
                isSelected
                  ? 'bg-primary-light border-2 border-primary'
                  : 'bg-gray-100'
              }`}
            >
              <div className="text-xs">
                {formatted.main}
              </div>
              {formatted.sub && (
                <div className="text-xs text-gray-600">{formatted.sub}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
