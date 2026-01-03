'use client';

import { useEffect } from 'react';
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
  Building2,
} from 'lucide-react';
import { AdminBottomNav } from '@/components/layout/AdminBottomNav';
import { markAllFacilityNotificationsAsRead } from '@/src/lib/actions';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const facilityId = admin?.facilityId;

  // SWRによる通知データ取得
  const { notifications, isLoading: loading, error, mutate } = useAdminNotifications(facilityId);

  // ログインしていない、または管理者でない場合はログインページへリダイレクト
  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // エラー時の処理
  useEffect(() => {
    if (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'fetch',
        operation: '施設通知一覧取得',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { facilityId }
      });
      console.error('Failed to load notifications:', error);
      toast.error('通知の読み込みに失敗しました');
    }
  }, [error, facilityId, showDebugError]);

  const handleNotificationClick = (notification: { link: string | null }) => {
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!facilityId) return;
    try {
      const result = await markAllFacilityNotificationsAsRead(facilityId);
      if (result.success) {
        // SWRキャッシュを楽観的に更新
        mutate(
          notifications.map((n) => ({ ...n, isRead: true })),
          false // revalidateを無効化
        );
        toast.success('すべて既読にしました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: '施設通知一括既読',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { facilityId }
      });
      console.error('Failed to mark all as read:', error);
      toast.error('既読処理に失敗しました');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'APPLICATION_RECEIVED':
        return <Briefcase className="w-5 h-5 text-purple-500" />;
      case 'MESSAGE_RECEIVED':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'REVIEW_RECEIVED':
        return <Star className="w-5 h-5 text-yellow-500" />;
      case 'MATCHING_SUCCESS':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
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
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">施設通知</h1>
            </div>
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
        {loading || isAdminLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 flex gap-3 bg-white">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-2 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
                </div>
              </div>
            ))}
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
              className={`w-full p-4 flex gap-3 text-left transition-colors ${notification.isRead
                ? 'bg-white'
                : 'bg-blue-50 hover:bg-blue-100'
                }`}
            >
              {/* アイコン */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notification.isRead ? 'bg-gray-100' : 'bg-white'
                  }`}
              >
                {getNotificationIcon(notification.type)}
              </div>

              {/* コンテンツ */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-sm ${notification.isRead
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
      <AdminBottomNav />
    </div>
  );
}
