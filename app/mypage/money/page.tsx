import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { AccountCard } from '@/components/money/AccountCard';
import { BalanceCard } from '@/components/money/BalanceCard';
import { HistoryItem } from '@/components/money/HistoryItem';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { ReviewUnlockCard } from '@/components/money/ReviewUnlockCard';
import { isHibaraiEnabled } from '@/lib/features';
import { workerBalance, workerHistory } from '@/lib/dummy-data/hibarai';

export default function MoneyHomePage() {
  if (!isHibaraiEnabled()) notFound();

  const latestHistory = workerHistory.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="日払い" />
      <main className="mx-auto max-w-[640px] px-4 pb-10 pt-4">
        <BalanceCard
          availableAmount={workerBalance.availableAmount}
          deadlineText={workerBalance.deadlineText}
          scheduledPaymentAmount={workerBalance.scheduledPaymentAmount}
          scheduledPaymentDate={workerBalance.scheduledPaymentDate}
        />

        <div className="mt-4">
          <ReviewUnlockCard
            amount={workerBalance.reviewUnlockAmount}
            workLabel="さくらケアセンター 5月26日（火）勤務分"
          />
        </div>

        <Link
          href="/mypage/money/withdrawals/wd_002/error"
          className="mt-4 flex min-h-[76px] items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 hover:bg-red-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">口座を確認できませんでした</p>
            <p className="mt-1 text-[13px] leading-relaxed text-red-700">受取口座を直すと、もう一度受け取りできます。</p>
          </div>
          <ChevronRight className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        </Link>

        <div className="mt-4">
          <AccountCard account={workerBalance.account} />
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex min-h-14 items-center justify-between border-b border-slate-100 px-4">
            <h2 className="text-base font-bold text-slate-900">履歴</h2>
            <Link
              href="/mypage/money/history"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary-cta"
            >
              すべて見る
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {latestHistory.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              href={item.status === 'failed' ? `/mypage/money/withdrawals/${item.id}/error` : undefined}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
