'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

export interface Shift {
    applicationId: number;
    workDateId: number;
    workDate: string; // ISO string
    startTime: string;
    endTime: string;
    breakTime: number | null;
    hourlyRate: number;
    transportationFee: number;
    workerId: number;
    workerName: string;
    workerProfileImage: string | null;
    qualifications: string[];
    status: string;
    jobId: number;
    weeklyFrequency: number | null;
    jobType: string;
}

interface AdminShiftsParams {
    facilityId?: number;
    startDate: string; // ISO string
    endDate: string; // ISO string
}

const fetcher = async (url: string): Promise<Shift[]> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

const buildUrl = (params: AdminShiftsParams): string | null => {
    if (!params.facilityId) return null;
    const searchParams = new URLSearchParams();
    searchParams.set('facilityId', String(params.facilityId));
    searchParams.set('startDate', params.startDate);
    searchParams.set('endDate', params.endDate);
    return `/api/admin/shifts?${searchParams.toString()}`;
};

/**
 * 施設シフト一覧取得フック
 * 最適化: SWRによるキャッシュとデータ重複排除
 */
export function useAdminShifts(params: AdminShiftsParams) {
    const url = useMemo(() => buildUrl(params), [
        params.facilityId,
        params.startDate,
        params.endDate
    ]);

    const { data, error, isLoading, mutate } = useSWR<Shift[]>(
        url,
        fetcher,
        {
            revalidateOnFocus: true, // タブ復帰時に再取得
            revalidateOnReconnect: true, // ネットワーク復帰時に再取得
            dedupingInterval: 5000, // 5秒間は同一リクエストを重複排除
        }
    );

    // Date型に変換したシフトデータを返す
    const shifts = useMemo(() => {
        if (!data) return [];
        return data.map(shift => ({
            ...shift,
            workDate: new Date(shift.workDate)
        }));
    }, [data]);

    return {
        shifts,
        isLoading,
        error,
        mutate,
    };
}
