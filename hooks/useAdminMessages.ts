'use client';

import useSWR from 'swr';
import { adminFetcher } from '@/lib/admin-api-fetcher';

export interface AdminConversation {
    userId: number;
    userName: string;
    userProfileImage: string | null;
    applicationIds: number[];
    lastMessage: string;
    lastMessageTime: string | Date;
    unreadCount: number;
    jobTitle: string;
    status: string;
    isOffice?: boolean;
}

export interface AdminAnnouncement {
    id: number;
    title: string;
    content: string;
    category: string;
    publishedAt: string | Date | null;
    isRead: boolean;
}

export interface AdminMessage {
    id: number;
    applicationId: number;
    content: string;
    attachments?: string[];
    senderType: 'worker' | 'facility' | 'office';
    senderName: string;
    timestamp: string;
    isRead: boolean;
    jobTitle: string;
    jobDate: string | null;
    workerName?: string;
    // 送信状態（LINEライクUI用）
    sendStatus?: 'sending' | 'sent' | 'failed';
    // 失敗時の再送用データ
    _retryData?: {
        applicationId: number;
        facilityId: number;
        content: string;
        attachments: string[];
    };
}

export interface AdminMessagesResponse {
    userId: number;
    userName: string;
    userProfileImage: string | null;
    isOffice?: boolean;
    applicationIds: number[]; // 追加: メッセージ送信時に使用
    messages: AdminMessage[];
    nextCursor: number | null;
    hasMore: boolean;
}

// 認証エラーハンドリング付きフェッチャーを使用

/**
 * 施設メッセージ会話一覧取得
 * 最適化: dedupingIntervalを長めに設定し、revalidateOnFocusを無効化
 */
export function useAdminConversations(facilityId?: number, initialData?: AdminConversation[]) {
    const url = facilityId ? `/api/admin/messages/conversations?facilityId=${facilityId}` : null;

    const { data, error, isLoading, mutate } = useSWR<AdminConversation[]>(
        url,
        adminFetcher,
        {
            fallbackData: initialData,
            revalidateOnFocus: false, // フォーカス時の再取得を無効化
            revalidateOnReconnect: true, // ネットワーク復帰時は再取得
            refreshInterval: 30000, // 30秒ごとにポーリング
            dedupingInterval: 5000, // 5秒間は同一リクエストを重複排除
        }
    );

    return {
        conversations: data ?? [],
        isLoading: initialData ? false : isLoading, // 初期データがある場合はloadingをスキップ
        error,
        mutate,
    };
}

/**
 * ワーカー別メッセージ取得
 * 最適化: dedupingIntervalを設定し、不要な再取得を防止
 */
export function useAdminMessagesByWorker(facilityId: number | undefined, workerId: number | null) {
    const url = facilityId && workerId !== null
        ? `/api/admin/messages/detail?facilityId=${facilityId}&workerId=${workerId}&markAsRead=true`
        : null;

    const { data, error, isLoading, mutate } = useSWR<AdminMessagesResponse>(
        url,
        adminFetcher,
        {
            revalidateOnFocus: false, // フォーカス時の再取得を無効化
            revalidateOnReconnect: true,
            refreshInterval: 10000, // 10秒ごとにポーリング（チャットなのでやや短め）
            dedupingInterval: 3000, // 3秒間は同一リクエストを重複排除
        }
    );

    return {
        chatData: data,
        isLoading,
        error,
        mutate,
    };
}

/**
 * お知らせ取得
 * 最適化: 頻度が低いためrefreshIntervalを長めに
 */
export function useAdminAnnouncements(facilityId?: number) {
    const url = facilityId ? `/api/admin/messages/announcements?facilityId=${facilityId}` : null;

    const { data, error, isLoading, mutate } = useSWR<AdminAnnouncement[]>(
        url,
        adminFetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            refreshInterval: 120000, // 2分ごと（お知らせはリアルタイム性が低い）
            dedupingInterval: 10000, // 10秒間は同一リクエストを重複排除
        }
    );

    return {
        announcements: data ?? [],
        isLoading,
        error,
        mutate,
    };
}
