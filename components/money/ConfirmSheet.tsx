'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

type ConfirmRow = {
  label: string;
  value: string;
  emphasized?: boolean;
};

type ConfirmSheetProps = {
  open: boolean;
  title: string;
  description: string;
  rows: ConfirmRow[];
  confirmLabel: string;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmSheet({
  open,
  title,
  description,
  rows,
  confirmLabel,
  confirmDisabled = false,
  onClose,
  onConfirm,
}: ConfirmSheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="confirm-sheet-title">
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-slate-950/30"
        aria-label="確認シートを閉じる"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[640px] rounded-t-3xl bg-white p-5 shadow-2xl motion-safe:animate-slide-up">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="confirm-sheet-title" className="text-xl font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="rounded-2xl bg-slate-50 p-4">
          {rows.map((row) => (
            <div key={row.label} className="flex min-h-11 items-center justify-between gap-4 border-b border-slate-200 last:border-b-0">
              <dt className="text-sm text-slate-600">{row.label}</dt>
              <dd className={`${row.emphasized ? 'text-lg font-black text-slate-950' : 'text-base font-bold text-slate-900'} tabular-nums`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="min-h-14 rounded-full bg-gradient-to-r from-primary-cta to-primary-cta-dark px-5 text-base font-bold text-white shadow-primary hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full px-5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            もう一度確認する
          </button>
        </div>
      </div>
    </div>
  );
}
