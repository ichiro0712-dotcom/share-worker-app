'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Smartphone, Share, PlusSquare, MoreVertical, Download } from 'lucide-react';
import { isIOS, isStandaloneMode } from '@/lib/push-notification';

const STORAGE_KEYS = {
  MODAL_SHOWN: 'pwa_install_modal_shown',
  MODAL_DISMISSED: 'pwa_install_modal_dismissed_at',
  BANNER_ACTIVE: 'pwa_install_banner_active',
};

/**
 * Android判定
 */
function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * モバイル判定（iOS or Android）
 */
function isMobile(): boolean {
  return isIOS() || isAndroid();
}

/**
 * PWAインストールモーダル
 * 表示条件:
 * - スマートフォンからのアクセス
 * - PWA未インストール（standalone modeでない）
 * - まだモーダルを表示していない
 */
export function PWAInstallModal() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // スタンドアロンモードなら表示しない
    if (isStandaloneMode()) return;

    // モバイルでない場合は表示しない
    if (!isMobile()) return;

    // 既にモーダルを表示済みなら表示しない
    const modalShown = localStorage.getItem(STORAGE_KEYS.MODAL_SHOWN);
    if (modalShown === 'true') return;

    // デバイスタイプを判定
    if (isIOS()) {
      setDeviceType('ios');
    } else if (isAndroid()) {
      setDeviceType('android');
    }

    // 少し遅延させて表示（ページ読み込み直後は避ける）
    const timer = setTimeout(() => {
      setShow(true);
    }, 2000);

    return () => clearTimeout(timer);
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
      // Android: ネイティブインストールプロンプトを表示
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEYS.MODAL_SHOWN, 'true');
        setShow(false);
        return;
      }
    }
    // インストールプロンプトが使えない場合はモーダルで手順を表示するだけ
    // ユーザーがモーダルの手順に従ってインストールする想定
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.MODAL_SHOWN, 'true');
    localStorage.setItem(STORAGE_KEYS.MODAL_DISMISSED, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.BANNER_ACTIVE, 'true');
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* モーダル */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 animate-slide-up z-10">
        {/* 閉じるボタン */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>

        {/* アイコン */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        {/* タイトル */}
        <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
          +タスタスをホーム画面に追加
        </h2>

        {/* メリット説明 */}
        <div className="bg-indigo-50 rounded-lg p-4 mb-4">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-0.5">✓</span>
              <span>アプリのようにすぐ開ける</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-0.5">✓</span>
              <span>新着求人のお知らせが届く</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-0.5">✓</span>
              <span>フルスクリーンで快適に操作</span>
            </li>
          </ul>
        </div>

        {/* デバイス別インストール手順 */}
        {deviceType === 'ios' ? (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <p className="text-sm font-medium text-gray-800 mb-2">インストール手順（iOS）</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <Share className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">1. 共有ボタンをタップ</p>
                <p className="text-xs text-gray-500">画面下の <Share className="w-3 h-3 inline" /> をタップ</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <PlusSquare className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">2. 「ホーム画面に追加」を選択</p>
                <p className="text-xs text-gray-500">メニューをスクロールして探してください</p>
              </div>
            </div>
          </div>
        ) : deviceType === 'android' ? (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <p className="text-sm font-medium text-gray-800 mb-2">インストール手順（Android）</p>
            {deferredPrompt ? (
              <p className="text-sm text-gray-600">
                下の「ホーム画面に追加」ボタンをタップするとインストールできます。
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <MoreVertical className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">1. メニューボタンをタップ</p>
                    <p className="text-xs text-gray-500">画面右上の <MoreVertical className="w-3 h-3 inline" /> をタップ</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">2. 「アプリをインストール」を選択</p>
                    <p className="text-xs text-gray-500">または「ホーム画面に追加」を選択</p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* ボタン */}
        <div className="space-y-3">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              ホーム画面に追加
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`w-full py-3 px-4 font-medium rounded-lg transition-colors ${
              deferredPrompt
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {deferredPrompt ? 'あとで' : '閉じる'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-3">
          ホーム画面に追加するとアプリとして使えます
        </p>
      </div>
    </div>
  );
}
