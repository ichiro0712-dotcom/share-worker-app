'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletCards } from 'lucide-react';
import { AccountCard } from './AccountCard';
import { ConfirmSheet } from './ConfirmSheet';
import type { BankAccountSummary } from '@/lib/dummy-data/hibarai';

type ReceiveFormProps = {
  maxAmount: number;
  fee: number;
  account: BankAccountSummary;
};

const yenFormatter = new Intl.NumberFormat('ja-JP');

export function ReceiveForm({ maxAmount, fee, account }: ReceiveFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(maxAmount);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const transferAmount = useMemo(() => Math.max(amount - fee, 0), [amount, fee]);
  const isInvalid = amount < 1 || amount > maxAmount;

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value.replace(/[^\d]/g, ''));
    setAmount(Number.isNaN(nextValue) ? 0 : nextValue);
  };

  return (
    <>
      <main className="mx-auto min-h-screen max-w-[640px] bg-gray-50 px-4 pb-32 pt-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <label htmlFor="receive-amount" className="text-base font-bold text-slate-900">
            受け取る金額
          </label>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-primary-border bg-primary-soft/50 px-4 py-3 focus-within:border-primary-cta">
            <span className="text-3xl font-black text-slate-950">¥</span>
            <input
              id="receive-amount"
              type="text"
              inputMode="numeric"
              value={amount ? yenFormatter.format(amount) : ''}
              onChange={handleAmountChange}
              aria-label="受け取る金額"
              className="min-h-12 w-full bg-transparent text-right text-[40px] font-black leading-none text-slate-950 outline-none tabular-nums"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] leading-relaxed text-slate-600">
              1円から受け取れます。上限は ¥{yenFormatter.format(maxAmount)} です。
            </p>
            <button
              type="button"
              onClick={() => setAmount(maxAmount)}
              className="min-h-11 rounded-full border border-primary-border bg-white px-4 text-sm font-bold text-primary-cta hover:bg-primary-soft"
            >
              全額
            </button>
          </div>
          {isInvalid && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">
              1円以上、¥{yenFormatter.format(maxAmount)} 以下で入力してください。
            </p>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary-cta" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">振込予定</h2>
          </div>
          <dl className="grid gap-2">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-100">
              <dt className="text-sm text-slate-600">手数料</dt>
              <dd className="text-base font-bold text-slate-900 tabular-nums">¥{yenFormatter.format(fee)}</dd>
            </div>
            <div className="flex min-h-11 items-center justify-between">
              <dt className="text-sm font-bold text-slate-900">振込予定額</dt>
              <dd className="text-xl font-black text-slate-950 tabular-nums">¥{yenFormatter.format(transferAmount)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            手数料 ¥{yenFormatter.format(fee)} を引いて振り込みます。
          </p>
        </section>

        <div className="mt-4">
          <AccountCard account={account} readonly />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-[640px]">
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            disabled={isInvalid}
            className="min-h-14 w-full rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            受け取る
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={isSheetOpen}
        title="内容を確認してください"
        description="受取口座と金額を確認して、問題なければ受け取りを確定します。"
        rows={[
          { label: '受け取る金額', value: `¥${yenFormatter.format(amount)}` },
          { label: '手数料', value: `¥${yenFormatter.format(fee)}` },
          { label: '振込予定額', value: `¥${yenFormatter.format(transferAmount)}`, emphasized: true },
          { label: '受取口座', value: `${account.bankName} ****${account.last4}` },
        ]}
        confirmLabel="この内容で受け取る"
        onClose={() => setIsSheetOpen(false)}
        onConfirm={() => router.push('/mypage/money/receive/complete')}
      />
    </>
  );
}
