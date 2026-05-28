import Link from 'next/link';
import { AlertTriangle, Banknote, PauseCircle, ReceiptText, Settings, ShieldAlert } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { EmergencyStopSwitch } from '@/components/admin/hibarai/EmergencyStopSwitch';
import { ErrorQueueTable } from '@/components/admin/hibarai/ErrorQueueTable';
import { SummaryCard } from '@/components/admin/hibarai/SummaryCard';
import { getOAuthTokenStatus, revokeTokens } from '@/lib/actions/hibarai/oauth-token';
import { adminErrors, adminSummary, adminWithdrawals } from '@/lib/dummy-data/hibarai';
import { isHibaraiEnabled } from '@/lib/features';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

const yenFormatter = new Intl.NumberFormat('ja-JP');

const statusLabels = {
  completed: '完了',
  accepted: '受付済み',
  processing: '銀行処理中',
  failed: '失敗',
} as const;

export default async function HibaraiAdminDashboardPage({
  searchParams,
}: {
  searchParams?: { oauth?: string };
}) {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const recentWithdrawals = adminWithdrawals.slice(0, 5);
  const tokenStatus = await getOAuthTokenStatus();
  const accountTypeLabel = tokenStatus.accountType === 'PRIVATE' ? '個人' : tokenStatus.accountType === 'CORPORATE' ? '法人' : '-';
  const oauthMessage = searchParams?.oauth === 'success'
    ? 'GMO接続が完了しました。'
    : searchParams?.oauth
      ? 'GMO接続に失敗しました。設定を確認してください。'
      : null;

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">前払いダッシュボード</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">日払いの申請状況、エラー、停止状態を監視します。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/system-admin/hibarai/emergency-stop" className="inline-flex min-h-11 items-center gap-2 rounded-admin-button border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            緊急停止
          </Link>
          <Link href="/system-admin/hibarai/withdrawals" className="inline-flex min-h-11 items-center gap-2 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            履歴を見る
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="本日申請" value={`${adminSummary.todayRequests}件`} description="本日0:00以降の受け取り申請です。" icon={Banknote} />
        <SummaryCard title="エラー" value={`${adminSummary.errorCount}件`} description="対応が必要な出金エラーです。" icon={AlertTriangle} tone="red" />
        <SummaryCard title="停止中" value={`${adminSummary.stoppedWorkers}件`} description="個別停止中のワーカー数です。" icon={PauseCircle} tone="amber" />
        <SummaryCard title="出金額合計" value={`¥${yenFormatter.format(adminSummary.totalWithdrawn)}`} description="本日申請分の出金額合計です。" icon={ReceiptText} tone="slate" />
      </div>

      <div className="mt-6">
        <EmergencyStopSwitch />
      </div>

      <section className="mt-6 rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">GMO接続設定</h2>
            <p className="mt-1 text-[13px] text-slate-600">OAuth2トークンの接続状態を確認します。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/api/gmo/oauth/authorize" className="inline-flex min-h-11 items-center gap-2 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark">
              <Settings className="h-4 w-4" aria-hidden="true" />
              GMOに接続する
            </Link>
            <form action={revokeTokens}>
              <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                接続を解除する
              </button>
            </form>
          </div>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-4">
          <div>
            <p className="text-[12px] font-bold text-slate-500">状態</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {tokenStatus.connected ? `有効（残り${tokenStatus.daysUntilExpiry}日）` : tokenStatus.expiresAt ? '期限切れ' : '未接続'}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-500">有効期限</p>
            <p className="mt-1 text-sm text-slate-700">{tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt).toLocaleString('ja-JP') : '-'}</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-500">scope</p>
            <p className="mt-1 break-words text-sm text-slate-700">{tokenStatus.scope ?? '-'}</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-500">accountType</p>
            <p className="mt-1 text-sm text-slate-700">{accountTypeLabel}</p>
          </div>
        </div>
        {oauthMessage && (
          <div className={`border-t px-4 py-3 text-sm font-bold ${searchParams?.oauth === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
            {oauthMessage}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <ErrorQueueTable rows={adminErrors} limit={5} />

        <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">運用ショートカット</h2>
              <p className="mt-1 text-[13px] text-slate-600">よく使う管理画面へ移動します。</p>
            </div>
          </div>
          <div className="grid gap-2 p-3">
            {[
              { href: '/system-admin/hibarai/errors', label: '出金エラー対応キュー', icon: AlertTriangle },
              { href: '/system-admin/hibarai/workers/wk_1024/settings', label: 'ワーカー別前払い設定', icon: Settings },
              { href: '/system-admin/hibarai/audit-logs', label: '監査ログ', icon: ReceiptText },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <Icon className="h-4 w-4 text-admin-primary" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">最近の引き出し</h2>
            <p className="mt-1 text-[13px] text-slate-600">直近5件を表示しています。</p>
          </div>
          <Link href="/system-admin/hibarai/withdrawals" className="inline-flex min-h-11 items-center rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            すべて見る
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">ワーカー</th>
                <th className="px-4 py-3 text-right font-bold">金額</th>
                <th className="px-4 py-3 font-bold">状態</th>
                <th className="px-4 py-3 font-bold">申請時刻</th>
                <th className="px-4 py-3 font-bold">銀行</th>
              </tr>
            </thead>
            <tbody>
              {recentWithdrawals.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-sm font-bold text-slate-900">{row.id}</td>
                  <td className="px-4 py-4">
                    <p className="text-base font-bold text-slate-900">{row.workerName}</p>
                    <p className="text-[13px] text-slate-600">{row.workerId}</p>
                  </td>
                  <td className="px-4 py-4 text-right text-base font-bold text-slate-900 tabular-nums">¥{yenFormatter.format(row.amount)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{statusLabels[row.status]}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{row.requestedAt}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{row.bankName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
