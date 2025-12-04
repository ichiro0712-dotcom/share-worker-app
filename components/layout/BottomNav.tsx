'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bookmark, MessageSquare, Briefcase, User } from 'lucide-react';

export const BottomNav = () => {
  const pathname = usePathname();

  const navItems: Array<{
    href: string;
    icon: typeof Search;
    label: string;
    badge?: number;
  }> = [
      { href: '/', icon: Search, label: '探す' },
      { href: '/bookmarks', icon: Bookmark, label: '保存済み' },
      { href: '/messages', icon: MessageSquare, label: 'メッセージ' },
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
              {item.badge && (
                <span className="absolute top-0 right-2 bg-white text-primary text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
