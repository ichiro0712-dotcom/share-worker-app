'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import type { AdminErrorStatus, HibaraiErrorItem } from '@/lib/dummy-data/hibarai';

type ErrorQueueTableProps = {
  rows: HibaraiErrorItem[];
  limit?: number;
  filterable?: boolean;
};

type FilterKey = 'all' | AdminErrorStatus;

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'new', label: '未対応' },
  { key: 'in_progress', label: '対応中' },
  { key: 'waiting_worker', label: 'ワーカー待ち' },
  { key: 'resolved', label: '解決済み' },
];

const statusLabel: Record<AdminErrorStatus, string> = {
  new: '未対応',
  in_progress: '対応中',
  waiting_worker: 'ワーカー待ち',
  resolved: '解決済み',
};

const statusClass: Record<AdminErrorStatus, string> = {
  new: 'bg-red-50 text-red-700 border-red-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  waiting_worker: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const yenFormatter = new Intl.NumberFormat('ja-JP');

export function ErrorQueueTable({ rows, limit, filterable = false }: ErrorQueueTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedRow, setSelectedRow] = useState<HibaraiErrorItem | null>(null);

  const visibleRows = useMemo(() => {
    const filteredRows = filter === 'all' ? rows : rows.filter((row) => row.status === filter);
    return typeof limit === 'number' ? filteredRows.slice(0, limit) : filteredRows;
  }, [filter, limit, rows]);

  return (
    <>
      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">エラー対応キュー</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">口座確認が必要な出金を優先度順に表示します。</p>
          </div>
          {!filterable && (
            <Link href="/system-admin/hibarai/errors" className="inline-flex min-h-11 items-center justify-center rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              すべて見る
            </Link>
          )}
        </div>

        {filterable && (
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
            {filters.map((item) => {
              const isActive = item.key === filter;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`min-h-11 flex-shrink-0 rounded-full border px-4 text-sm font-bold ${
                    isActive ? 'border-admin-primary bg-blue-50 text-admin-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  aria-pressed={isActive}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">ワーカー</th>
                <th className="px-4 py-3 font-bold">エラー種別</th>
                <th className="px-4 py-3 text-right font-bold">金額</th>
                <th className="px-4 py-3 font-bold">発生時刻</th>
                <th className="px-4 py-3 font-bold">ステータス</th>
                <th className="px-4 py-3 text-right font-bold">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <p className="text-base font-bold text-slate-900">{row.workerName}</p>
                    <p className="mt-1 text-[13px] text-slate-600">{row.workerId}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{row.errorType}</td>
                  <td className="px-4 py-4 text-right text-base font-bold text-slate-900 tabular-nums">¥{yenFormatter.format(row.amount)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{row.occurredAt}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[13px] font-bold ${statusClass[row.status]}`}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      className="min-h-11 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark"
                    >
                      対応する
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="error-modal-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="error-modal-title" className="text-lg font-bold text-slate-900">個別対応</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">送金結果の生レスポンスは表示せず、内部コードだけを確認します。</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-5 grid gap-2 rounded-lg bg-slate-50 p-4">
              {[
                ['ワーカー', `${selectedRow.workerName}（${selectedRow.workerId}）`],
                ['エラー種別', selectedRow.errorType],
                ['金額', `¥${yenFormatter.format(selectedRow.amount)}`],
                ['発生時刻', selectedRow.occurredAt],
                ['サポートコード', selectedRow.supportCode],
              ].map(([label, value]) => (
                <div key={label} className="flex min-h-10 justify-between gap-4 border-b border-slate-200 last:border-b-0">
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="text-right text-sm font-bold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button type="button" className="min-h-11 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark">
                再処理
              </button>
              <button type="button" className="min-h-11 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                保留
              </button>
              <button type="button" className="min-h-11 rounded-admin-button border border-emerald-300 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                完了扱い
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
