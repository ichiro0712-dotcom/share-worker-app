import Link from 'next/link';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { isHibaraiEnabled } from '@/lib/features';

type WithdrawalErrorPageProps = {
  params: {
    id: string;
  };
};

export default function WithdrawalErrorPage({ params }: WithdrawalErrorPageProps) {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="確認が必要です" backHref="/mypage/money" />
      <main className="mx-auto max-w-[640px] px-4 py-6">
        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-card">
          <div className="flex gap-4">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">口座を確認できませんでした</h1>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                受取口座の番号や名義が、銀行側の情報と合わなかった可能性があります。
                お手元の通帳やアプリで確認して、受取口座を直してください。
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="text-base font-bold text-slate-900">よくある原因</h2>
          <div className="mt-3 grid gap-3">
            {[
              '口座番号の桁ちがい',
              '支店名または支店コードの選びまちがい',
              '名義カナの表記ゆれ',
              '口座が解約・停止されている',
            ].map((reason) => (
              <p key={reason} className="rounded-xl bg-slate-50 px-3 py-3 text-[13px] leading-relaxed text-slate-600">
                {reason}
              </p>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">管理番号: {params.id}</p>
        </section>

        <div className="mt-5 grid gap-3">
          <Link
            href="/mypage/money/account/edit"
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary"
          >
            受取口座を直す
          </Link>
          <Link
            href="/mypage/money/breakdown"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            ヘルプを見る
          </Link>
        </div>
      </main>
    </div>
  );
}
