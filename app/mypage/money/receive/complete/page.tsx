import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { StepIndicator } from '@/components/money/StepIndicator';
import { isHibaraiEnabled } from '@/lib/features';

export default function ReceiveCompletePage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="受け取り完了" backHref="/mypage/money" />
      <main className="mx-auto max-w-[640px] px-4 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-16 w-16 text-money-accent motion-safe:animate-pulse" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">受け取り申請を受け付けました</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
            銀行で確認でき次第、受取口座へ振り込みます。
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <StepIndicator
            steps={[
              { label: '申請受付', description: '受け取り申請できました', status: 'done' },
              { label: '銀行確認中', description: '銀行で確認でき次第、振り込みます', status: 'current' },
              { label: '振込完了', description: '完了すると履歴に表示されます', status: 'pending' },
            ]}
          />
        </section>

        <div className="mt-5 grid gap-3">
          <Link
            href="/mypage/money/history"
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary"
          >
            履歴を見る
          </Link>
          <Link
            href="/mypage/money"
            className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            閉じる
          </Link>
        </div>
      </main>
    </div>
  );
}
