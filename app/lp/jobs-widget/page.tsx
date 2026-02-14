'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DateSlider } from '@/components/job/DateSlider';
import { WidgetJobCard } from '@/components/job/WidgetJobCard';
import { Job } from '@/types/job';
import { Facility } from '@/types/facility';

interface ApiResponse {
  jobs: (Job & { hasAvailableWorkDate?: boolean; workDates?: Array<{ id: number; workDate: string; canApply?: boolean; isFull?: boolean }> })[];
  facilities: Facility[];
  dates: string[];
  selectedDateIndex: number;
}

export default function JobsWidgetPage() {
  const searchParams = useSearchParams();
  const lpNumber = searchParams.get('lp') || '';

  const [dateIndex, setDateIndex] = useState(3);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lineUrl, setLineUrl] = useState<string | null>(null);

  // LP経由の場合、LINE URLを取得（勤務日なし求人のリンク先に使用）
  useEffect(() => {
    if (!lpNumber) return;
    fetch(`/api/public/lp-line-url?lp=${encodeURIComponent(lpNumber)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.url) setLineUrl(data.url); })
      .catch(() => {});
  }, [lpNumber]);

  const fetchJobs = useCallback(async (idx: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/public/recommended-jobs?dateIndex=${idx}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // サイレント
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(dateIndex);
  }, [dateIndex, fetchJobs]);

  // iframe高さ自動調整
  useEffect(() => {
    const sendHeight = () => {
      window.parent.postMessage(
        { type: 'tastas-jobs-resize', height: document.body.scrollHeight },
        '*'
      );
    };

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);

    // 初期送信
    sendHeight();

    return () => observer.disconnect();
  }, []);

  const dates = data?.dates?.map(d => new Date(d)) || [];
  const selectedDateStr = dates[dateIndex]
    ? (() => {
        const d = dates[dateIndex];
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return jst.toISOString().split('T')[0];
      })()
    : undefined;

  // facilityをidでマップ
  const facilityMap = new Map<number, Facility>();
  data?.facilities?.forEach(f => facilityMap.set(f.id, f));

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* 日付選択 */}
      {dates.length > 0 && (
        <div className="mb-4">
          <DateSlider
            dates={dates}
            selectedIndex={dateIndex}
            onSelect={(idx) => setDateIndex(idx)}
          />
        </div>
      )}

      {/* ローディング */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg animate-pulse h-64" />
          ))}
        </div>
      )}

      {/* 求人カード */}
      {!isLoading && data && (
        <>
          {data.jobs.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <p className="text-sm">選択した日付に表示できる求人はありません</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.jobs.map((job) => {
                const facility = facilityMap.get(job.facilityId);
                if (!facility) return null;
                return (
                  <WidgetJobCard
                    key={job.id}
                    job={job}
                    facility={facility}
                    selectedDate={selectedDateStr}
                    lpNumber={lpNumber}
                    lineUrl={lineUrl || undefined}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
