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

export function useAdminConversations(facilityId?: number) {
    const url = facilityId ? `/api/admin/messages/conversations?facilityId=${facilityId}` : null;

    const { data, error, isLoading, mutate } = useSWR<AdminConversation[]>(
        url,
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

export function useAdminMessagesByWorker(facilityId: number | undefined, workerId: number | null) {
    const url = facilityId && workerId !== null
        ? `/api/admin/messages/detail?facilityId=${facilityId}&workerId=${workerId}&markAsRead=true`
        : null;

    const { data, error, isLoading, mutate } = useSWR<AdminMessagesResponse>(
        url,
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

export function useAdminAnnouncements(facilityId?: number) {
    const url = facilityId ? `/api/admin/messages/announcements?facilityId=${facilityId}` : null;

    const { data, error, isLoading, mutate } = useSWR<AdminAnnouncement[]>(
        url,
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
