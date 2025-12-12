'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bookmark, MessageSquare, Briefcase, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { getWorkerFooterBadges } from '@/src/lib/actions';

export const BottomNav = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [badges, setBadges] = useState({
    unreadMessages: 0,
    unreadAnnouncements: 0,
  });

  const fetchBadges = useCallback(async () => {
    if (session?.user?.id) {
      const userId = parseInt(session.user.id, 10);
      const data = await getWorkerFooterBadges(userId);
      setBadges(data);
    }
  }, [session?.user?.id]);

  // 初回とパス変更時にバッジを取得
  useEffect(() => {
    fetchBadges();
  }, [fetchBadges, pathname]);

  // 30秒ごとに自動更新
  useEffect(() => {
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  const messageBadge = badges.unreadMessages + badges.unreadAnnouncements;

  const navItems: Array<{
    href: string;
    icon: typeof Search;
    label: string;
    badge?: number;
  }> = [
      { href: '/', icon: Search, label: '探す' },
      { href: '/bookmarks', icon: Bookmark, label: '保存済み' },
      { href: '/messages', icon: MessageSquare, label: 'メッセージ', badge: messageBadge },
      { href: '/my-jobs', icon: Briefcase, label: '仕事管理' },
      { href: '/mypage', icon: User, label: 'マイページ' }
    ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-primary z-10">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 relative ${isActive ? 'text-white' : 'text-white/70'
                }`}
            >
              <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : ''}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 right-0 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
