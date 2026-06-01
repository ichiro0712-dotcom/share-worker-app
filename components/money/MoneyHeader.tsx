import Link from 'next/link';
import { ArrowLeft, HelpCircle } from 'lucide-react';

type MoneyHeaderProps = {
  title: string;
  backHref?: string;
  helpHref?: string;
};

export function MoneyHeader({ title, backHref, helpHref = '/mypage/money/breakdown' }: MoneyHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[640px] items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="戻る"
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
          <h1 className="truncate text-lg font-bold text-slate-900">{title}</h1>
        </div>
        <Link
          href={helpHref}
          aria-label="ヘルプを見る"
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue-200"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
