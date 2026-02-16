'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { WorkerNotificationPrompt } from '@/components/pwa/WorkerNotificationPrompt';
import { PushSubscriptionSync } from '@/components/pwa/PushSubscriptionSync';
import { PWAInstallModal } from '@/components/pwa/PWAInstallModal';
import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner';
import { ProfileIncompleteBanner } from '@/components/profile/ProfileIncompleteBanner';

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
  '/auth/',  // メール認証関連ページ（verify, verify-pending, resend-verification）
  '/public/',  // SEO用公開ページ
  '/lp/',      // LP関連ページ（ウィジェット等）
  '/terms/facility',  // 施設向け利用規約ページのみ除外
];

export function WorkerLayout({ children }: WorkerLayoutProps) {
  const pathname = usePathname();

  // フッターを表示しないページかチェック
  const shouldHideFooter =
    (pathname && EXCLUDED_PATHS.includes(pathname)) ||
    EXCLUDED_PREFIXES.some(prefix => pathname?.startsWith(prefix));

  if (shouldHideFooter) {
    return <>{children}</>;
  }

  return (
    <>
      {/* PWAインストールリマインドバナー（上部固定） */}
      <PWAInstallBanner />
      {/* プロフィール未入力リマインドバナー（PWAバナーの下） */}
      <ProfileIncompleteBanner />
      <div className="pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
      <BottomNav />
      {/* PWAインストールモーダル（初回のみ） */}
      <PWAInstallModal />
      {/* プッシュ通知許可プロンプト（ログイン済みワーカーのみ） */}
      <WorkerNotificationPrompt />
      {/* プッシュ通知購読の自動同期（24時間に1回） */}
      <PushSubscriptionSync userType="worker" />
    </>
  );
}
