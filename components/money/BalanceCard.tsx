import Link from 'next/link';
import { Banknote, ChevronRight } from 'lucide-react';

type BalanceCardProps = {
  availableAmount: number;
  deadlineText: string;
  paydayAmount?: number;
  paydayDate?: string;
  href?: string;
  compact?: boolean;
};

const yenFormatter = new Intl.NumberFormat('ja-JP');

export function BalanceCard({
  availableAmount,
  deadlineText,
  paydayAmount,
  paydayDate,
  href = '/mypage/money/receive',
  compact = false,
}: BalanceCardProps) {
  return (
    <section className={`rounded-2xl border border-primary-border bg-white shadow-card ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-600">今すぐ受け取れる金額</p>
          <p
            className={`${compact ? 'text-3xl' : 'text-[44px]'} mt-2 font-black leading-none tracking-normal text-slate-950 tabular-nums`}
            aria-label={`${yenFormatter.format(availableAmount)}円`}
          >
            ¥{yenFormatter.format(availableAmount)}
          </p>
        </div>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-cta">
          <Banknote className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{deadlineText}</p>

      {paydayAmount !== undefined && paydayDate && (
        <Link
          href="/mypage/money/breakdown"
          className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-slate-50 px-3 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
        >
          <span>給与日に入る金額</span>
          <span className="font-bold tabular-nums">
            ¥{yenFormatter.format(paydayAmount)}
            <span className="ml-2 text-[13px] font-medium text-slate-600">{paydayDate}</span>
          </span>
        </Link>
      )}

      <Link
        href={href}
        className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary transition hover:brightness-105 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
      >
        受け取る
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </Link>
    </section>
  );
}
