import Link from 'next/link';
import { Building2, ChevronRight, ShieldCheck } from 'lucide-react';
import type { BankAccountSummary } from '@/lib/dummy-data/hibarai';

type AccountCardProps = {
  account: BankAccountSummary;
  href?: string;
  actionLabel?: string;
  readonly?: boolean;
};

const statusLabels: Record<BankAccountSummary['status'], string> = {
  verified: '登録済み',
  cooldown: '変更後の確認中です',
  blocked: 'この口座では受け取れません',
  unregistered: '受取口座を登録してください',
};

export function AccountCard({
  account,
  href = '/mypage/money/account/edit',
  actionLabel = '変更',
  readonly = false,
}: AccountCardProps) {
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">受取口座</p>
          <p className="mt-1 truncate text-base font-bold text-slate-900">
            {account.bankName} ****{account.last4}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            {account.branchName}・{statusLabels[account.status]}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1 text-sm font-bold text-primary-cta">
        {readonly ? (
          <ShieldCheck className="h-5 w-5 text-money-accent" aria-label="確認済み" />
        ) : (
          <>
            {actionLabel}
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </>
        )}
      </div>
    </>
  );

  if (readonly) {
    return <section className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">{body}</section>;
  }

  return (
    <Link
      href={href}
      className="flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card hover:bg-slate-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
    >
      {body}
    </Link>
  );
}
