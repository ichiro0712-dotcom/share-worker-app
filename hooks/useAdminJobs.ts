'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { adminFetcher } from '@/lib/admin-api-fetcher';

interface WorkDateData {
    id: number;
    date: string;
    formattedDate: string;
    recruitmentCount: number;
    appliedCount: number;
    matchedCount: number;
    deadline: string;
    visibleUntil: string | null;
}

type JobType = 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'ORIENTATION' | 'OFFER';

interface JobData {
    id: number;
    title: string;
    status: string;
    jobType: JobType;
    startTime: string;
    endTime: string;
    hourlyWage: number;
    breakTime: string;
    wage: number;
    transportationFee: number;
    workContent: string[];
    requiredQualifications: string[];
    workDates: WorkDateData[];
    totalWorkDates: number;
    totalApplied: number;
    totalMatched: number;
    totalRecruitment: number;
    nearestWorkDate: string | null;
    dateRange: string;
    templateId: number | null;
    templateName: string | null;
    requiresInterview: boolean;
    weeklyFrequency: number | null;
    overview: string;
    images: string[];
    address: string | null;
    access: string;
    tags: string[];
    facilityName: string;
    managerName: string;
    managerMessage: string | null;
    managerAvatar: string | null;
    dresscode: string[];
    dresscodeImages: string[];
    belongings: string[];
    attachments: string[];
    requiredExperience: string[];
    inexperiencedOk: boolean;
    blankOk: boolean;
    hairStyleFree: boolean;
    nailOk: boolean;
    uniformProvided: boolean;
    allowCar: boolean;
    mealSupport: boolean;
    targetWorkerId: number | null;
    targetWorkerName: string | null;
}

// ソートオプションの型定義
export type JobSortOption =
    | 'created_desc'
    | 'created_asc'
    | 'applied_desc'
    | 'applied_asc'
    | 'wage_desc'
    | 'wage_asc'
    | 'workDate_asc';

interface AdminJobsParams {
    facilityId?: number;
    page?: number;
    status?: string;
    query?: string;
    sort?: JobSortOption;
}

interface AdminJobsResponse {
    data: JobData[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasMore: boolean;
    };
}

// 認証エラーハンドリング付きフェッチャーを使用

const buildUrl = (params: AdminJobsParams): string | null => {
    if (!params.facilityId) return null; // facilityIdがない場合はフェッチしない
    const searchParams = new URLSearchParams();
    searchParams.set('facilityId', String(params.facilityId));
    if (params.page) searchParams.set('page', String(params.page));
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.query) searchParams.set('query', params.query);
    if (params.sort) searchParams.set('sort', params.sort);
    return `/api/admin/jobs/list?${searchParams.toString()}`;
};

/**
 * 施設求人一覧取得フック
 * 最適化: revalidateOnFocusで画面復帰時に更新されるため、過度なポーリングを削除
 */
export function useAdminJobs(params: AdminJobsParams) {
    const url = useMemo(() => buildUrl(params), [params.facilityId, params.page, params.status, params.query, params.sort]);

    const { data, error, isLoading, mutate } = useSWR<AdminJobsResponse>(
        url,
        adminFetcher,
        {
            revalidateOnFocus: true, // タブ復帰時に再取得
            revalidateOnMount: true, // ページに戻った時に必ず再取得
            revalidateOnReconnect: true, // ネットワーク復帰時に再取得
            dedupingInterval: 5000, // 5秒間は同一リクエストを重複排除
            // refreshIntervalを削除: revalidateOnFocusがあるので不要
            // 必要に応じてmutate()で手動更新可能
        }
    );

    return {
        jobs: data?.data ?? [],
        pagination: data?.pagination,
        isLoading,
        error,
        mutate,
    };
}
