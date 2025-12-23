'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

// 型定義
interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

interface Worker {
  id: number;
  name: string;
  profileImage: string | null;
  qualifications: string[];
}

interface Application {
  id: number;
  status: string;
  cancelledBy?: 'WORKER' | 'FACILITY' | null;
  createdAt: string | Date;
  worker: Worker;
  rating: number | null;
  reviewCount: number;
  lastMinuteCancelRate: number;
}

interface WorkDate {
  id: number;
  date: string;
  formattedDate: string;
  recruitmentCount: number;
  appliedCount: number;
  matchedCount: number;
  applications: Application[];
}

type JobType = 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'ORIENTATION' | 'OFFER';

interface JobWithApplications {
  id: number;
  title: string;
  status: string;
  jobType: JobType;
  startTime: string;
  endTime: string;
  hourlyWage: number;
  transportationFee?: number;
  workContent: string[];
  requiredQualifications: string[];
  requiresInterview: boolean;
  totalRecruitment: number;
  totalApplied: number;
  totalMatched: number;
  dateRange: string;
  workDates: WorkDate[];
  unviewedCount: number;
}

interface WorkerWithApplications {
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location: string | null;
    rating: number | null;
    reviewCount: number;
    totalWorkDays: number;
    lastMinuteCancelRate: number;
    experienceFields: Array<{ field: string; years: string }>;
    isFavorite: boolean;
    isBlocked: boolean;
  };
  applications: {
    id: number;
    status: string;
    cancelledBy?: 'WORKER' | 'FACILITY' | null;
    createdAt: string;
    isUnviewed?: boolean;
    job: {
      id: number;
      title: string;
      workDate: string;
      startTime: string;
      endTime: string;
      hourlyWage: number;
      requiresInterview: boolean;
    };
  }[];
  unviewedCount: number;
}

interface JobsApplicationsResponse {
  data: JobWithApplications[];
  pagination: PaginationData;
}

interface WorkersApplicationsResponse {
  data: WorkerWithApplications[];
  pagination: PaginationData;
}

interface ApplicationsByJobParams {
  facilityId?: number;
  page?: number;
  status?: 'all' | 'published' | 'stopped' | 'completed';
  query?: string;
}

interface ApplicationsByWorkerParams {
  facilityId?: number;
  page?: number;
  query?: string;
}

// SWR fetcher
const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

// URL生成関数
const buildJobsUrl = (params: ApplicationsByJobParams): string | null => {
  if (!params.facilityId) return null;
  const searchParams = new URLSearchParams();
  searchParams.set('facilityId', String(params.facilityId));
  if (params.page) searchParams.set('page', String(params.page));
  if (params.status && params.status !== 'all') {
    searchParams.set('status', params.status.toUpperCase());
  }
  if (params.query) searchParams.set('query', params.query);
  return `/api/admin/applications?${searchParams.toString()}`;
};

const buildWorkersUrl = (params: ApplicationsByWorkerParams): string | null => {
  if (!params.facilityId) return null;
  const searchParams = new URLSearchParams();
  searchParams.set('facilityId', String(params.facilityId));
  if (params.page) searchParams.set('page', String(params.page));
  if (params.query) searchParams.set('query', params.query);
  return `/api/admin/applications/by-worker?${searchParams.toString()}`;
};

// 求人別応募一覧フック
export function useApplicationsByJob(params: ApplicationsByJobParams) {
  const url = useMemo(() => buildJobsUrl(params), [params.facilityId, params.page, params.status, params.query]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<JobsApplicationsResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      keepPreviousData: false,
      refreshInterval: 30000, // 30秒ごとに再取得
    }
  );

  return {
    jobs: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

// ワーカー別応募一覧フック
export function useApplicationsByWorker(params: ApplicationsByWorkerParams) {
  const url = useMemo(() => buildWorkersUrl(params), [params.facilityId, params.page, params.query]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<WorkersApplicationsResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      keepPreviousData: false,
      refreshInterval: 30000,
    }
  );

  return {
    workers: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
