'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { trackGA4Event } from '@/src/lib/ga4-events';

/**
 * 認証済みユーザーの求人検索ページ（トップページ）閲覧をPVとして記録するトラッカー
 * コンポーネントマウントごとに1回記録（ページ遷移で再マウントされるため実質PV記録）
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
    }).then(() => {
      trackGA4Event('job_search_view');
    }).catch(() => {
      // トラッキング失敗は無視
    });
  }, [session?.user?.id]);

  return null;
}
