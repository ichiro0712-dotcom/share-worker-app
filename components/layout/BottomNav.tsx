'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bookmark, MessageSquare, Briefcase, User } from 'lucide-react';
import { useBadge } from '@/contexts/BadgeContext';

export const BottomNav = () => {
  const pathname = usePathname();
  const { unreadMessages, unreadAnnouncements, profileMissingCount } = useBadge();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // モバイルキーボードの開閉を検知してBottomNavを非表示にする
  // 条件: visualViewportが縮小 AND 編集可能な要素にフォーカスがある場合のみ
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      const activeEl = document.activeElement;
      const isEditableFocused = activeEl instanceof HTMLInputElement
        || activeEl instanceof HTMLTextAreaElement
        || activeEl instanceof HTMLSelectElement
        || (activeEl as HTMLElement)?.isContentEditable;

      const heightDiff = window.innerHeight - viewport.height;
      const isOpen = isEditableFocused && heightDiff > 120;
      setIsKeyboardOpen(isOpen);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  const messageBadge = unreadMessages + unreadAnnouncements;

  const navItems: Array<{
    href: string;
    icon: typeof Search;
    label: string;
    badge?: number;
  }> = [
      { href: '/', icon: Search, label: '探す' },
      { href: '/bookmarks', icon: Bookmark, label: '保存済み' },
      { href: '/messages', icon: MessageSquare, label: 'メッセージ', badge: messageBadge > 0 ? messageBadge : undefined },
      { href: '/my-jobs', icon: Briefcase, label: '仕事管理' },
      { href: '/mypage', icon: User, label: 'マイページ', badge: profileMissingCount > 0 ? profileMissingCount : undefined }
    ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-primary z-20 transition-transform duration-200"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        willChange: 'transform',
        transform: isKeyboardOpen ? 'translateY(100%)' : 'translateZ(0)',
      }}
    >
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-white' : 'text-white/70'
                }`}
            >
              <div className={`relative p-1.5 rounded-lg ${isActive ? 'bg-white/20' : ''}`}>
                <Icon className="w-6 h-6" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center font-bold px-0.5">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
