'use client';

import { useState } from 'react';
import { AlertTriangle, PlayCircle, Square } from 'lucide-react';

type StopHistoryItem = {
  date: string;
  actor: string;
  action: string;
  reason: string;
};

type EmergencyStopControlPanelProps = {
  history: StopHistoryItem[];
};

export function EmergencyStopControlPanel({ history }: EmergencyStopControlPanelProps) {
  const [isStopped, setIsStopped] = useState(false);
  const [confirmStage, setConfirmStage] = useState<0 | 1 | 2>(0);
  const [nextAction, setNextAction] = useState<'stop' | 'resume'>('stop');

  const startAction = (action: 'stop' | 'resume') => {
    setNextAction(action);
    setConfirmStage(1);
  };

  const completeAction = () => {
    setIsStopped(nextAction === 'stop' ? true : false);
    setConfirmStage(0);
  };

  return (
    <div className="grid gap-6">
      <section className={`rounded-admin-card border p-6 shadow-sm ${isStopped ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-white'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-600">現在の状態</p>
            <h2 className={`mt-2 text-3xl font-black ${isStopped ? 'text-red-700' : 'text-emerald-700'}`}>
              {isStopped ? '停止中' : '稼働中'}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              停止は単独可、解除は二者承認の想定です。このUIプロトタイプではダミーで状態を切り替えます。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => startAction('stop')}
              disabled={isStopped}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-admin-button bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              停止する
            </button>
            <button
              type="button"
              onClick={() => startAction('resume')}
              disabled={!isStopped}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-admin-button bg-admin-primary px-5 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              再開する
            </button>
          </div>
        </div>

        {confirmStage > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  {confirmStage === 1 ? '内容を確認してください' : '最終確認です'}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                  {nextAction === 'stop'
                    ? '全ワーカーの受け取り操作が止まります。必要な関係者に連絡済みか確認してください。'
                    : '本番では別の管理者の承認後に再開します。プロトタイプではこの操作で再開します。'}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmStage(0)}
                    className="min-h-11 rounded-admin-button border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    キャンセル
                  </button>
                  {confirmStage === 1 ? (
                    <button
                      type="button"
                      onClick={() => setConfirmStage(2)}
                      className="min-h-11 rounded-admin-button bg-amber-700 px-4 text-sm font-bold text-white hover:bg-amber-800"
                    >
                      次の確認へ
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeAction}
                      className={`min-h-11 rounded-admin-button px-4 text-sm font-bold text-white ${nextAction === 'stop' ? 'bg-red-700 hover:bg-red-800' : 'bg-admin-primary hover:bg-admin-primary-dark'}`}
                    >
                      {nextAction === 'stop' ? '緊急停止を確定' : '再開を確定'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">停止履歴</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {history.map((item) => (
            <div key={`${item.date}-${item.action}`} className="grid gap-2 p-4 lg:grid-cols-[180px_120px_180px_1fr]">
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
