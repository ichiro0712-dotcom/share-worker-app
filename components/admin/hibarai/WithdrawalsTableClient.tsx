'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { fetchWithdrawalDetail } from '@/lib/actions/hibarai/admin-withdrawals-action';
import type {
  AdminWithdrawalRow,
  AdminWithdrawalSummary,
  AdminWithdrawalUiStatus,
  AdminWithdrawalDetail,
} from '@/lib/actions/hibarai/admin-withdrawals';

type WithdrawalsTableClientProps = {
  rows: AdminWithdrawalRow[];
  summary: AdminWithdrawalSummary;
};

type StatusFilter = 'all' | AdminWithdrawalUiStatus;

const statusLabels: Record<AdminWithdrawalUiStatus, string> = {
  completed: '完了',
  accepted: '受付済み',
  processing: '銀行処理中',
  failed: '失敗',
};

const statusClass: Record<AdminWithdrawalUiStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const yen = new Intl.NumberFormat('ja-JP');
const pageSize = 20;

export function WithdrawalsTableClient({ rows, summary }: WithdrawalsTableClientProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [workerQuery, setWorkerQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminWithdrawalDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus = status === 'all' || row.status === status;
      const q = workerQuery.trim();
      const matchesWorker = !q || row.workerName.includes(q) || String(row.workerId).includes(q);
      const min = minAmount ? Number(minAmount) : 0;
      const max = maxAmount ? Number(maxAmount) : Number.POSITIVE_INFINITY;
      const matchesAmount = row.requestedAmount >= min && row.requestedAmount <= max;
      return matchesStatus && matchesWorker && matchesAmount;
    });
  }, [maxAmount, minAmount, rows, status, workerQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleDetail = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    startTransition(async () => {
      const d = await fetchWithdrawalDetail(id);
      setDetail(d);
    });
  };

  return (
    <div className="grid gap-4">
      {/* サマリ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="件数" value={String(summary.total)} />
        <SummaryCard label="完了" value={String(summary.byStatus.completed)} />
        <SummaryCard label="処理中" value={String(summary.byStatus.processing)} />
        <SummaryCard label="失敗" value={String(summary.byStatus.failed)} />
        <SummaryCard label="申請額合計" value={`¥${yen.format(summary.totalRequestedAmount)}`} />
      </div>

      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div>
            <label className="mb-1 block text-[13px] font-bold text-slate-600">状態</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
              className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="all">すべて</option>
              <option value="completed">完了</option>
              <option value="accepted">受付済み</option>
              <option value="processing">銀行処理中</option>
              <option value="failed">失敗</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-bold text-slate-600">ワーカー（名前/ID）</label>
            <input value={workerQuery} onChange={(e) => { setWorkerQuery(e.target.value); setPage(1); }}
              className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-bold text-slate-600">金額(下限)</label>
            <input inputMode="numeric" value={minAmount} onChange={(e) => { setMinAmount(e.target.value.replace(/\D/g, '')); setPage(1); }}
              className="min-h-10 w-28 rounded-lg border border-slate-300 px-3 text-sm tabular-nums" />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-bold text-slate-600">金額(上限)</label>
            <input inputMode="numeric" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value.replace(/\D/g, '')); setPage(1); }}
              className="min-h-10 w-28 rounded-lg border border-slate-300 px-3 text-sm tabular-nums" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[13px] text-slate-600">
                <th className="p-3">申請日時</th>
                <th className="p-3">ワーカー</th>
                <th className="p-3 text-right">申請額</th>
                <th className="p-3 text-right">手数料</th>
                <th className="p-3 text-right">振込額</th>
                <th className="p-3">状態</th>
                <th className="p-3">振込先</th>
                <th className="p-3">精算月</th>
                <th className="p-3">GMO申込</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-slate-500">該当する出金がありません。</td></tr>
              )}
              {visibleRows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-slate-100">
                    <td className="p-3 whitespace-nowrap">{row.requestedAt}</td>
                    <td className="p-3">{row.workerName}<span className="ml-1 text-[12px] text-slate-400">#{row.workerId}</span></td>
                    <td className="p-3 text-right tabular-nums">¥{yen.format(row.requestedAmount)}</td>
                    <td className="p-3 text-right tabular-nums">¥{yen.format(row.feeAmount)}</td>
                    <td className="p-3 text-right tabular-nums">¥{yen.format(row.transferAmount)}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[12px] font-bold ${statusClass[row.status]}`}>
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{row.bankName}<span className="ml-1 text-[12px] text-slate-400">…{row.accountLast4}</span></td>
                    <td className="p-3 whitespace-nowrap">{row.settlementMonth}</td>
                    <td className="p-3 tabular-nums">{row.gmoApplyNo ?? '-'}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => toggleDetail(row.id)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
                        {expandedId === row.id ? '閉じる' : '詳細'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={10} className="p-4">
                        {isPending && !detail && <p className="text-[13px] text-slate-500">読み込み中…</p>}
                        {detail && detail.id === row.id && (
                          <div className="grid gap-3">
                            {row.errorMessage && <p className="text-[13px] font-bold text-red-600">エラー: {row.errorMessage}</p>}
                            <div className="text-[13px] text-slate-700">
                              GMO状態: {detail.gmoTransferStatusName ?? '-'} / 申込番号: {detail.gmoApplyNo ?? '-'}
                            </div>
                            <div>
                              <p className="mb-1 text-[13px] font-bold text-slate-600">GMO送信試行（transfer_attempts）</p>
                              {detail.attempts.length === 0 ? (
                                <p className="text-[13px] text-slate-500">送信試行はまだありません。</p>
                              ) : (
                                <table className="w-full text-[13px]">
                                  <thead><tr className="text-left text-slate-500">
                                    <th className="py-1 pr-3">#</th><th className="py-1 pr-3">日時</th>
                                    <th className="py-1 pr-3">HTTP</th><th className="py-1 pr-3">申込番号</th>
                                    <th className="py-1 pr-3">エラー</th><th className="py-1 pr-3">所要(ms)</th>
                                  </tr></thead>
                                  <tbody>
                                    {detail.attempts.map((a) => (
                                      <tr key={a.attemptNo} className="border-t border-slate-200">
                                        <td className="py-1 pr-3">{a.attemptNo}</td>
                                        <td className="py-1 pr-3 whitespace-nowrap">{a.occurredAt}</td>
                                        <td className="py-1 pr-3">{a.responseStatusCode ?? '-'}</td>
                                        <td className="py-1 pr-3">{a.gmoApplyNo ?? '-'}</td>
                                        <td className="py-1 pr-3">{a.errorCode ?? '-'}</td>
                                        <td className="py-1 pr-3">{a.durationMs ?? '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        )}
                        {!isPending && detail === null && expandedId === row.id && (
                          <p className="text-[13px] text-slate-500">詳細を取得できませんでした。</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 text-sm">
          <p className="text-slate-600">{filteredRows.length}件中 {visibleRows.length}件表示</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">前へ</button>
            <span className="tabular-nums">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">次へ</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-admin-card border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[13px] font-bold text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
