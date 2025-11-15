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

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      >
        {dates.map((date, index) => {
          const formatted = formatDateForSlider(date, index);
          const isSelected = index === selectedDateIndex;
          const isToday = index === 0;

          return (
            <button
              key={index}
              onClick={() => onDateSelect(index)}
              className={`flex-shrink-0 w-16 py-2 rounded-lg text-center transition-colors ${
                isToday
                  ? 'bg-primary text-white'
                  : isSelected
                  ? 'bg-primary-light border-2 border-primary'
                  : 'bg-gray-100'
              }`}
            >
              <div className={`text-sm ${isToday ? '' : 'text-xs'}`}>
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
