import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import NotificationSettingsClient from './NotificationSettingsClient';

export const metadata = {
  title: '通知設定 | +TASTAS',
  description: 'プッシュ通知の設定を管理',
};

export default function NotificationSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href="/mypage"
            className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold">通知設定</h1>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        <NotificationSettingsClient />
      </div>
    </div>
  );
}
