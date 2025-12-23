'use client';

import useSWR from 'swr';

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
}

export interface AdminMessagesResponse {
    userId: number;
    userName: string;
    userProfileImage: string | null;
    isOffice?: boolean;
    messages: AdminMessage[];
    nextCursor: number | null;
    hasMore: boolean;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

export function useAdminConversations() {
    const { data, error, isLoading, mutate } = useSWR<AdminConversation[]>(
        '/api/admin/messages/conversations',
        fetcher,
        {
            revalidateOnFocus: true,
            refreshInterval: 30000,
        }
    );

    return {
        conversations: data ?? [],
        isLoading,
        error,
        mutate,
    };
}

export function useAdminMessagesByWorker(workerId: number | null) {
    const { data, error, isLoading, mutate } = useSWR<AdminMessagesResponse>(
        workerId !== null ? `/api/admin/messages/detail?workerId=${workerId}&markAsRead=true` : null,
        fetcher,
        {
            revalidateOnFocus: true,
            refreshInterval: 10000,
        }
    );

    return {
        chatData: data,
        isLoading,
        error,
        mutate,
    };
}

export function useAdminAnnouncements() {
    const { data, error, isLoading, mutate } = useSWR<AdminAnnouncement[]>(
        '/api/admin/messages/announcements',
        fetcher,
        {
            revalidateOnFocus: true,
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
