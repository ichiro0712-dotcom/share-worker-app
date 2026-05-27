import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';

type ReviewUnlockCardProps = {
  amount: number;
  workLabel: string;
  href?: string;
};

const yenFormatter = new Intl.NumberFormat('ja-JP');

export function ReviewUnlockCard({ amount, workLabel, href = '/mypage/reviews' }: ReviewUnlockCardProps) {
  return (
    <section className="rounded-2xl border border-teal-200 bg-money-accent-soft p-4">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-teal-600">
          <Star className="h-5 w-5 fill-current" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">
            レビューすると ¥{yenFormatter.format(amount)} 受け取れます
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{workLabel}</p>
          <Link
            href={href}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-teal-700 shadow-sm hover:bg-teal-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
          >
            30秒レビュー
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
