'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, PlayCircle, Square } from 'lucide-react';
import { triggerStopAction, releaseStopAction } from '@/lib/actions/hibarai/emergency-stop-action';
import type { EmergencyStopHistoryItem } from '@/lib/actions/hibarai/emergency-stop';

type EmergencyStopControlPanelProps = {
  initialStopped: boolean;
  history: EmergencyStopHistoryItem[];
};

const actionLabel: Record<string, string> = {
  EMERGENCY_STOP_TRIGGERED: '緊急停止',
  EMERGENCY_STOP_RELEASED: '解除',
};

export function EmergencyStopControlPanel({ initialStopped, history }: EmergencyStopControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isStopped = initialStopped;
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handle = (action: 'stop' | 'resume') => {
    setError(null);
    if (!reason.trim()) {
      setError('理由を入力してください');
      return;
    }
    startTransition(async () => {
      const res = action === 'stop' ? await triggerStopAction(reason) : await releaseStopAction(reason);
      if (res.ok) {
        setReason('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
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
            <p className="mt-1 text-[13px] text-slate-600">
              {isStopped ? '全ワーカーの日払い受け取りを停止中です。' : '日払いは正常に稼働しています。'}
            </p>
          </div>
          <span className={`flex h-14 w-14 items-center justify-center rounded-xl ${isStopped ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {isStopped ? <AlertTriangle className="h-7 w-7" /> : <PlayCircle className="h-7 w-7" />}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          <label htmlFor="es-reason" className="text-sm font-bold text-slate-900">理由（必須・監査ログに記録）</label>
          <textarea id="es-reason" value={reason} onChange={(e) => setReason(e.target.value)}
            className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={isStopped ? '例: 原因解消を確認したため解除' : '例: GMOからの不正検知のため停止'} />
          {error && <p className="text-[13px] font-bold text-red-600">{error}</p>}
          <div>
            {isStopped ? (
              <button type="button" onClick={() => handle('resume')} disabled={isPending || !reason.trim()}
                className="inline-flex min-h-12 items-center gap-2 rounded-admin-button bg-admin-primary px-5 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:bg-slate-300">
                <PlayCircle className="h-4 w-4" />{isPending ? '処理中…' : '緊急停止を解除する'}
              </button>
            ) : (
              <button type="button" onClick={() => handle('stop')} disabled={isPending || !reason.trim()}
                className="inline-flex min-h-12 items-center gap-2 rounded-admin-button bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:bg-slate-300">
                <Square className="h-4 w-4" />{isPending ? '処理中…' : '全ワーカーを緊急停止する'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">操作履歴</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {history.length === 0 && <p className="p-4 text-sm text-slate-500">操作履歴はありません。</p>}
          {history.map((item, i) => (
            <div key={i} className="grid gap-2 p-4 lg:grid-cols-[200px_120px_140px_1fr]">
              <p className="text-sm font-bold text-slate-900">{item.at.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
              <p className={`text-sm font-bold ${item.action === 'EMERGENCY_STOP_TRIGGERED' ? 'text-red-700' : 'text-emerald-700'}`}>
                {actionLabel[item.action] ?? item.action}
              </p>
              <p className="text-sm text-slate-700">管理者ID: {item.actorId ?? '-'}</p>
              <p className="text-[13px] leading-relaxed text-slate-600">{item.reason ?? '-'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
