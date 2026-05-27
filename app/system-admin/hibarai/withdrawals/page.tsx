import { notFound } from 'next/navigation';
import { WithdrawalsTableClient } from '@/components/admin/hibarai/WithdrawalsTableClient';
import { adminWithdrawals } from '@/lib/dummy-data/hibarai';
import { isHibaraiEnabled } from '@/lib/features';

export default function HibaraiWithdrawalsPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">引き出し履歴・CSV出力</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">期間、ワーカー、状態、金額レンジで絞り込みます。CSV出力はダミーです。</p>
      </div>
      <WithdrawalsTableClient rows={adminWithdrawals} />
    </main>
  );
}
