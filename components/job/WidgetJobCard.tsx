'use client';

import Image from 'next/image';
import { Job } from '@/types/job';
import { Facility } from '@/types/facility';
import { Badge } from '@/components/ui/badge';
import { getDeadlineText, isDeadlineUrgent } from '@/utils/date';
import { useState, useEffect, memo } from 'react';

interface WidgetJobCardProps {
  job: Job & {
    hasAvailableWorkDate?: boolean;
    noFutureWorkDates?: boolean;
    workDates?: Array<{
      id: number;
      workDate: string;
      canApply?: boolean;
      isFull?: boolean;
    }>;
  };
  facility: Facility;
  selectedDate?: string;
  lpNumber?: string;
  lineUrl?: string;
}

const DEFAULT_JOB_IMAGE = '/images/samples/facility_top_1.png';

const WidgetJobCardComponent: React.FC<WidgetJobCardProps> = ({ job, facility, selectedDate, lpNumber, lineUrl }) => {
  const [mounted, setMounted] = useState(false);

  const jobImage = job.images && job.images.length > 0 ? job.images[0] : DEFAULT_JOB_IMAGE;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isUrgent = mounted ? isDeadlineUrgent(job.deadline) : false;
  const deadlineText = mounted ? getDeadlineText(job.deadline) : '計算中...';

  const selectedWorkDate = selectedDate && job.workDates
    ? job.workDates.find(wd => wd.workDate === selectedDate)
    : null;

  // 勤務日なし求人は常にグレーアウトしない
  const isUnavailable = job.noFutureWorkDates
    ? false
    : selectedWorkDate
      ? !selectedWorkDate.canApply
      : job.hasAvailableWorkDate === false;

  const unavailableReason = job.noFutureWorkDates
    ? null
    : selectedWorkDate
      ? selectedWorkDate.isFull
        ? '募集終了'
        : null
      : job.hasAvailableWorkDate === false
        ? '応募できません'
        : null;

  const shouldShowUnavailable = isUnavailable;

  // 勤務日なし求人 → LINE登録URLに直接遷移、通常求人 → 求人詳細ページ
  const isDirectLineLink = job.noFutureWorkDates && lineUrl;
  let cardUrl: string;
  if (isDirectLineLink) {
    cardUrl = lineUrl;
  } else {
    const params = new URLSearchParams();
    if (selectedDate) params.set('date', selectedDate);
    if (lpNumber) params.set('from_lp', lpNumber);
    const qs = params.toString();
    cardUrl = `/public/jobs/${job.id}${qs ? `?${qs}` : ''}`;
  }

  // 勤務日なし求人クリック時にLPトラッキングを送信
  const handleClick = () => {
    if (!isDirectLineLink || !lpNumber) return;
    try {
      const sessionId = sessionStorage.getItem(`lp_session_id_${lpNumber}`) || sessionStorage.getItem('lp_session_id') || '';
      const payload = JSON.stringify({
        type: 'click',
        lpId: lpNumber,
        sessionId,
        buttonId: 'line_register',
        buttonText: '求人カード（LINE登録）',
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/lp-tracking', blob);
      }
    } catch { /* サイレント */ }
  };

  return (
    <a href={cardUrl} target="_top" onClick={handleClick} className="h-full block">
      <div className={`bg-surface rounded-card shadow-card transition-all h-full flex flex-col overflow-hidden ${shouldShowUnavailable ? 'opacity-70' : 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer'}`}>
        {/* 縦並びカード（iframe内2列グリッドで常に安定表示） */}
        <div className="relative w-full aspect-[4/3] flex-shrink-0">
          <Image
            src={jobImage}
            alt={facility.name}
            fill
            className={`object-cover ${shouldShowUnavailable ? 'opacity-60 grayscale' : ''}`}
          />
          <div className="absolute top-2 left-2 flex flex-col gap-0.5 z-10">
            {job.jobType === 'OFFER' && (
              <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">オファ</span>
            )}
            {job.jobType === 'LIMITED_WORKED' && (
              <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">限定</span>
            )}
            {job.jobType === 'LIMITED_FAVORITE' && (
              <span className="bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">限定<span className="text-yellow-300">★</span></span>
            )}
            {job.jobType === 'ORIENTATION' && (
              <span className="bg-teal-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">説明会</span>
            )}
            {job.requiresInterview && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">審査あり</span>
            )}
          </div>
          {shouldShowUnavailable && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">
                {unavailableReason || '募集終了'}
              </span>
            </div>
          )}
        </div>

        <div className="p-2 flex flex-col flex-1">
          <div className="flex items-start gap-1 mb-1">
            <span className="text-xs font-bold break-words flex-1 line-clamp-1">{facility.name}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="text-yellow-400 text-[10px]">★</span>
              <span className="text-[10px]">{facility.rating.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-1">
            {job.effectiveWeeklyFrequency && (
              <Badge variant="purple" className="text-[9px] px-1 py-0.5">
                {job.effectiveWeeklyFrequency}回以上勤務
              </Badge>
            )}
            {job.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="red" className="text-[9px] px-1 py-0.5">
                {tag}
              </Badge>
            ))}
          </div>

          <h3 className="text-xs mb-1 line-clamp-2 min-h-[2rem]">{job.title}</h3>

          <div className="text-xs text-gray-600 mb-1">{job.startTime}-{job.endTime}</div>

          <div className="flex items-center justify-end gap-1 mb-1">
            <span className="text-[10px] text-gray-600">時給{job.hourlyWage.toLocaleString()}円</span>
            <span className="text-red-500 font-bold text-sm">{job.wage.toLocaleString()}円</span>
          </div>

          <div className="flex justify-end mb-1">
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${isUrgent ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-800'}`}>
              {deadlineText === '締切済み' ? '募集終了' : `締切まで${deadlineText}`}
            </span>
          </div>

          <div className="mt-auto pt-1 border-t border-gray-100">
            <div className="text-[10px] text-gray-500 line-clamp-1">
              {(job.prefecture || job.city || job.addressLine)
                ? `${job.prefecture || ''}${job.city || ''}${job.addressLine || ''}`
                : job.address}
            </div>
            <div className="text-[10px] text-gray-500 line-clamp-1">{job.access}</div>
          </div>
        </div>
      </div>
    </a>
  );
};

export const WidgetJobCard = memo(WidgetJobCardComponent);
