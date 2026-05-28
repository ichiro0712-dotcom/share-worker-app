'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { triggerStopAction, releaseStopAction } from '@/lib/actions/hibarai/emergency-stop-action';

type EmergencyStopSwitchProps = {
  initialStopped?: boolean;
  compact?: boolean;
};

export function EmergencyStopSwitch({ initialStopped = false, compact = false }: EmergencyStopSwitchProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isStopped = initialStopped;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'stop' | 'resume'>('stop');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openConfirm = (action: 'stop' | 'resume') => {
    setPendingAction(action);
    setReason('');
    setError(null);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = pendingAction === 'stop' ? await triggerStopAction(reason) : await releaseStopAction(reason);
      if (res.ok) {
        setIsConfirmOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
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
                {isStopped ? '全ワーカーの日払いは停止中です。' : '異常検知時に全ワーカーの日払いを一括停止できます。'}
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
              {isStopped ? '再開する' : '緊急停止する'}
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
                  {pendingAction === 'stop' ? '日払いを緊急停止しますか？' : '緊急停止を解除しますか？'}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                  {pendingAction === 'stop'
                    ? '停止すると全ワーカーが受け取り操作をできなくなります。'
                    : '解除すると全ワーカーが再び受け取りできるようになります。'}
                </p>
              </div>
              <button type="button" onClick={() => setIsConfirmOpen(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4">
              <label htmlFor="stop-reason" className="mb-1 block text-[13px] font-bold text-slate-700">理由（必須・監査ログに記録）</label>
              <textarea id="stop-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={pendingAction === 'stop' ? '例: GMOからの不正検知のため' : '例: 原因解消を確認したため'} />
            </div>
            {error && <p className="mt-2 text-[13px] font-bold text-red-600">{error}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="min-h-11 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || !reason.trim()}
                className={`min-h-11 rounded-admin-button px-4 text-sm font-bold text-white disabled:bg-slate-300 ${pendingAction === 'stop' ? 'bg-red-700 hover:bg-red-800' : 'bg-admin-primary hover:bg-admin-primary-dark'}`}
              >
                {isPending ? '処理中…' : pendingAction === 'stop' ? '停止する' : '解除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
