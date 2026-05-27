import { Check } from 'lucide-react';

export type StepIndicatorItem = {
  label: string;
  description?: string;
  status: 'done' | 'current' | 'pending';
};

type StepIndicatorProps = {
  steps: StepIndicatorItem[];
};

export function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <ol className="grid gap-3" aria-label="進行状況">
      {steps.map((step, index) => {
        const isDone = step.status === 'done';
        const isCurrent = step.status === 'current';

        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${
                  isDone
                    ? 'border-money-accent bg-money-accent text-white'
                    : isCurrent
                      ? 'border-primary-cta bg-primary-soft text-primary-cta'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              {index < steps.length - 1 && <span className="mt-1 h-8 w-px bg-slate-200" aria-hidden="true" />}
            </div>
            <div className="min-w-0 pb-2">
              <p className="text-sm font-bold text-slate-900">{step.label}</p>
              {step.description && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{step.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
