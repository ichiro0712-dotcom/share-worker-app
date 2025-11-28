'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ClipboardList, Star, Bell } from 'lucide-react';

export const AdminBottomNav = () => {
  const pathname = usePathname();

  const navItems: Array<{
    href: string;
    icon: typeof LayoutDashboard;
    label: string;
    badge?: number;
  }> = [
    { href: '/admin', icon: LayoutDashboard, label: 'ダッシュボード' },
    { href: '/admin/applications', icon: ClipboardList, label: '応募管理' },
    { href: '/admin/workers', icon: Users, label: 'ワーカー' },
    { href: '/admin/reviews', icon: Star, label: 'レビュー' },
    { href: '/admin/notifications', icon: Bell, label: '通知' },
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
