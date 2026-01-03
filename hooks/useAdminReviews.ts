'use client';

import useSWR from 'swr';

export interface AdminReview {
    id: number;
    rating: number;
    goodPoints: string | null;
    improvements: string | null;
    createdAt: string;
    userName: string;
    userQualifications: string[];
    jobTitle: string;
    jobDate: string;
}

export interface AdminReviewStats {
    averageRating: number;
    totalCount: number;
    distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

interface AdminReviewsResponse {
    reviews: AdminReview[];
    stats: AdminReviewStats;
}

const fetcher = async (url: string): Promise<AdminReviewsResponse> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

/**
 * 施設レビュー一覧と統計情報取得フック
 * 最適化: SWRによるキャッシュとデータ重複排除
 */
export function useAdminReviews(facilityId?: number) {
    const url = facilityId ? `/api/admin/reviews?facilityId=${facilityId}` : null;

    const { data, error, isLoading, mutate } = useSWR<AdminReviewsResponse>(
        url,
        fetcher,
        {
            revalidateOnFocus: true, // タブ復帰時に再取得
            revalidateOnReconnect: true, // ネットワーク復帰時に再取得
            dedupingInterval: 5000, // 5秒間は同一リクエストを重複排除
        }
    );

    return {
        reviews: data?.reviews ?? [],
        stats: data?.stats ?? null,
        isLoading,
        error,
        mutate,
    };
}
