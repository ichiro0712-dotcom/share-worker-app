'use client';

import useSWR from 'swr';

export interface WorkerDetailData {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    profileImage: string | null;
    qualifications: string[];
    birthDate: string | null;
    age: number | null;
    gender: string | null;
    nationality: string | null;
    lastNameKana: string | null;
    firstNameKana: string | null;
    postalCode: string | null;
    prefecture: string | null;
    city: string | null;
    addressLine: string | null;
    building: string | null;
    emergencyName: string | null;
    emergencyRelation: string | null;
    emergencyPhone: string | null;
    emergencyAddress: string | null;
    currentWorkStyle: string | null;
    desiredWorkStyle: string | null;
    jobChangeDesire: string | null;
    desiredWorkDaysPerWeek: string | null;
    desiredWorkPeriod: string | null;
    desiredWorkDays: string[];
    desiredStartTime: string | null;
    desiredEndTime: string | null;
    experienceFields: Record<string, string> | null;
    workHistories: string[];
    selfPR: string | null;
    bankName: string | null;
    branchName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    pensionNumber: string | null;
    ourFacilityWorkDays: number;
    ourFacilityAvgRating: number;
    ourFacilityReviewCount: number;
    totalWorkDays: number;
    otherFacilityWorkDays: number;
    totalAvgRating: number;
    totalReviewCount: number;
    cancelRate: number;
    lastMinuteCancelRate: number;
    ratingsByFacilityType: {
        facilityType: string;
        averageRating: number;
        reviewCount: number;
    }[];
    upcomingSchedules: {
        id: number;
        workDate: string;
        startTime: string;
        endTime: string;
        jobTitle: string;
        facilityName: string;
    }[];
    workHistory: {
        id: number;
        jobTitle: string;
        workDate: string;
        status: string;
    }[];
    evaluations: {
        id: number;
        jobTitle: string;
        jobDate: string;
        rating: number;
        comment: string | null;
    }[];
    isFavorite: boolean;
    isBlocked: boolean;
    ratingsByCategory: {
        attendance: number | null;
        skill: number | null;
        execution: number | null;
        communication: number | null;
        attitude: number | null;
    } | null;
    qualificationCertificates: Record<string, string | { certificate_image?: string }> | null;
    hasCompletedRated: boolean;
}

const fetcher = async (url: string): Promise<WorkerDetailData | null> => {
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch');
    }
    return res.json();
};

/**
 * ワーカー詳細情報取得フック
 * 最適化: SWRによるキャッシュとデータ重複排除
 */
export function useAdminWorkerDetail(workerId?: number, facilityId?: number) {
    const url = workerId && facilityId
        ? `/api/admin/workers/${workerId}?facilityId=${facilityId}`
        : null;

    const { data, error, isLoading, mutate } = useSWR<WorkerDetailData | null>(
        url,
        fetcher,
        {
            revalidateOnFocus: true, // タブ復帰時に再取得
            revalidateOnReconnect: true, // ネットワーク復帰時に再取得
            dedupingInterval: 5000, // 5秒間は同一リクエストを重複排除
        }
    );

    return {
        worker: data ?? null,
        isLoading,
        error,
        mutate,
    };
}
