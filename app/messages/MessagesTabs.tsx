'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function MessagesTabs() {
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') === 'notifications' ? 'notifications' : 'messages';

  return (
    <div className="flex border-t border-gray-200">
      <Link
        href="/messages"
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
          activeTab === 'messages'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        メッセージ
      </Link>
      <Link
        href="/messages?tab=notifications"
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
          activeTab === 'notifications'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        お知らせ
      </Link>
    </div>
  );
}
