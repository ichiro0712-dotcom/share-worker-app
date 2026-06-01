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
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">振込履歴</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            直近の出金申請を表示します。状態・ワーカー・金額で絞り込み、行の「詳細」でGMO送信ログを確認できます。
          </p>
        </div>
        <form
          method="get"
          action="/system-admin/hibarai/withdrawals/export"
          className="flex flex-wrap items-end gap-2 rounded-admin-card border border-slate-200 bg-white p-3 shadow-sm"
        >
          <label className="flex flex-col text-[11px] font-bold text-slate-500">
            並び順
            <select name="sort" defaultValue="requestedAt" className="mt-1 min-h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-800">
              <option value="requestedAt">申請日時</option>
              <option value="completedAt">完了日時</option>
              <option value="amount">申請額</option>
              <option value="status">ステータス</option>
              <option value="worker">ワーカーID</option>
            </select>
          </label>
          <label className="flex flex-col text-[11px] font-bold text-slate-500">
            方向
            <select name="order" defaultValue="desc" className="mt-1 min-h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-800">
              <option value="desc">降順（新しい/大きい順）</option>
              <option value="asc">昇順（古い/小さい順）</option>
            </select>
          </label>
          <label className="flex flex-col text-[11px] font-bold text-slate-500">
            ステータス
            <select name="status" defaultValue="all" className="mt-1 min-h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-800">
              <option value="all">すべて</option>
              <option value="completed">完了</option>
              <option value="processing">銀行処理中</option>
              <option value="accepted">受付済み</option>
              <option value="failed">失敗・返金</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-9 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark"
          >
            CSVエクスポート
          </button>
        </form>
      </div>
      <WithdrawalsTableClient rows={rows} summary={summary} />
    </main>
  );
}
