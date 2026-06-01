'use client';

import { useMemo, useState } from 'react';
import { HistoryItem } from './HistoryItem';
import type { WorkerHistoryItem } from '@/lib/dummy-data/hibarai';

type FilterKey = 'all' | 'completed' | 'accepted' | 'failed';

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'completed', label: '受取済' },
  { key: 'accepted', label: '申請中' },
  { key: 'failed', label: 'エラー' },
];

const statusMap: Record<Exclude<FilterKey, 'all'>, WorkerHistoryItem['status'][]> = {
  completed: ['completed'],
  accepted: ['accepted', 'processing'],
  failed: ['failed'],
};

type HistoryFilterListProps = {
  items: WorkerHistoryItem[];
};

export function HistoryFilterList({ items }: HistoryFilterListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => statusMap[activeFilter].includes(item.status));
  }, [activeFilter, items]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`min-h-11 flex-shrink-0 rounded-full border px-4 text-sm font-bold ${
                isActive
                  ? 'border-primary-cta bg-primary-soft text-primary-cta'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              aria-pressed={isActive}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredItems.length > 0 ? (
        <div>
          {filteredItems.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              href={item.status === 'failed' ? `/mypage/money/withdrawals/${item.id}/error` : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="p-6 text-center text-[13px] leading-relaxed text-slate-600">表示できる履歴はありません。</p>
      )}
    </section>
  );
}
