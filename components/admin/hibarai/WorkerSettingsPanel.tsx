'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveWorkerPolicy } from '@/lib/actions/hibarai/worker-policy-action';
import type { WorkerPolicyView } from '@/lib/actions/hibarai/policy';

type WorkerSettingsPanelProps = {
  workerId: number;
  workerName: string;
  policy: WorkerPolicyView;
};

const PROGRAM_LABEL: Record<string, string> = {
  HIBARAI: '日払い対象',
  DISABLED: '日払い対象外（停止）',
  LEGACY_CARRYBARAI: 'キャリ払い（旧）',
};

function toYen(value: number | null): string {
  return value == null ? '未設定' : `¥${value.toLocaleString()}`;
}

function numOrNull(value: string): number | null {
  const v = value.replace(/\D/g, '');
  return v === '' ? null : Number(v);
}

export function WorkerSettingsPanel({ workerId, workerName, policy }: WorkerSettingsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const current = policy.current;

  // 率は basis points(0..10000) ↔ 画面は %(0..100)
  const [ratePct, setRatePct] = useState(String(current ? current.rateBasisPoints / 100 : 90));
  const [perRequest, setPerRequest] = useState(current?.perRequestLimitAmount?.toString() ?? '');
  const [daily, setDaily] = useState(current?.dailyLimitAmount?.toString() ?? '');
  const [monthly, setMonthly] = useState(current?.monthlyLimitAmount?.toString() ?? '');
  const [isSuspended, setIsSuspended] = useState(current?.isSuspended ?? false);
  // 既存のプログラム種別を保持（LEGACY_CARRYBARAI を誤って HIBARAI に変えないため現在値で初期化）
  const [program, setProgram] = useState<'HIBARAI' | 'DISABLED' | 'LEGACY_CARRYBARAI'>(
    current?.advanceProgram === 'DISABLED'
      ? 'DISABLED'
      : current?.advanceProgram === 'LEGACY_CARRYBARAI'
        ? 'LEGACY_CARRYBARAI'
        : 'HIBARAI'
  );
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const ratePctNum = Number(ratePct);
  const rateValid = Number.isFinite(ratePctNum) && ratePctNum >= 0 && ratePctNum <= 100;
  const canSave = !!reason.trim() && rateValid && !isPending;

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveWorkerPolicy({
        workerId,
        rateBasisPoints: Math.round(ratePctNum * 100),
        perRequestLimitAmount: numOrNull(perRequest),
        dailyLimitAmount: numOrNull(daily),
        monthlyLimitAmount: numOrNull(monthly),
        isSuspended,
        advanceProgram: program,
        reason: reason.trim(),
      });
      if (res.ok) {
        setMessage({ type: 'ok', text: '前払い設定を保存しました' });
        setReason('');
        router.refresh();
      } else {
        setMessage({ type: 'err', text: `保存に失敗しました: ${res.error}` });
      }
    });
  };

  return (
    <div className="grid gap-6">
      {/* 現在の設定 */}
      <section className="rounded-admin-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">現在の設定</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['氏名', workerName],
            ['ワーカーID', String(workerId)],
            ['前払い率', current ? `${current.rateBasisPoints / 100}%` : '未設定（既定90%）'],
            ['日払いプログラム', current ? (PROGRAM_LABEL[current.advanceProgram] ?? current.advanceProgram) : '未設定'],
            ['出金停止', current?.isSuspended ? '停止中' : '通常'],
            ['1回上限', toYen(current?.perRequestLimitAmount ?? null)],
            ['日次上限', toYen(current?.dailyLimitAmount ?? null)],
            ['月次上限', toYen(current?.monthlyLimitAmount ?? null)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-[13px] font-bold text-slate-600">{label}</dt>
              <dd className="mt-1 text-base font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 設定変更 */}
      <section className="rounded-admin-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">設定を変更</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="rate" className="mb-2 block text-sm font-bold text-slate-900">前払い率（%・自由入力）</label>
            <input id="rate" inputMode="decimal" value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base tabular-nums" />
            {!rateValid && <p className="mt-1 text-[13px] font-bold text-red-600">0〜100 の範囲で入力してください</p>}
          </div>
          <div>
            <label htmlFor="program" className="mb-2 block text-sm font-bold text-slate-900">日払いプログラム</label>
            <select id="program" value={program}
              onChange={(e) => setProgram(e.target.value as 'HIBARAI' | 'DISABLED' | 'LEGACY_CARRYBARAI')}
              className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base">
              <option value="HIBARAI">日払い対象</option>
              <option value="DISABLED">日払い対象外（この人は日払い不可）</option>
              {program === 'LEGACY_CARRYBARAI' && <option value="LEGACY_CARRYBARAI">キャリ払い（旧）</option>}
            </select>
          </div>
          <div>
            <label htmlFor="perRequest" className="mb-2 block text-sm font-bold text-slate-900">1回上限（円・空=既定）</label>
            <input id="perRequest" inputMode="numeric" value={perRequest}
              onChange={(e) => setPerRequest(e.target.value.replace(/\D/g, ''))}
              className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base tabular-nums" />
          </div>
          <div>
            <label htmlFor="daily" className="mb-2 block text-sm font-bold text-slate-900">日次上限（円・空=既定）</label>
            <input id="daily" inputMode="numeric" value={daily}
              onChange={(e) => setDaily(e.target.value.replace(/\D/g, ''))}
              className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base tabular-nums" />
          </div>
          <div>
            <label htmlFor="monthly" className="mb-2 block text-sm font-bold text-slate-900">月次上限（円・空=既定）</label>
            <input id="monthly" inputMode="numeric" value={monthly}
              onChange={(e) => setMonthly(e.target.value.replace(/\D/g, ''))}
              className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base tabular-nums" />
          </div>
          <div className="flex items-center gap-3 pt-7">
            <input id="suspended" type="checkbox" checked={isSuspended}
              onChange={(e) => setIsSuspended(e.target.checked)}
              className="h-5 w-5" />
            <label htmlFor="suspended" className="text-sm font-bold text-slate-900">出金を一時停止する（チャージは継続）</label>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="reason" className="mb-2 block text-sm font-bold text-slate-900">変更理由（必須・監査ログに記録）</label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            placeholder="例: 社保対象見込みのため前払い率を70%に変更" />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={handleSave} disabled={!canSave}
            className="min-h-12 rounded-admin-button bg-admin-primary px-5 text-sm font-bold text-white hover:bg-admin-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300">
            {isPending ? '保存中…' : '変更を保存'}
          </button>
          {message && (
            <p className={`text-[13px] font-bold ${message.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
          )}
        </div>
      </section>

      {/* 変更履歴 */}
      <section className="rounded-admin-card border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">変更履歴</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {policy.history.length === 0 && (
            <p className="p-4 text-sm text-slate-500">変更履歴はありません。</p>
          )}
          {policy.history.map((item) => (
            <div key={item.id} className="grid gap-2 p-4 lg:grid-cols-[180px_120px_120px_1fr]">
              <p className="text-sm font-bold text-slate-900">
                {item.effectiveFrom.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </p>
              <p className="text-sm text-slate-700">率 {item.rateBasisPoints / 100}%</p>
              <p className="text-sm text-slate-700">
                {item.isSuspended ? '停止' : PROGRAM_LABEL[item.advanceProgram] ?? item.advanceProgram}
              </p>
              <p className="text-[13px] leading-relaxed text-slate-600">
                {item.reason}（管理者ID: {item.createdByAdminId}）
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
