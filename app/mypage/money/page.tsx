import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { AccountCard } from '@/components/money/AccountCard';
import { BalanceCard } from '@/components/money/BalanceCard';
import { HistoryItem } from '@/components/money/HistoryItem';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { ReviewUnlockCard } from '@/components/money/ReviewUnlockCard';
import { isHibaraiEnabled } from '@/lib/features';
import { getAuthenticatedUser } from '@/src/lib/actions/helpers';
import { getMoneyHomeData } from '@/lib/actions/hibarai/balance';

export const dynamic = 'force-dynamic';

export default async function MoneyHomePage() {
  if (!isHibaraiEnabled()) notFound();

  const user = await getAuthenticatedUser();
  const data = await getMoneyHomeData(user.id);
  const latestHistory = data.history.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="日払い" />
      <main className="mx-auto max-w-[640px] px-4 pb-10 pt-4">
        <BalanceCard
          availableAmount={data.availableAmount}
          deadlineText={data.deadlineText}
          scheduledPaymentAmount={data.scheduledPaymentAmount}
          scheduledPaymentDate={data.scheduledPaymentDate}
        />

        {data.reviewUnlockAmount > 0 && (
          <div className="mt-4">
            <ReviewUnlockCard
              amount={data.reviewUnlockAmount}
              workLabel="レビュー提出で受け取れます"
            />
          </div>
        )}

        <div className="mt-4">
          <AccountCard account={data.bankAccount} />
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
          {latestHistory.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">まだ履歴はありません。</p>
          )}
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
