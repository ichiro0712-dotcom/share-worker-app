import { notFound } from 'next/navigation';
import { AccountRegistrationFlow } from '@/components/money/AccountRegistrationFlow';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { isHibaraiEnabled } from '@/lib/features';

export default function NewAccountPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="受取口座の登録" backHref="/mypage/money" />
      <AccountRegistrationFlow />
    </div>
  );
}
