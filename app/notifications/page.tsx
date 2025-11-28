'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Bell,
  CheckCircle,
  MessageSquare,
  Star,
  Briefcase,
  Info,
  Check,
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/src/lib/actions';
import toast from 'react-hot-toast';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const data = await getUserNotifications();
    setNotifications(data);
    setLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, isRead: true } : n
        )
      );
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsRead();
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      toast.success('すべて既読にしました');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MATCHING_SUCCESS':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'MESSAGE_RECEIVED':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'REVIEW_REQUEST':
      case 'REVIEW_RECEIVED':
        return <Star className="w-5 h-5 text-yellow-500" />;
      case 'APPLICATION_RECEIVED':
        return <Briefcase className="w-5 h-5 text-purple-500" />;
      case 'JOB_REMINDER':
        return <Bell className="w-5 h-5 text-orange-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}分前`;
      }
      return `${hours}時間前`;
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
      });
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">通知</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-primary flex items-center gap-1"
            >
              <Check className="w-4 h-4" />
              すべて既読
            </button>
          )}
        </div>
      </div>

      {/* 通知リスト */}
      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            読み込み中...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">通知はありません</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full p-4 flex gap-3 text-left transition-colors ${
                notification.isRead
                  ? 'bg-white'
                  : 'bg-blue-50 hover:bg-blue-100'
              }`}
            >
              {/* アイコン */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  notification.isRead ? 'bg-gray-100' : 'bg-white'
                }`}
              >
                {getNotificationIcon(notification.type)}
              </div>

              {/* コンテンツ */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-sm ${
                      notification.isRead
                        ? 'text-gray-700'
                        : 'font-semibold text-gray-900'
                    }`}
                  >
                    {notification.title}
                  </h3>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {notification.message}
                </p>
              </div>

              {/* 未読インジケーター */}
              {!notification.isRead && (
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
              )}
            </button>
          ))
        )}
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
