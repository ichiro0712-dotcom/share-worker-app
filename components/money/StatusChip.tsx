import type { WorkerHistoryStatus } from '@/lib/dummy-data/hibarai';

type StatusChipProps = {
  status: WorkerHistoryStatus | 'error' | 'stopped' | 'active' | 'waiting';
  label?: string;
};

const chipStyles: Record<StatusChipProps['status'], string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  charged: 'bg-money-accent-soft text-teal-700 border-teal-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  stopped: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  waiting: 'bg-amber-50 text-amber-700 border-amber-200',
};

const defaultLabels: Record<StatusChipProps['status'], string> = {
  completed: '振込完了',
  charged: 'チャージ',
  accepted: '申請中',
  processing: '銀行確認中',
  failed: '確認が必要',
  error: 'エラー',
  stopped: '停止中',
  active: '稼働中',
  waiting: '対応中',
};

export function StatusChip({ status, label }: StatusChipProps) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-[13px] font-semibold leading-none ${chipStyles[status]}`}>
      {label ?? defaultLabels[status]}
    </span>
  );
}
