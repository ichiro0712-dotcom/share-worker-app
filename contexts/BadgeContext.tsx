'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { getWorkerFooterBadges, getMissingProfileFields } from '@/src/lib/actions';

interface BadgeContextType {
  unreadMessages: number;
  unreadAnnouncements: number;
  profileMissingCount: number;
  refreshBadges: () => Promise<void>;
  decrementMessages: (count?: number) => void;
  decrementAnnouncements: (count?: number) => void;
  clearMessages: () => void;
  clearAnnouncements: () => void;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [profileMissingCount, setProfileMissingCount] = useState(0);

  const refreshBadges = useCallback(async () => {
    if (session?.user?.id) {
      try {
        const userId = parseInt(session.user.id, 10);
        const [data, profileData] = await Promise.all([
          getWorkerFooterBadges(userId),
          getMissingProfileFields(),
        ]);
        if (data) {
          setUnreadMessages(data.unreadMessages ?? 0);
          setUnreadAnnouncements(data.unreadAnnouncements ?? 0);
        }
        setProfileMissingCount(profileData.missingCount);
      } catch (error) {
        console.error('[BadgeContext] Failed to refresh badges:', error);
      }
    }
  }, [session?.user?.id]);

  // 初回ロード
  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  // 30秒ごとに自動更新
  useEffect(() => {
    const interval = setInterval(refreshBadges, 30000);
    return () => clearInterval(interval);
  }, [refreshBadges]);

  const decrementMessages = useCallback((count = 1) => {
    setUnreadMessages(prev => Math.max(0, prev - count));
  }, []);

  const decrementAnnouncements = useCallback((count = 1) => {
    setUnreadAnnouncements(prev => Math.max(0, prev - count));
  }, []);

  const clearMessages = useCallback(() => {
    setUnreadMessages(0);
  }, []);

  const clearAnnouncements = useCallback(() => {
    setUnreadAnnouncements(0);
  }, []);

  return (
    <BadgeContext.Provider
      value={{
        unreadMessages,
        unreadAnnouncements,
        profileMissingCount,
        refreshBadges,
        decrementMessages,
        decrementAnnouncements,
        clearMessages,
        clearAnnouncements,
      }}
    >
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadge() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadge must be used within a BadgeProvider');
  }
  return context;
}
