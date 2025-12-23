'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

interface WorkDateData {
    id: number;
    date: string;
    formattedDate: string;
    recruitmentCount: number;
    appliedCount: number;
    matchedCount: number;
    deadline: string;
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
}

interface AdminJobsParams {
    facilityId?: number;
    page?: number;
    status?: string;
    query?: string;
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

const fetcher = async (url: string): Promise<AdminJobsResponse> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

const buildUrl = (params: AdminJobsParams): string | null => {
    if (!params.facilityId) return null; // facilityIdがない場合はフェッチしない
    const searchParams = new URLSearchParams();
    searchParams.set('facilityId', String(params.facilityId));
    if (params.page) searchParams.set('page', String(params.page));
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.query) searchParams.set('query', params.query);
    return `/api/admin/jobs/list?${searchParams.toString()}`;
};

export function useAdminJobs(params: AdminJobsParams) {
    const url = useMemo(() => buildUrl(params), [params.facilityId, params.page, params.status, params.query]);

    const { data, error, isLoading, mutate } = useSWR<AdminJobsResponse>(
        url,
        fetcher,
        {
            revalidateOnFocus: true,
            revalidateOnMount: true, // ページに戻った時に必ず再取得
            dedupingInterval: 2000,
            refreshInterval: 5000, // 5秒ごとに再取得（バックグラウンド保存対応）
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
