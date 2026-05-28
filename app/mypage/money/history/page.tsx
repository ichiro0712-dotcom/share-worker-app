import { notFound } from 'next/navigation';
import { HistoryFilterList } from '@/components/money/HistoryFilterList';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { isHibaraiEnabled } from '@/lib/features';
import { getAuthenticatedUser } from '@/src/lib/actions/helpers';
import { getWorkerHistory } from '@/lib/actions/hibarai/balance';

export const dynamic = 'force-dynamic';

export default async function MoneyHistoryPage() {
  if (!isHibaraiEnabled()) notFound();

  const user = await getAuthenticatedUser();
  const items = await getWorkerHistory(user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="履歴" backHref="/mypage/money" />
      <main className="mx-auto max-w-[640px] px-4 py-4">
        <HistoryFilterList items={items} />
      </main>
    </div>
  );
}
