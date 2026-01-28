'use client';

import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';

/**
 * オフライン時に画面上部に表示される警告バナー
 *
 * - オンライン時は何も表示しない
 * - オフライン時は画面上部に固定表示
 * - z-index: 9998 で他の要素より前面に表示
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500 text-white px-4 py-2 shadow-md"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-2 max-w-screen-xl mx-auto">
        <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">
          インターネットに接続されていません
        </span>
      </div>
    </div>
  );
}
