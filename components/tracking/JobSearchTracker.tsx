'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * 認証済みユーザーの求人検索ページ（トップページ）閲覧を記録するトラッカー
 * 1セッション（ブラウザタブ）あたり1回のみ記録
 */
export default function JobSearchTracker() {
  const { data: session } = useSession();
  const tracked = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || tracked.current) return;
    tracked.current = true;

    fetch('/api/job-search-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // トラッキング失敗は無視
    });
  }, [session?.user?.id]);

  return null;
}
