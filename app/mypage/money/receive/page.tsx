import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { ReceiveForm } from '@/components/money/ReceiveForm';
import { isHibaraiEnabled } from '@/lib/features';
import { getAuthenticatedUser } from '@/src/lib/actions/helpers';
import { getMoneyHomeData } from '@/lib/actions/hibarai/balance';

export const dynamic = 'force-dynamic';

export default async function ReceivePage() {
  if (!isHibaraiEnabled()) notFound();

  const user = await getAuthenticatedUser();
  const moneyHomeData = await getMoneyHomeData(user.id);
  const requestHeaders = headers();
  const clientIp = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? requestHeaders.get('x-real-ip')
    ?? '0.0.0.0';
  const userAgent = requestHeaders.get('user-agent') ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="受け取る" backHref="/mypage/money" />
      <ReceiveForm
        maxAmount={moneyHomeData.availableAmount}
        fee={moneyHomeData.fee}
        account={moneyHomeData.bankAccount}
        bankAccountId={moneyHomeData.bankAccount?.id ?? null}
        clientIp={clientIp}
        initialUserAgent={userAgent}
      />
    </div>
  );
}
