import Link from 'next/link';
import { AlertTriangle, ArrowDownToLine, Banknote, CircleDollarSign } from 'lucide-react';
import type { WorkerHistoryItem } from '@/lib/dummy-data/hibarai';
import { StatusChip } from './StatusChip';

type HistoryItemProps = {
  item: WorkerHistoryItem;
  href?: string;
};

const yenFormatter = new Intl.NumberFormat('ja-JP');

const iconMap = {
  completed: ArrowDownToLine,
  charged: CircleDollarSign,
  accepted: Banknote,
  processing: Banknote,
  failed: AlertTriangle,
};

export function HistoryItem({ item, href }: HistoryItemProps) {
  const Icon = iconMap[item.status];
  const amountPrefix = item.amount > 0 ? '+' : '-';
  const amount = Math.abs(item.amount);
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            item.status === 'failed' ? 'bg-red-50 text-red-600' : item.status === 'charged' ? 'bg-money-accent-soft text-teal-700' : 'bg-slate-100 text-slate-700'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-slate-900">{item.title}</p>
            <StatusChip status={item.status} />
          </div>
          <p className="mt-1 text-[13px] text-slate-600">{item.date}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{item.note}</p>
        </div>
      </div>
      <p className={`flex-shrink-0 text-base font-black tabular-nums ${item.amount > 0 ? 'text-teal-700' : 'text-slate-900'}`}>
        {amountPrefix}¥{yenFormatter.format(amount)}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex min-h-[88px] items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 hover:bg-slate-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex min-h-[88px] items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">{content}</div>;
}
