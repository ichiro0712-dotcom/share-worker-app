import { Suspense } from 'react';
import { JobListSkeleton } from '@/components/job/JobCardSkeleton';
import { JobListWrapper } from '@/components/job/JobListWrapper';

// 求人一覧は60秒キャッシュ（ISR）- パフォーマンス向上のため
export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{
    query?: string;
    prefecture?: string;
    city?: string;
    minWage?: string;
    serviceType?: string | string[];
    transportation?: string | string[];
    otherCondition?: string | string[];
    jobType?: string | string[];
    workTimeType?: string | string[];
    page?: string;
    dateIndex?: string;
    sort?: 'distance' | 'wage' | 'deadline';
    // 時間帯パラメータ
    timeRangeFrom?: string;
    timeRangeTo?: string;
    // 距離検索パラメータ
    distanceKm?: string;
    distanceLat?: string;
    distanceLng?: string;
  }>;
}

export default async function JobListPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー部分のスケルトン */}
        <div className="bg-white border-b px-4 py-3">
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        {/* 日付スライダー部分のスケルトン */}
        <div className="bg-white border-b px-4 py-2">
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 w-14 bg-gray-200 rounded animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>
        {/* 求人カードリストのスケルトン */}
        <div className="p-4">
          <JobListSkeleton count={6} />
        </div>
      </div>
    }>
      <JobListWrapper params={params} />
    </Suspense>
  );
}
