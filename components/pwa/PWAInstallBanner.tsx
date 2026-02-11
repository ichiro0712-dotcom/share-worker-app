'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Smartphone } from 'lucide-react';
import { isStandaloneMode } from '@/lib/push-notification';

const STORAGE_KEYS = {
  MODAL_SHOWN: 'pwa_install_modal_shown',
  BANNER_ACTIVE: 'pwa_install_banner_active',
  BANNER_DISMISSED: 'pwa_install_banner_dismissed_at',
  BANNER_NEVER_SHOW: 'pwa_install_banner_never_show',
};

// 「閉じる」後24時間で再表示
const DISMISS_HOURS = 24;
// モーダル表示から7日後にバナー自動非表示
const AUTO_HIDE_DAYS = 7;

/**
 * PWAインストールリマインドバナー
 * 表示条件:
 * - モーダルで「あとで」を選択した
 * - PWA未インストール
 * - 閉じてから24時間経過
 * - モーダル表示から7日以内
 */
export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // スタンドアロンモードなら表示しない
    if (isStandaloneMode()) return;

    // バナーが有効でない場合は表示しない
    const bannerActive = localStorage.getItem(STORAGE_KEYS.BANNER_ACTIVE);
    if (bannerActive !== 'true') return;

    // 「今後表示しない」を選択済みの場合
    const neverShow = localStorage.getItem(STORAGE_KEYS.BANNER_NEVER_SHOW);
    if (neverShow === 'true') return;

    // モーダル表示から7日経過したら自動非表示
    const modalShownAt = localStorage.getItem('pwa_install_modal_dismissed_at');
    if (modalShownAt) {
      const daysSinceModal = (Date.now() - new Date(modalShownAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModal >= AUTO_HIDE_DAYS) {
        localStorage.setItem(STORAGE_KEYS.BANNER_ACTIVE, 'false');
        return;
      }
    }

    // 閉じてから24時間以内は再表示しない
    const dismissedAt = localStorage.getItem(STORAGE_KEYS.BANNER_DISMISSED);
    if (dismissedAt) {
      const hoursSinceDismissed = (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceDismissed < DISMISS_HOURS) return;
    }

    setShow(true);
  }, []);

  // Android の beforeinstallprompt イベント
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEYS.BANNER_ACTIVE, 'false');
        setShow(false);
      }
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.BANNER_DISMISSED, new Date().toISOString());
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Smartphone className="w-4 h-4 shrink-0" />
        <span className="truncate">+タスタスをホーム画面に追加しよう</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {deferredPrompt && (
          <button
            onClick={handleInstall}
            className="px-3 py-1 bg-white text-indigo-600 font-medium rounded text-xs hover:bg-indigo-50 transition-colors"
          >
            追加
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-indigo-500 rounded transition-colors"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
