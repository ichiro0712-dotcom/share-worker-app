'use client';

import { useEffect, useRef } from 'react';
import { trackGA4Event } from '@/src/lib/ga4-events';

function getSessionId(): string {
  const storageKey = 'reg_session_id';
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = 'reg_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

/**
 * 新規登録ページ（/register/worker）閲覧を記録するトラッカー
 * 未ログインユーザー対象。sessionStorageベースのセッションIDで管理。
 * ページ訪問のたびにPVとして記録。
 */
export default function RegistrationPageTracker() {
  const hasSent = useRef(false);

  useEffect(() => {
    if (hasSent.current) return;
    hasSent.current = true;

    try {
      const sessionId = getSessionId();
      fetch('/api/registration-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).then(() => {
        trackGA4Event('registration_page_view', { session_id: sessionId });
      }).catch(() => {});
    } catch {
      // sessionStorage unavailable (SSR等) — 無視
    }
  }, []);

  return null;
}
