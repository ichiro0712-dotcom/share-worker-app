'use client';

import { useMemo, useState } from 'react';
import type { AdminWithdrawalItem, WithdrawalStatus } from '@/lib/dummy-data/hibarai';

type WithdrawalsTableClientProps = {
  rows: AdminWithdrawalItem[];
};

type StatusFilter = 'all' | WithdrawalStatus;

const statusLabels: Record<WithdrawalStatus, string> = {
  completed: '完了',
  accepted: '受付済み',
  processing: '銀行処理中',
  failed: '失敗',
};

const statusClass: Record<WithdrawalStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const yenFormatter = new Intl.NumberFormat('ja-JP');
const pageSize = 5;

export function WithdrawalsTableClient({ rows }: WithdrawalsTableClientProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [workerQuery, setWorkerQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus = status === 'all' || row.status === status;
      const matchesWorker = !workerQuery || row.workerName.includes(workerQuery) || row.workerId.includes(workerQuery);
      const min = minAmount ? Number(minAmount) : 0;
      const max = maxAmount ? Number(maxAmount) : Number.POSITIVE_INFINITY;
      const matchesAmount = row.amount >= min && row.amount <= max;
      return matchesStatus && matchesWorker && matchesAmount;
    });
  }, [maxAmount, minAmount, rows, status, workerQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCsvExport = () => {
    window.alert('CSV出力を開始しました（ダミー）');
  };

  return (
    <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">引き出し履歴</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">検索・フィルタは画面内ダミーで動作します。</p>
          </div>
          <button
            type="button"
            onClick={handleCsvExport}
            className="min-h-11 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark"
          >
            CSV出力
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[160px_1fr_130px_130px]">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            aria-label="状態で絞り込み"
          >
            <option value="all">すべて</option>
            <option value="completed">完了</option>
            <option value="accepted">受付済み</option>
            <option value="processing">銀行処理中</option>
            <option value="failed">失敗</option>
          </select>
          <input
            value={workerQuery}
            onChange={(event) => {
              setWorkerQuery(event.target.value);
              setPage(1);
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="ワーカー名・ID"
          />
          <input
            value={minAmount}
            onChange={(event) => setMinAmount(event.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm tabular-nums"
            placeholder="最小金額"
          />
          <input
            value={maxAmount}
            onChange={(event) => setMaxAmount(event.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm tabular-nums"
            placeholder="最大金額"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 font-bold">ID</th>
              <th className="px-4 py-3 font-bold">ワーカー</th>
              <th className="px-4 py-3 text-right font-bold">金額</th>
              <th className="px-4 py-3 text-right font-bold">手数料</th>
              <th className="px-4 py-3 font-bold">状態</th>
              <th className="px-4 py-3 font-bold">申請時刻</th>
              <th className="px-4 py-3 font-bold">完了時刻</th>
              <th className="px-4 py-3 font-bold">銀行</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-4 text-sm font-bold text-slate-900">{row.id}</td>
                <td className="px-4 py-4">
                  <p className="text-base font-bold text-slate-900">{row.workerName}</p>
                  <p className="text-[13px] text-slate-600">{row.workerId}</p>
                </td>
                <td className="px-4 py-4 text-right text-base font-bold text-slate-900 tabular-nums">¥{yenFormatter.format(row.amount)}</td>
                <td className="px-4 py-4 text-right text-sm text-slate-700 tabular-nums">¥{yenFormatter.format(row.fee)}</td>
                <td className="px-4 py-4">
                  <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[13px] font-bold ${statusClass[row.status]}`}>
                    {statusLabels[row.status]}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">{row.requestedAt}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{row.completedAt}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{row.bankName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 p-4">
        <p className="text-[13px] text-slate-600">
          {filteredRows.length}件中 {visibleRows.length}件を表示
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="min-h-11 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            前へ
          </button>
          <span className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-slate-700 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage === totalPages}
            className="min-h-11 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      </div>
    </section>
  );
}
