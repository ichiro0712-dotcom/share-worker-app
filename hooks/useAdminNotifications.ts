'use client';

import useSWR from 'swr';
import { adminFetcher } from '@/lib/admin-api-fetcher';

export interface AdminNotification {
    id: number;
    type: string;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

// 認証エラーハンドリング付きフェッチャーを使用

/**
 * 施設通知一覧取得フック
 * 最適化: SWRによるキャッシュとデータ重複排除
 */
export function useAdminNotifications(facilityId?: number) {
    const url = facilityId ? `/api/admin/notifications?facilityId=${facilityId}` : null;

    const { data, error, isLoading, mutate } = useSWR<AdminNotification[]>(
        url,
        adminFetcher,
        {
            revalidateOnFocus: true, // タブ復帰時に再取得
            revalidateOnReconnect: true, // ネットワーク復帰時に再取得
            dedupingInterval: 5000, // 5秒間は同一リクエストを重複排除
            refreshInterval: 60000, // 1分ごとにポーリング（通知は適度にリアルタイム性が必要）
        }
    );

    return {
        notifications: data ?? [],
        isLoading,
        error,
        mutate,
    };
}
