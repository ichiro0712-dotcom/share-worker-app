'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';

interface WorkerLayoutProps {
  children: React.ReactNode;
}

// フッターメニューを表示しないページのパス
const EXCLUDED_PATHS = [
  '/login',
  '/register',
  '/password-reset',
  '/admin',
  '/system-admin',
  '/application-complete',
];

// 部分一致で除外するパスのプレフィックス
const EXCLUDED_PREFIXES = [
  '/admin/',
  '/system-admin/',
  '/register/',
  '/password-reset/',
  '/public/',  // SEO用公開ページ
];

export function WorkerLayout({ children }: WorkerLayoutProps) {
  const pathname = usePathname();

  // フッターを表示しないページかチェック
  const shouldHideFooter =
    EXCLUDED_PATHS.includes(pathname) ||
    EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix));

  if (shouldHideFooter) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
      <BottomNav />
    </>
  );
}
