import type { LucideIcon } from 'lucide-react';

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: 'blue' | 'red' | 'amber' | 'slate';
};

const toneStyles: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  blue: 'bg-blue-50 text-admin-primary',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-700',
};

export function SummaryCard({ title, value, description, icon: Icon, tone = 'blue' }: SummaryCardProps) {
  return (
    <section className="rounded-admin-card border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneStyles[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{description}</p>
    </section>
  );
}
