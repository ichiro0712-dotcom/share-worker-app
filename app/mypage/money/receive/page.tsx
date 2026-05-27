import { notFound } from 'next/navigation';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { ReceiveForm } from '@/components/money/ReceiveForm';
import { isHibaraiEnabled } from '@/lib/features';
import { workerBalance } from '@/lib/dummy-data/hibarai';

export default function ReceivePage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="受け取る" backHref="/mypage/money" />
      <ReceiveForm maxAmount={workerBalance.availableAmount} fee={workerBalance.fee} account={workerBalance.account} />
    </div>
  );
}
