'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Bookmark } from 'lucide-react';
import { Job } from '@/types/job';
import { Facility } from '@/types/facility';
import { Badge } from '@/components/ui/badge';
import { getDeadlineText, isDeadlineUrgent } from '@/utils/date';
import { useState, useEffect, memo } from 'react';
import { addJobBookmark, removeJobBookmark, isJobBookmarked } from '@/src/lib/actions';

interface JobCardProps {
  job: Job & {
    hasAvailableWorkDate?: boolean; // 親求人が応募可能かどうか
    workDates?: Array<{
      id: number;
      workDate: string;
      canApply?: boolean;
      isApplied?: boolean;
      isFull?: boolean;
      hasTimeConflict?: boolean;
    }>;
  };
  facility: Facility;
  selectedDate?: string; // YYYY-MM-DD形式の選択された日付
  priority?: boolean;
}

// デフォルトのプレースホルダー画像
const DEFAULT_JOB_IMAGE = '/images/anken.png';

const JobCardComponent: React.FC<JobCardProps> = ({ job, facility, selectedDate, priority = false }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 画像URLを取得（空配列の場合はフォールバック）
  const jobImage = job.images && job.images.length > 0 ? job.images[0] : DEFAULT_JOB_IMAGE;

  useEffect(() => {
    setMounted(true);
    // ブックマーク状態を取得
    isJobBookmarked(String(job.id), 'WATCH_LATER').then(setIsBookmarked);
  }, [job.id]);

  const isUrgent = mounted ? isDeadlineUrgent(job.deadline) : false;
  const deadlineText = mounted ? getDeadlineText(job.deadline) : '計算中...';

  // 応募不可判定（新ロジック: hasAvailableWorkDateがfalseの場合）
  // 選択された日付がある場合はその日付の応募可否をチェック
  const selectedWorkDate = selectedDate && job.workDates
    ? job.workDates.find(wd => wd.workDate === selectedDate)
    : null;

  // 選択日付が応募不可、または全ての日付が応募不可の場合
  const isUnavailable = selectedWorkDate
    ? !selectedWorkDate.canApply
    : job.hasAvailableWorkDate === false;

  // 応募不可の理由を特定
  const unavailableReason = selectedWorkDate
    ? selectedWorkDate.isApplied
      ? '応募済み'
      : selectedWorkDate.hasTimeConflict
        ? '時間重複'
        : selectedWorkDate.isFull
          ? '募集終了'
          : null
    : job.hasAvailableWorkDate === false
      ? '応募できません'
      : null;

  // 旧ロジック（互換性のため残す）
  const isRecruitmentEnded = !job.requiresInterview && (job.matchedCount ?? 0) >= job.recruitmentCount;

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    setIsProcessing(true);
    try {
      if (isBookmarked) {
        const result = await removeJobBookmark(String(job.id), 'WATCH_LATER');
        if (result.success) {
          setIsBookmarked(false);
        }
      } else {
        const result = await addJobBookmark(String(job.id), 'WATCH_LATER');
        if (result.success) {
          setIsBookmarked(true);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // リンクURLを構築（selectedDateがあればクエリパラメータとして追加）
  const jobDetailUrl = selectedDate
    ? `/jobs/${job.id}?date=${selectedDate}`
    : `/jobs/${job.id}`;

  // 表示するかどうかの判定（応募不可でもグレー表示で出す）
  const shouldShowUnavailable = isUnavailable || isRecruitmentEnded;

  return (
    <Link href={jobDetailUrl} prefetch={true} className="h-full block">
      <div className={`bg-surface rounded-card p-4 shadow-card transition-all h-full flex flex-col ${shouldShowUnavailable ? 'opacity-70' : 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer'}`}>
        {/* PC版: 横並びレイアウト */}
        <div className="hidden md:flex">
          {/* 画像 - 長方形 */}
          <div className="relative w-48 h-40 flex-shrink-0">
            <Image
              src={jobImage}
              alt={facility.name}
              fill
              className={`object-cover ${shouldShowUnavailable ? 'opacity-60 grayscale' : ''}`}
            />
            {/* 面接ありバッジ - 画像左上 */}
            {job.requiresInterview && (
              <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded z-10">
                審査あり
              </span>
            )}
            {shouldShowUnavailable && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5 rounded">
                  {unavailableReason || '募集終了'}
                </span>
              </div>
            )}
            <button
              onClick={handleBookmark}
              className="absolute top-2 right-2"
            >
              <Bookmark
                className={`w-5 h-5 ${isBookmarked
                  ? 'fill-blue-500 text-blue-500'
                  : 'text-white'
                  }`}
              />
            </button>
          </div>

          {/* コンテンツ - 右側 */}
          <div className="flex-1 p-3">
            <div className="flex items-start gap-2 mb-1">
              <span className="text-sm font-bold break-words">{facility.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-yellow-400 text-xs">★</span>
                <span className="text-xs">{facility.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-500">({facility.reviewCount})</span>
              </div>
            </div>

            {/* タグ（N回以上勤務を先頭に、他タグは赤） */}
            <div className="flex flex-wrap gap-1 mb-2">
              {job.effectiveWeeklyFrequency && (
                <Badge variant="purple" className="text-[10px] px-1.5 py-0.5">
                  {job.effectiveWeeklyFrequency}回以上勤務
                </Badge>
              )}
              {job.tags.map((tag) => (
                <Badge key={tag} variant="red" className="text-[10px] px-1.5 py-0.5">
                  {tag}
                </Badge>
              ))}
            </div>

            <h3 className="text-sm mb-2 line-clamp-2">
              {job.title}
            </h3>

            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{job.startTime}-{job.endTime}</span>
              <div className="text-sm flex items-center gap-2">
                <span className="text-gray-600 text-xs">（時給{job.hourlyWage.toLocaleString()}円）</span>
                <span className="text-red-500 font-bold text-lg">{job.wage.toLocaleString()}円</span>
              </div>
            </div>

            <div className="flex justify-end mb-2">
              <span className={`inline-block text-xs px-2 py-1 rounded ${isUrgent
                ? 'bg-red-500 text-white'
                : 'bg-gray-300 text-gray-800'
                }`}>
                締切まで{deadlineText}
              </span>
            </div>

            <div className="text-xs text-gray-600 mb-1">
              {(job.prefecture || job.city || job.addressLine)
                ? `${job.prefecture || ''}${job.city || ''}${job.addressLine || ''}`
                : job.address}
            </div>

            <div className="text-xs text-gray-600">
              {job.access}
            </div>
          </div>
        </div>

        {/* モバイル版: 縦並びレイアウト */}
        <div className="md:hidden flex flex-col h-full">
          {/* 画像 */}
          <div className="relative w-full aspect-[4/3] flex-shrink-0">
            <Image
              src={jobImage}
              alt={facility.name}
              fill
              className={`object-cover ${shouldShowUnavailable ? 'opacity-60 grayscale' : ''}`}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgIBAwQDAAAAAAAAAAAAAQIDBAAFERIGEyExQVFh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwAAhEDEQA/A/8A0="
              priority={priority}
            />
            {/* 面接ありバッジ - 画像左上 */}
            {job.requiresInterview && (
              <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-10">
                審査あり
              </span>
            )}
            {shouldShowUnavailable && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">
                  {unavailableReason || '募集終了'}
                </span>
              </div>
            )}
            <button
              onClick={handleBookmark}
              className="absolute top-2 right-2"
            >
              <Bookmark
                className={`w-5 h-5 ${isBookmarked
                  ? 'fill-blue-500 text-blue-500'
                  : 'text-white'
                  }`}
              />
            </button>
          </div>

          {/* コンテンツ - 下側 */}
          <div className="p-2 flex flex-col flex-1">
            <div className="flex items-start gap-1 mb-1">
              <span className="text-xs font-bold break-words flex-1 line-clamp-1">{facility.name}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <span className="text-yellow-400 text-[10px]">★</span>
                <span className="text-[10px]">{facility.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* タグ（N回以上勤務を先頭に、他タグは赤） */}
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

            <h3 className="text-xs mb-1 line-clamp-2 min-h-[2rem]">
              {job.title}
            </h3>

            <div className="text-xs text-gray-600 mb-1">
              {job.startTime}-{job.endTime}
            </div>

            <div className="flex items-center justify-end gap-1 mb-1">
              <span className="text-[10px] text-gray-600">時給{job.hourlyWage.toLocaleString()}円</span>
              <span className="text-red-500 font-bold text-sm">{job.wage.toLocaleString()}円</span>
            </div>

            <div className="flex justify-end mb-1">
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${isUrgent
                ? 'bg-red-500 text-white'
                : 'bg-gray-300 text-gray-800'
                }`}>
                締切まで{deadlineText}
              </span>
            </div>

            {/* 住所・アクセス情報 */}
            <div className="mt-auto pt-1 border-t border-gray-100">
              <div className="text-[10px] text-gray-500 line-clamp-1">
                {(job.prefecture || job.city || job.addressLine)
                  ? `${job.prefecture || ''}${job.city || ''}${job.addressLine || ''}`
                  : job.address}
              </div>
              <div className="text-[10px] text-gray-500 line-clamp-1">
                {job.access}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export const JobCard = memo(JobCardComponent);
