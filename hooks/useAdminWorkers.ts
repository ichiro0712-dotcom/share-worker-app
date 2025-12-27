'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

export type WorkerListStatus = 'NOT_STARTED' | 'WORKING' | 'COMPLETED' | 'REVIEW_PENDING' | 'CANCELLED';

export interface WorkerListItem {
    userId: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    prefecture: string | null;
    city: string | null;
    statuses: WorkerListStatus[];
    hasCompleted: boolean;
    hasCompletedRated: boolean; // レビュー完了済み（オファー対象）
    hasCancelled: boolean;
    ourWorkCount: number;
    lastOurWorkDate: string | null;
    otherWorkCount: number;
    lastOtherWorkDate: string | null;
    totalWorkCount: number;
    lastWorkDate: string | null;
    lastWorkFacilityType: 'our' | 'other' | null;
    scheduledDates: {
        date: string;
        startTime: string;
        endTime: string;
    }[];
    cancelRate: number;
    lastMinuteCancelRate: number;
    experienceFields: Record<string, string> | null;
    avgRating: number | null;
    reviewCount: number;
    isFavorite: boolean;
    isBlocked: boolean;
}

interface AdminWorkersParams {
    facilityId?: number;
    page?: number;
    limit?: number;
    status?: string;
    keyword?: string;
    sort?: string;
    jobCategory?: string;
}

interface AdminWorkersResponse {
    data: WorkerListItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasMore: boolean;
    };
}

const fetcher = async (url: string): Promise<AdminWorkersResponse> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

const buildUrl = (params: AdminWorkersParams): string | null => {
    if (!params.facilityId) return null;
    const searchParams = new URLSearchParams();
    searchParams.set('facilityId', String(params.facilityId));
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.keyword) searchParams.set('keyword', params.keyword);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.jobCategory && params.jobCategory !== 'all') searchParams.set('jobCategory', params.jobCategory);
    return `/api/admin/workers/list?${searchParams.toString()}`;
};

export function useAdminWorkers(params: AdminWorkersParams) {
    const url = useMemo(() => buildUrl(params), [
        params.facilityId,
        params.page,
        params.limit,
        params.status,
        params.keyword,
        params.sort,
        params.jobCategory
    ]);

    const { data, error, isLoading, mutate } = useSWR<AdminWorkersResponse>(
        url,
        fetcher,
        {
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    return {
        workers: data?.data ?? [],
        pagination: data?.pagination,
        isLoading,
        error,
        mutate,
    };
}
