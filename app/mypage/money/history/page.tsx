import { notFound } from 'next/navigation';
import { HistoryFilterList } from '@/components/money/HistoryFilterList';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { isHibaraiEnabled } from '@/lib/features';
import { workerHistory } from '@/lib/dummy-data/hibarai';

export default function MoneyHistoryPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="履歴" backHref="/mypage/money" />
      <main className="mx-auto max-w-[640px] px-4 py-4">
        <HistoryFilterList items={workerHistory} />
      </main>
    </div>
  );
}
