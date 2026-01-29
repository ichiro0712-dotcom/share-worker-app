'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { mutate } from 'swr';

interface NetworkStatusContextType {
  /** 現在オンラインかどうか */
  isOnline: boolean;
  /** オフラインから復帰した直後かどうか */
  wasOffline: boolean;
  /** wasOffline フラグをクリアする */
  clearWasOffline: () => void;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined);

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // 初期状態を設定
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      console.log('[NetworkStatus] Online');
      setIsOnline(true);
      setWasOffline(true);

      // オンライン復帰時にSWRの全キャッシュを再検証
      // mutate(() => true) は全てのキーにマッチ
      mutate(
        () => true,
        undefined,
        { revalidate: true }
      );
    };

    const handleOffline = () => {
      console.log('[NetworkStatus] Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ isOnline, wasOffline, clearWasOffline }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

/**
 * ネットワーク状態を取得するフック
 * @example
 * const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
 * if (!isOnline) {
 *   return <div>オフラインです</div>;
 * }
 */
export function useNetworkStatus(): NetworkStatusContextType {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
}
