'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import BankSelector from '@/components/ui/BankSelector';
import BranchSelector from '@/components/ui/BranchSelector';
import { NameWithKanaInput } from '@/components/ui/NameWithKanaInput';
import { SmsVerification } from '@/components/ui/SmsVerification';
import { StepIndicator } from './StepIndicator';

type BankValue = { code: string; name: string } | null;
type BranchValue = { code: string; name: string } | null;

const initialBank = { code: '0001', name: 'みずほ銀行' };
const initialBranch = { code: '210', name: '渋谷支店' };

export function AccountRegistrationFlow() {
  const [step, setStep] = useState<'input' | 'confirm' | 'complete'>('input');
  const [bank, setBank] = useState<BankValue>(initialBank);
  const [branch, setBranch] = useState<BranchValue>(initialBranch);
  const [accountNumber, setAccountNumber] = useState('1234567');
  const [holderName, setHolderName] = useState('高橋 美咲');
  const [holderKana, setHolderKana] = useState('タカハシ ミサキ');
  const [phoneNumber, setPhoneNumber] = useState('09012345678');
  const [verificationToken, setVerificationToken] = useState('dummy-verified');

  const steps = [
    { label: '口座入力', status: step === 'input' ? 'current' : 'done' },
    { label: '確認', status: step === 'confirm' ? 'current' : step === 'complete' ? 'done' : 'pending' },
    { label: '完了', status: step === 'complete' ? 'current' : 'pending' },
  ] as const;

  const canConfirm = Boolean(bank && branch && accountNumber.length >= 7 && holderName && holderKana && verificationToken);

  if (step === 'complete') {
    return (
      <main className="mx-auto min-h-screen max-w-[640px] bg-gray-50 px-4 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-16 w-16 text-money-accent" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">受取口座を登録しました</h2>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
            これで日払いの受け取りに使えます。口座情報は末尾4桁だけ表示します。
          </p>
          <Link
            href="/mypage/money"
            className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary"
          >
            日払いに戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[640px] bg-gray-50 px-4 pb-10 pt-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <StepIndicator steps={steps.map((item) => ({ label: item.label, status: item.status }))} />
      </section>

      {step === 'input' ? (
        <section className="mt-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900">銀行</label>
            <BankSelector value={bank} onChange={setBank} required showErrors={false} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900">支店</label>
            <BranchSelector bankCode={bank?.code ?? null} value={branch} onChange={setBranch} required showErrors={false} />
          </div>
          <div>
            <label htmlFor="account-number" className="mb-2 block text-sm font-bold text-slate-900">
              口座番号
            </label>
            <input
              id="account-number"
              inputMode="numeric"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 8))}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base tabular-nums"
              placeholder="1234567"
            />
          </div>
          <div>
            <label htmlFor="holder-name" className="mb-2 block text-sm font-bold text-slate-900">
              口座名義
            </label>
            <NameWithKanaInput
              value={holderName}
              onChange={setHolderName}
              kanaValue={holderKana}
              onKanaChange={setHolderKana}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
              placeholder="山田 花子"
            />
          </div>
          <div>
            <label htmlFor="holder-kana" className="mb-2 block text-sm font-bold text-slate-900">
              口座名義（カナ）
            </label>
            <input
              id="holder-kana"
              value={holderKana}
              onChange={(event) => setHolderKana(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
              placeholder="ヤマダ ハナコ"
            />
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
            <p className="mb-3 text-[13px] font-bold text-blue-800">本人確認</p>
            <SmsVerification
              phoneNumber={phoneNumber}
              onPhoneNumberChange={setPhoneNumber}
              onVerified={setVerificationToken}
              initialVerified
              inputClassName="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
            />
          </div>
          <button
            type="button"
            onClick={() => setStep('confirm')}
            disabled={!canConfirm}
            className="min-h-14 w-full rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            確認へ進む
          </button>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="text-lg font-bold text-slate-900">登録内容の確認</h2>
          <dl className="mt-4 grid gap-2">
            {[
              ['銀行', bank?.name ?? '-'],
              ['支店', branch?.name ?? '-'],
              ['口座番号', `****${accountNumber.slice(-4)}`],
              ['口座名義', holderName],
              ['カナ', holderKana],
            ].map(([label, value]) => (
              <div key={label} className="flex min-h-11 items-center justify-between gap-4 border-b border-slate-100">
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="text-right text-base font-bold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => setStep('complete')}
              className="min-h-14 rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary"
            >
              登録する
            </button>
            <button type="button" onClick={() => setStep('input')} className="min-h-11 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100">
              入力に戻る
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
