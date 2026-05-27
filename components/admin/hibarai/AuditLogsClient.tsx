'use client';

import { useMemo, useState } from 'react';
import type { AuditLogItem } from '@/lib/dummy-data/hibarai';

type AuditLogsClientProps = {
  rows: AuditLogItem[];
};

type AuditFilter = 'all' | AuditLogItem['type'];

const filters: Array<{ key: AuditFilter; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'withdrawal', label: '出金' },
  { key: 'account', label: '口座' },
  { key: 'policy', label: '設定' },
  { key: 'emergency', label: '停止' },
  { key: 'auth', label: '認証' },
];

const resultClass: Record<AuditLogItem['result'], string> = {
  成功: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  失敗: 'bg-red-50 text-red-700 border-red-200',
  承認待ち: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function AuditLogsClient({ rows }: AuditLogsClientProps) {
  const [filter, setFilter] = useState<AuditFilter>('all');

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((row) => row.type === filter);
  }, [filter, rows]);

  return (
    <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-lg font-bold text-slate-900">監査ログ</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">送金・口座・設定・停止操作の履歴を確認します。</p>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
        {filters.map((item) => {
          const isActive = filter === item.key;
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 font-bold">タイムスタンプ</th>
              <th className="px-4 py-3 font-bold">actor</th>
              <th className="px-4 py-3 font-bold">action</th>
              <th className="px-4 py-3 font-bold">対象</th>
              <th className="px-4 py-3 font-bold">IP</th>
              <th className="px-4 py-3 font-bold">結果</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-4 text-sm font-bold text-slate-900">{row.timestamp}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{row.actor}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{row.action}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{row.target}</td>
                <td className="px-4 py-4 text-sm text-slate-700 tabular-nums">{row.ipAddress}</td>
                <td className="px-4 py-4">
                  <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[13px] font-bold ${resultClass[row.result]}`}>
                    {row.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
