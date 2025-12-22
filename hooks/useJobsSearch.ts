'use client';

import useSWR, { preload } from 'swr';
import { useCallback, useMemo } from 'react';
import { generateDates } from '@/utils/date';

interface JobSearchParams {
  query?: string;
  prefecture?: string;
  city?: string;
  minWage?: string;
  serviceTypes?: string[];
  transportations?: string[];
  otherConditions?: string[];
  jobTypes?: string[];
  workTimeTypes?: string[];
  page?: number;
  dateIndex?: number;
  sort?: 'distance' | 'wage' | 'deadline';
  timeRangeFrom?: string;
  timeRangeTo?: string;
  distanceKm?: string;
  distanceLat?: string;
  distanceLng?: string;
}

interface JobsResponse {
  jobs: any[];
  facilities: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasMore: boolean;
  };
}

// SWR用のfetcher
const fetcher = async (url: string): Promise<JobsResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch jobs');
  }
  return res.json();
};

// URLを生成する関数
const buildJobsUrl = (params: JobSearchParams): string => {
  const searchParams = new URLSearchParams();

  if (params.query) searchParams.set('query', params.query);
  if (params.prefecture) searchParams.set('prefecture', params.prefecture);
  if (params.city) searchParams.set('city', params.city);
  if (params.minWage) searchParams.set('minWage', params.minWage);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.dateIndex !== undefined) searchParams.set('dateIndex', String(params.dateIndex));
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.timeRangeFrom) searchParams.set('timeRangeFrom', params.timeRangeFrom);
  if (params.timeRangeTo) searchParams.set('timeRangeTo', params.timeRangeTo);
  if (params.distanceKm) searchParams.set('distanceKm', params.distanceKm);
  if (params.distanceLat) searchParams.set('distanceLat', params.distanceLat);
  if (params.distanceLng) searchParams.set('distanceLng', params.distanceLng);

  // 配列パラメータ
  params.serviceTypes?.forEach(v => searchParams.append('serviceType', v));
  params.transportations?.forEach(v => searchParams.append('transportation', v));
  params.otherConditions?.forEach(v => searchParams.append('otherCondition', v));
  params.jobTypes?.forEach(v => searchParams.append('jobType', v));
  params.workTimeTypes?.forEach(v => searchParams.append('workTimeType', v));

  return `/api/jobs?${searchParams.toString()}`;
};

export function useJobsSearch(params: JobSearchParams, initialData?: JobsResponse) {
  const url = useMemo(() => buildJobsUrl(params), [params]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<JobsResponse>(
    url,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5秒間は同じリクエストを重複排除
      keepPreviousData: false, // 日付変更時に古いデータを表示しない
    }
  );

  // 日付リスト（90日分）
  const dates = useMemo(() => generateDates(90), []);

  // 特定の日付をプリフェッチ
  const prefetchDate = useCallback((dateIndex: number) => {
    if (dateIndex >= 0 && dateIndex < dates.length) {
      const prefetchUrl = buildJobsUrl({ ...params, dateIndex, page: 1 });
      preload(prefetchUrl, fetcher);
    }
  }, [params, dates.length]);

  // 前後の日付をプリフェッチ
  const prefetchNearbyDates = useCallback((currentDateIndex: number) => {
    // 前後3日分をプリフェッチ
    [-3, -2, -1, 1, 2, 3].forEach(offset => {
      const targetIndex = currentDateIndex + offset;
      if (targetIndex >= 0 && targetIndex < dates.length) {
        prefetchDate(targetIndex);
      }
    });
  }, [prefetchDate, dates.length]);

  return {
    jobs: data?.jobs ?? [],
    facilities: data?.facilities ?? [],
    pagination: data?.pagination,
    isLoading: isLoading || (!data && !error),
    isValidating,
    error,
    mutate,
    prefetchDate,
    prefetchNearbyDates,
    dates,
  };
}

// 日付ホバー時のプリフェッチ用（DateSliderで使用）
export function prefetchJobsForDate(params: Omit<JobSearchParams, 'dateIndex'>, dateIndex: number) {
  const url = buildJobsUrl({ ...params, dateIndex, page: 1 });
  preload(url, fetcher);
}
