import { notFound } from 'next/navigation';
import { AccountEditFlow } from '@/components/money/AccountEditFlow';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { isHibaraiEnabled } from '@/lib/features';
import { workerBalance } from '@/lib/dummy-data/hibarai';

export default function EditAccountPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="受取口座の変更" backHref="/mypage/money" />
      <AccountEditFlow currentAccount={workerBalance.account} />
    </div>
  );
}
