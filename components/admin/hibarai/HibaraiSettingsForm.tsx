'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveHibaraiSettings } from '@/lib/actions/hibarai/settings-action';
import type { HibaraiSettings } from '@/lib/actions/hibarai/settings';

export function HibaraiSettingsForm({ settings }: { settings: HibaraiSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fee, setFee] = useState(String(settings.withdrawalFeeJpy));
  const [caution, setCaution] = useState(String(settings.gmoThresholds.caution));
  const [warning, setWarning] = useState(String(settings.gmoThresholds.warning));
  const [critical, setCritical] = useState(String(settings.gmoThresholds.critical));
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const num = (s: string) => Number(s.replace(/\D/g, '') || '0');
  const feeValid = num(fee) >= 1;

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveHibaraiSettings({
        withdrawalFeeJpy: num(fee),
        gmoThresholds: { caution: num(caution), warning: num(warning), critical: num(critical) },
      });
      if (res.ok) {
        setMessage({ type: 'ok', text: '設定を保存しました' });
        router.refresh();
      } else {
        setMessage({ type: 'err', text: `保存に失敗しました: ${res.error}` });
      }
    });
  };

  const field = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div>
      <label className="mb-1 block text-[13px] font-bold text-slate-600">{label}</label>
      <input inputMode="numeric" value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
        className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums" />
      {hint && <p className="mt-1 text-[12px] text-slate-400">{hint}</p>}
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          {field('振込手数料（円・一律）', fee, setFee, '出金時に申請額から差し引く手数料（1円以上）')}
          {!feeValid && <p className="mt-1 text-[12px] font-bold text-red-600">手数料は1円以上で入力してください</p>}
        </div>
      </div>
      <p className="text-[13px] font-bold text-slate-700">GMO残高アラート閾値（残高がこの額を下回ると管理者へ通知）</p>
      <div className="grid gap-4 md:grid-cols-3">
        {field('注意（黄・円）', caution, setCaution)}
        {field('警告（橙・円）', warning, setWarning)}
        {field('危険（赤・円）', critical, setCritical)}
      </div>
      <p className="text-[12px] text-slate-400">※ 注意 ≥ 警告 ≥ 危険 の順で設定してください。</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={isPending || !feeValid}
          className="min-h-11 rounded-admin-button bg-admin-primary px-5 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:bg-slate-300">
          {isPending ? '保存中…' : '設定を保存'}
        </button>
        {message && (
          <p className={`text-[13px] font-bold ${message.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
