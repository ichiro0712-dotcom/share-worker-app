'use client';

/**
 * 求人カードのスケルトン（ローディング用プレースホルダー）
 */
export function JobCardSkeleton() {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            {/* 画像プレースホルダー */}
            <div className="w-full h-40 bg-gray-200 rounded-lg mb-3" />

            {/* タイトルプレースホルダー */}
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />

            {/* 施設名プレースホルダー */}
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />

            {/* タグプレースホルダー */}
            <div className="flex gap-2 mb-3">
                <div className="h-6 bg-gray-200 rounded w-16" />
                <div className="h-6 bg-gray-200 rounded w-20" />
                <div className="h-6 bg-gray-200 rounded w-14" />
            </div>

            {/* 時間・給与プレースホルダー */}
            <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-6 bg-gray-200 rounded w-20" />
            </div>
        </div>
    );
}

/**
 * 複数のスケルトンカードを表示
 */
export function JobListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <JobCardSkeleton key={i} />
            ))}
        </div>
    );
}
