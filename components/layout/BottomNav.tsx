'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, MessageSquare, Clipboard, User } from 'lucide-react';

export const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Search, label: '探す' },
    { href: '/under-construction?page=favorites', icon: Heart, label: 'お気に入り' },
    { href: '/under-construction?page=messages', icon: MessageSquare, label: 'メッセージ', badge: 3 },
    { href: '/under-construction?page=jobs', icon: Clipboard, label: '仕事管理' },
    { href: '/under-construction?page=mypage', icon: User, label: 'マイページ' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 relative ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
              {item.badge && (
                <span className="absolute top-0 right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
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
