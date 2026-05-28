import { notFound, redirect } from 'next/navigation';
import { WithdrawalsTableClient } from '@/components/admin/hibarai/WithdrawalsTableClient';
import { isHibaraiEnabled } from '@/lib/features';
import { getAdminWithdrawals } from '@/lib/actions/hibarai/admin-withdrawals';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export default async function HibaraiWithdrawalsPage() {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const { rows, summary } = await getAdminWithdrawals();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">振込履歴</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          直近の出金申請を表示します。状態・ワーカー・金額で絞り込み、行の「詳細」でGMO送信ログを確認できます。
        </p>
      </div>
      <WithdrawalsTableClient rows={rows} summary={summary} />
    </main>
  );
}
