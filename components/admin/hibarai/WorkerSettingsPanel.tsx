'use client';

import { useState } from 'react';
import type { workerSettings } from '@/lib/dummy-data/hibarai';

type WorkerSettings = typeof workerSettings;

type WorkerSettingsPanelProps = {
  settings: WorkerSettings;
};

const presets = [
  { key: 'normal', label: '通常90%', rate: 90, stopped: false },
  { key: 'careful', label: '控えめ70%', rate: 70, stopped: false },
  { key: 'stopped', label: '停止', rate: 0, stopped: true },
] as const;

export function WorkerSettingsPanel({ settings }: WorkerSettingsPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<(typeof presets)[number]['key']>('normal');
  const [limit, setLimit] = useState(String(settings.currentLimit));
  const [reason, setReason] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const handleSave = () => {
    setSavedMessage('変更内容を保存しました（ダミー）');
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-admin-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">ワーカー情報</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ['氏名', settings.name],
            ['ワーカーID', settings.workerId],
            ['電話番号', settings.phone],
            ['現在の状態', settings.status],
            ['現在の前払い率', `${settings.currentRate}%`],
            ['現在の上限金額', `¥${settings.currentLimit.toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-[13px] font-bold text-slate-600">{label}</dt>
              <dd className="mt-1 text-base font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-admin-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">前払い設定</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {presets.map((preset) => {
            const isActive = selectedPreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setSelectedPreset(preset.key)}
                className={`min-h-16 rounded-lg border px-4 text-left ${
                  isActive ? 'border-admin-primary bg-blue-50 text-admin-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                aria-pressed={isActive}
              >
                <span className="block text-base font-bold">{preset.label}</span>
                <span className="mt-1 block text-[13px] text-slate-600">{preset.stopped ? '受け取りを停止します' : `受け取り上限を${preset.rate}%にします`}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="worker-limit" className="mb-2 block text-sm font-bold text-slate-900">
              上限金額
            </label>
            <input
              id="worker-limit"
              inputMode="numeric"
              value={limit}
              onChange={(event) => setLimit(event.target.value.replace(/\D/g, ''))}
              className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="change-reason" className="mb-2 block text-sm font-bold text-slate-900">
              変更理由メモ（必須）
            </label>
            <textarea
              id="change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              placeholder="例: 本人確認完了のため"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={!reason.trim()}
            className="min-h-12 rounded-admin-button bg-admin-primary px-5 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            変更を保存
          </button>
          {savedMessage && <p className="text-[13px] font-bold text-emerald-700">{savedMessage}</p>}
        </div>
      </section>

      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">変更履歴</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {settings.history.map((item) => (
            <div key={`${item.date}-${item.action}`} className="grid gap-2 p-4 lg:grid-cols-[170px_180px_160px_1fr]">
              <p className="text-sm font-bold text-slate-900">{item.date}</p>
              <p className="text-sm text-slate-700">{item.action}</p>
              <p className="text-sm text-slate-700">{item.actor}</p>
              <p className="text-[13px] leading-relaxed text-slate-600">{item.reason}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
