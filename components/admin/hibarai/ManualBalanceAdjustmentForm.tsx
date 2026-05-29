'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, X } from 'lucide-react';
import { submitManualAdjustment } from '@/lib/actions/hibarai/manual-adjustment-action';

type Props = {
  workerId: number;
  currentBalance: number;
};

const yen = new Intl.NumberFormat('ja-JP');
const MIN_REASON = 5;

export function ManualBalanceAdjustmentForm({ workerId, currentBalance }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // 二重送信防止用の冪等キー（1件の調整につき1つ。成功後に再発行）。
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const amount = Number(amountText);
  const amountValid = Number.isInteger(amount) && amount !== 0;
  const projected = currentBalance + (amountValid ? amount : 0);
  const reasonValid = reason.trim().length >= MIN_REASON;
  const wouldGoNegative = amountValid && projected < 0;
  const canSubmit = amountValid && reasonValid && !wouldGoNegative;

  const projectedLabel = useMemo(() => `¥${yen.format(projected)}`, [projected]);

  const openConfirm = () => {
    setError(null);
    setSuccess(null);
    if (!canSubmit) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitManualAdjustment({ workerId, amount, reason, requestId });
      if (res.ok) {
        setConfirmOpen(false);
        setAmountText('');
        setReason('');
        setRequestId(crypto.randomUUID());
        setSuccess(res.applied ? `残高を調整しました（調整後 ¥${yen.format(res.balanceAfter)}）` : '既に適用済みでした');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <section className="rounded-admin-card border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Scale className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">残高の手動調整</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            残高を理由付きで補正します（増額は正、減額は負の数）。実行は監査ログに記録されます。
            調整後の残高がマイナスになる操作はできません。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[12px] font-bold text-slate-500">現在の残高</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">¥{yen.format(currentBalance)}</p>
        </div>
        <div className={`rounded-lg p-3 ${wouldGoNegative ? 'bg-red-50' : 'bg-blue-50'}`}>
          <p className="text-[12px] font-bold text-slate-500">調整後（プレビュー）</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${wouldGoNegative ? 'text-red-700' : 'text-admin-primary'}`}>
            {amountValid ? projectedLabel : '—'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <label htmlFor="adj-amount" className="mb-1 block text-[13px] font-bold text-slate-700">調整額（円・整数。減額は -）</label>
          <input
            id="adj-amount"
            type="number"
            inputMode="numeric"
            step={1}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums"
            placeholder="例: -2000"
          />
          {amountText !== '' && !amountValid && (
            <p className="mt-1 text-[12px] font-bold text-red-600">0以外の整数を入力してください</p>
          )}
          {wouldGoNegative && (
            <p className="mt-1 text-[12px] font-bold text-red-600">調整後がマイナスになるため実行できません</p>
          )}
        </div>
        <div>
          <label htmlFor="adj-reason" className="mb-1 block text-[13px] font-bold text-slate-700">理由（必須・{MIN_REASON}文字以上・監査ログに記録）</label>
          <textarea
            id="adj-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="例: 組戻不成立(HB-XXXXXX)の調査結果に基づく残高補正"
          />
        </div>
        {error && <p className="text-[13px] font-bold text-red-600">{error}</p>}
        {success && <p className="text-[13px] font-bold text-emerald-700">{success}</p>}
        <div>
          <button
            type="button"
            onClick={openConfirm}
            disabled={!canSubmit || isPending}
            className="min-h-11 rounded-admin-button bg-admin-primary px-5 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:bg-slate-300"
          >
            調整内容を確認
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="adj-confirm-title">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 id="adj-confirm-title" className="text-lg font-bold text-slate-900">残高調整の最終確認</h3>
              <button type="button" onClick={() => setConfirmOpen(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-600">対象ワーカー</dt><dd className="font-bold text-slate-900">ID:{workerId}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">調整額</dt><dd className={`font-bold tabular-nums ${amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{amount > 0 ? '+' : ''}¥{yen.format(amount)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">残高</dt><dd className="font-bold tabular-nums text-slate-900">¥{yen.format(currentBalance)} → ¥{yen.format(projected)}</dd></div>
              <div className="border-t border-slate-200 pt-2"><dt className="text-slate-600">理由</dt><dd className="mt-1 break-words text-slate-900">{reason.trim()}</dd></div>
            </dl>
            {error && <p className="mt-2 text-[13px] font-bold text-red-600">{error}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-admin-button border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                キャンセル
              </button>
              <button type="button" onClick={handleConfirm} disabled={isPending} className="min-h-11 rounded-admin-button bg-admin-primary px-4 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:bg-slate-300">
                {isPending ? '処理中…' : '実行する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
