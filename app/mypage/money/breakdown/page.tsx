import { BookOpen, ChevronDown } from 'lucide-react';
import { notFound } from 'next/navigation';
import { MoneyHeader } from '@/components/money/MoneyHeader';
import { isHibaraiEnabled } from '@/lib/features';
import { balanceBreakdownRows, glossaryItems, hibaraiFaqItems } from '@/lib/dummy-data/hibarai';

const yenFormatter = new Intl.NumberFormat('ja-JP');

export default function MoneyBreakdownPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <MoneyHeader title="内訳・FAQ" backHref="/mypage/money" />
      <main className="mx-auto max-w-[640px] px-4 py-4">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 p-4">
            <h1 className="text-lg font-bold text-slate-900">残高内訳</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">表示金額はダミーデータです。実装時はサーバー側で再計算します。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">項目</th>
                  <th className="px-4 py-3 text-right font-bold">金額</th>
                  <th className="px-4 py-3 font-bold">説明</th>
                </tr>
              </thead>
              <tbody>
                {balanceBreakdownRows.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-base font-bold text-slate-900">{row.label}</td>
                    <td className={`px-4 py-4 text-right text-base font-black tabular-nums ${row.amount >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                      {row.amount >= 0 ? '' : '-'}¥{yenFormatter.format(Math.abs(row.amount))}
                    </td>
                    <td className="px-4 py-4 text-[13px] leading-relaxed text-slate-600">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <BookOpen className="h-5 w-5 text-primary-cta" aria-hidden="true" />
            もっと知る
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {hibaraiFaqItems.map((item) => (
              <details key={item.question} className="group py-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-bold text-slate-900">
                  {item.question}
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-3 text-[13px] leading-relaxed text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="text-lg font-bold text-slate-900">用語集</h2>
          <dl className="mt-3 grid gap-3">
            {glossaryItems.map((item) => (
              <div key={item.term} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-base font-bold text-slate-900">{item.term}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-slate-600">{item.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
