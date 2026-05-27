'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

type EmergencyStopSwitchProps = {
  initialStopped?: boolean;
  compact?: boolean;
};

export function EmergencyStopSwitch({ initialStopped = false, compact = false }: EmergencyStopSwitchProps) {
  const [isStopped, setIsStopped] = useState(initialStopped);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'stop' | 'resume'>('stop');

  const openConfirm = (action: 'stop' | 'resume') => {
    setPendingAction(action);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    setIsStopped(pendingAction === 'stop');
    setIsConfirmOpen(false);
  };

  return (
    <>
      <section className={`rounded-admin-card border ${isStopped ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} p-5 shadow-sm`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${isStopped ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-admin-primary'}`}>
              {isStopped ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">緊急停止スイッチ</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {isStopped ? '全ワーカーの日払いは停止中です。解除は二者承認が必要な想定です。' : '異常検知時に全ワーカーの日払いを一括停止できます。'}
              </p>
            </div>
          </div>
          <div className={`flex ${compact ? 'flex-col' : 'flex-col sm:flex-row'} gap-3`}>
            <span className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-bold ${isStopped ? 'border-red-300 bg-white text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              現在: {isStopped ? '停止中' : '稼働中'}
            </span>
            <button
              type="button"
              onClick={() => openConfirm(isStopped ? 'resume' : 'stop')}
              className={`min-h-11 rounded-admin-button px-4 text-sm font-bold text-white shadow-sm ${
                isStopped ? 'bg-admin-primary hover:bg-admin-primary-dark' : 'bg-red-700 hover:bg-red-800'
              }`}
            >
              {isStopped ? '再開を申請' : '緊急停止する'}
            </button>
          </div>
        </div>
      </section>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="emergency-confirm-title">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="emergency-confirm-title" className="text-lg font-bold text-slate-900">
                  {pendingAction === 'stop' ? '日払いを緊急停止しますか？' : '再開申請を作成しますか？'}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                  {pendingAction === 'stop'
                    ? '停止すると全ワーカーが受け取り操作をできなくなります。'
                    : 'UIプロトタイプではダミーで再開状態にします。本番では二者承認が必要です。'}
                </p>
              </div>
              <button type="button" onClick={() => setIsConfirmOpen(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="min-h-11 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`min-h-11 rounded-admin-button px-4 text-sm font-bold text-white ${pendingAction === 'stop' ? 'bg-red-700 hover:bg-red-800' : 'bg-admin-primary hover:bg-admin-primary-dark'}`}
              >
                {pendingAction === 'stop' ? '停止する' : '再開する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
