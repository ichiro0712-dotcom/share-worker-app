import { notFound, redirect } from 'next/navigation';
import { Download } from 'lucide-react';
import { isHibaraiEnabled } from '@/lib/features';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { getJSTSettlementMonthStart } from '@/lib/actions/hibarai/utils';
import {
  getAvailableSettlementMonths,
  getSettlementReconciliation,
  parseSettlementMonthParam,
} from '@/lib/actions/hibarai/settlement-reconciliation';

export const dynamic = 'force-dynamic';

const yen = new Intl.NumberFormat('ja-JP');

export default async function HibaraiSettlementsPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const monthStart = parseSettlementMonthParam(searchParams?.month) ?? getJSTSettlementMonthStart();
  const [data, available] = await Promise.all([
    getSettlementReconciliation(monthStart),
    getAvailableSettlementMonths(),
  ]);

  // 選択中の月が一覧に無くても必ず選べるようにマージ。
  const monthOptions = available.some((m) => m.param === data.monthParam)
    ? available
    : [{ param: data.monthParam, label: data.monthLabel }, ...available];

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">給与控除リコンサイル</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            精算月ごとのワーカー別立替額（給与から控除すべき額）を集計します。
            <span className="font-bold">申請額合計＝立替総額（手数料込み）</span>、実振込額＝ワーカー口座への入金額です。
            ※控除額の確定算定式は経理確認中のため、事実値を提示します。
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col text-[11px] font-bold text-slate-500">
            精算月
            <select
              name="month"
              defaultValue={data.monthParam}
              className="mt-1 min-h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-800"
            >
              {monthOptions.map((m) => (
                <option key={m.param} value={m.param}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-9 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            表示
          </button>
          <a
            href={`/system-admin/hibarai/settlements/export?month=${data.monthParam}`}
            className="inline-flex min-h-9 items-center gap-2 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </a>
        </form>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat label="対象ワーカー数" value={`${yen.format(data.summary.workerCount)} 人`} />
        <SummaryStat label="申請額合計（立替総額）" value={`¥${yen.format(data.summary.requestedTotal)}`} highlight />
        <SummaryStat label="手数料合計" value={`¥${yen.format(data.summary.feeTotal)}`} />
        <SummaryStat label="実振込額合計" value={`¥${yen.format(data.summary.transferTotal)}`} />
      </section>

      {data.summary.inflightCount > 0 && (
        <div className="mb-4 rounded-admin-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          確定待ち（銀行処理中/受付済み）が {data.summary.inflightCount} 件・申請額 ¥
          {yen.format(data.summary.inflightRequestedTotal)} あります。確定後に金額が変わる可能性があります。
        </div>
      )}

      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">ワーカー</th>
                <th className="px-4 py-3 text-right font-bold">完了件数</th>
                <th className="px-4 py-3 text-right font-bold">申請額合計</th>
                <th className="px-4 py-3 text-right font-bold">手数料合計</th>
                <th className="px-4 py-3 text-right font-bold">実振込額合計</th>
                <th className="px-4 py-3 text-right font-bold">確定待ち</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {data.monthLabel}の出金はありません。
                  </td>
                </tr>
              )}
              {data.rows.map((r) => (
                <tr key={r.workerId} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <p className="text-base font-bold text-slate-900">{r.workerName}</p>
                    <p className="mt-1 text-[13px] text-slate-600">ID:{r.workerId}</p>
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700 tabular-nums">{yen.format(r.completedCount)}</td>
                  <td className="px-4 py-4 text-right text-base font-bold text-slate-900 tabular-nums">¥{yen.format(r.requestedTotal)}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700 tabular-nums">¥{yen.format(r.feeTotal)}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700 tabular-nums">¥{yen.format(r.transferTotal)}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-500 tabular-nums">
                    {r.inflightCount > 0 ? `${r.inflightCount}件 / ¥${yen.format(r.inflightRequestedTotal)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SummaryStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-admin-card border p-4 ${highlight ? 'border-admin-primary bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[12px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? 'text-admin-primary' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
