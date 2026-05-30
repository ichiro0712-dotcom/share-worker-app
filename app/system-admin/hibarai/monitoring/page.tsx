import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { isHibaraiEnabled } from '@/lib/features';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { getMonitoringSummary } from '@/lib/actions/hibarai/monitoring';

export const dynamic = 'force-dynamic';

const yen = new Intl.NumberFormat('ja-JP');

function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}分`;
  if (hours < 24) return `${hours.toFixed(1)}時間`;
  return `${(hours / 24).toFixed(1)}日`;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

export default async function HibaraiMonitoringPage() {
  if (!isHibaraiEnabled()) notFound();
  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const data = await getMonitoringSummary();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">日払い 運用監視</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          PROCESSING滞留（銀行処理中／未送信）の年齢分布、組戻不成立(26)累計、GMO応答不明の直近頻度を可視化します。
          要対応の早期検知用です。
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat title="組戻不成立(26) 累計" value={`${data.recallFailedCount}件`} icon={ShieldAlert} tone={data.recallFailedCount > 0 ? 'red' : 'slate'} hint="資金がワーカー側に残り要手動対応" />
        <Stat title="GMO応答不明 (直近24h)" value={`${data.submitUnknownLast24h}件`} icon={AlertTriangle} tone={data.submitUnknownLast24h > 0 ? 'amber' : 'slate'} hint="多発時はGMO/構成異常のサイン" />
        <Stat title="PROCESSING 合計" value={`${data.processing.total}件`} icon={Clock} tone={data.processing.total > 0 ? 'blue' : 'slate'} hint="銀行処理中 + 未送信(処理待ち)" />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <BucketCard
          title="銀行処理中（GMO受理済み）"
          subtitle="applyNo発行済み・銀行で振込処理中。長期滞留は照会要"
          total={data.processing.withApplyNo.total}
          buckets={data.processing.withApplyNo.buckets}
        />
        <BucketCard
          title="未送信（処理待ち・入金待ち）"
          subtitle="GMO未送信。残高不足時はここが増える（自動再送で解消）"
          total={data.processing.withoutApplyNo.total}
          buckets={data.processing.withoutApplyNo.buckets}
        />
      </section>

      <section className="mt-6 rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">古い順 上位（要調査の候補）</h2>
          <p className="mt-1 text-[13px] text-slate-600">最も滞留しているPROCESSINGを最大10件表示します。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">ワーカー</th>
                <th className="px-4 py-3 text-right font-bold">申請額</th>
                <th className="px-4 py-3 font-bold">申請日時</th>
                <th className="px-4 py-3 text-right font-bold">経過</th>
                <th className="px-4 py-3 font-bold">applyNo</th>
                <th className="px-4 py-3 font-bold">GMO状態</th>
                <th className="px-4 py-3 font-bold">最終照会</th>
              </tr>
            </thead>
            <tbody>
              {data.processing.oldest.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">PROCESSINGはありません。</td>
                </tr>
              )}
              {data.processing.oldest.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">{r.workerName}</p>
                    <p className="text-[12px] text-slate-500">ID:{r.workerId}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums">¥{yen.format(r.requestedAmount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmtDateTime(r.requestedAt)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${r.ageHours > 24 ? 'text-red-700' : r.ageHours > 6 ? 'text-amber-700' : 'text-slate-700'}`}>{fmtAge(r.ageHours)}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-slate-600">{r.gmoApplyNo ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.gmoStatusCode != null ? `${r.gmoStatusCode}:${r.gmoStatusName ?? ''}` : '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{fmtDateTime(r.lastPolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-[12px] text-slate-500">生成: {fmtDateTime(data.generatedAt)}</p>
    </main>
  );
}

function Stat({ title, value, icon: Icon, tone, hint }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: 'slate' | 'amber' | 'red' | 'blue'; hint?: string }) {
  const toneCls =
    tone === 'red' ? 'border-red-300 bg-red-50'
    : tone === 'amber' ? 'border-amber-300 bg-amber-50'
    : tone === 'blue' ? 'border-blue-200 bg-blue-50'
    : 'border-slate-200 bg-white';
  const valueCls =
    tone === 'red' ? 'text-red-700'
    : tone === 'amber' ? 'text-amber-700'
    : tone === 'blue' ? 'text-admin-primary'
    : 'text-slate-900';
  return (
    <div className={`rounded-admin-card border p-4 ${toneCls}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${valueCls}`} aria-hidden="true" />
        <p className="text-[12px] font-bold text-slate-600">{title}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-slate-500">{hint}</p>}
    </div>
  );
}

function BucketCard({ title, subtitle, total, buckets }: { title: string; subtitle: string; total: number; buckets: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-admin-card border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-slate-900">{total}件</span>
      </div>
      <table className="mt-3 w-full text-left">
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label} className="border-t border-slate-100">
              <td className="py-2 text-sm text-slate-600">{b.label}</td>
              <td className={`py-2 text-right text-sm font-bold tabular-nums ${b.label === '24時間超' && b.count > 0 ? 'text-red-700' : 'text-slate-900'}`}>{b.count}件</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
