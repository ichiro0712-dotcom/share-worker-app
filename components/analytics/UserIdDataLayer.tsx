'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { decideUserIdPush, pushUserIdentified } from '@/src/lib/ga4-events';

// GTM(GoogleTagManager.tsx) と同じく、ワーカー向けページのみを対象にする。
// 施設管理者 / システム管理者は NextAuth セッションを持たないため実害はないが、
// スコープの一貫性のため明示的に除外する。
const EXCLUDED_PATHS = ['/admin', '/system-admin'];

/**
 * GA4 User-ID 連携用コンポーネント。
 * ログイン中のワーカーを検知し、dataLayer に `user_identified` イベントを push する。
 *
 * push タイミング:
 *  ① 新規ログイン / 登録完了→自動ログイン直後（セッションが未認証→認証へ変化）
 *  ② ログイン済みユーザーのページ初回読み込み時（マウント時に認証で解決）
 *     ※ dataLayer はページ読み込みのたびにリセットされるため毎回 push が必要
 *  - 非ログイン（ゲスト）時は push しない
 *
 * AuthProvider(SessionProvider) 配下に常駐させること（useAuth を使用するため）。
 */
export function UserIdDataLayer() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  // 直近 push 済みの user_id を保持し、重複 push / SPA 遷移ごとの再送を防ぐ。
  const lastPushedId = useRef<string | null>(null);

  useEffect(() => {
    const isExcluded = EXCLUDED_PATHS.some((path) => pathname?.startsWith(path));
    const { push, nextLastPushedId } = decideUserIdPush(
      user?.id ?? null,
      lastPushedId.current,
      isLoading,
      isExcluded,
    );
    if (push && nextLastPushedId) {
      pushUserIdentified(nextLastPushedId);
    }
    lastPushedId.current = nextLastPushedId;
  }, [user?.id, isLoading, pathname]);

  return null;
}
