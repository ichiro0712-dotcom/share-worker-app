'use client';

import useSWR from 'swr';
import { swrFetcher } from '@/lib/swr-fetcher';

export interface Conversation {
    facilityId: number;
    facilityName: string;
    facilityDisplayName?: string;
    staffAvatar?: string | null;
    applicationIds: number[];
    lastMessage: string;
    lastMessageTime: string | Date;
    unreadCount: number;
}

export interface Message {
    id: number;
    applicationId: number;
    content: string;
    attachments?: string[];
    senderType: 'worker' | 'facility';
    senderName: string;
    senderAvatar?: string | null;
    createdAt: string;
    timestamp: string;
    isRead: boolean;
    jobTitle: string;
    jobDate: string | null;
    // 送信状態（LINEライクUI用）
    sendStatus?: 'sending' | 'sent' | 'failed';
    // 失敗時の再送用データ
    _retryData?: {
        facilityId: number;
        content: string;
        attachments: string[];
    };
}

export interface Announcement {
    id: number;
    title: string;
    content: string;
    category: string;
    publishedAt: string | Date | null;
    isRead: boolean;
}

export interface MessagesResponse {
    facilityId: number;
    facilityName: string;
    facilityDisplayName?: string;
    staffAvatar?: string | null;
    applicationIds: number[];
    messages: Message[];
    nextCursor: number | null;
    hasMore: boolean;
}

export function useConversations(fallbackData?: Conversation[]) {
    const { data, error, isLoading, mutate } = useSWR<Conversation[]>(
        '/api/messages/conversations',
        swrFetcher,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true, // オンライン復帰時に再取得
            refreshInterval: 30000, // 30秒ごとに更新
            dedupingInterval: 5000, // 5秒間は重複リクエストを防止
            keepPreviousData: true, // 再検証中も前のデータを表示
            fallbackData, // SSRで取得した初期データ
        }
    );

    return {
        conversations: data ?? [],
        isLoading: fallbackData ? false : isLoading, // fallbackDataがあれば初回ローディングなし
        error,
        mutate,
    };
}

export function useMessagesByFacility(facilityId: number | null) {
    const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
        facilityId ? `/api/messages/detail?facilityId=${facilityId}&markAsRead=true` : null,
        swrFetcher,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true, // オンライン復帰時に再取得
            refreshInterval: 10000, // メッセージ画面表示中は10秒ごとに更新
            dedupingInterval: 3000, // 3秒間は重複リクエストを防止（詳細画面は頻繁に切り替わるため短め）
            keepPreviousData: true, // 再検証中も前のデータを表示（ちらつき防止）
        }
    );

    return {
        chatData: data,
        isLoading,
        error,
        mutate,
    };
}

export function useAnnouncements() {
    const { data, error, isLoading, mutate } = useSWR<Announcement[]>(
        '/api/messages/announcements',
        swrFetcher,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true, // オンライン復帰時に再取得
            refreshInterval: 60000,
        }
    );

    return {
        announcements: data ?? [],
        isLoading,
        error,
        mutate,
    };
}
