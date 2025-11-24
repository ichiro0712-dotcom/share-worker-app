'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Bookmark } from 'lucide-react';
import { Job } from '@/types/job';
import { Facility } from '@/types/facility';
import { Badge } from '@/components/ui/badge';
import { getDeadlineText, isDeadlineUrgent } from '@/utils/date';
import { useState, useEffect } from 'react';
import { addJobBookmark, removeJobBookmark, isJobBookmarked } from '@/src/lib/actions';

interface JobCardProps {
  job: Job;
  facility: Facility;
}

export const JobCard: React.FC<JobCardProps> = ({ job, facility }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setMounted(true);
    // ブックマーク状態を取得
    isJobBookmarked(String(job.id), 'WATCH_LATER').then(setIsBookmarked);
  }, [job.id]);

  const isUrgent = mounted ? isDeadlineUrgent(job.deadline) : false;
  const deadlineText = mounted ? getDeadlineText(job.deadline) : '計算中...';

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

  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        {/* PC版: 横並びレイアウト */}
        <div className="hidden md:flex">
          {/* 画像 - 長方形 */}
          <div className="relative w-48 h-40 flex-shrink-0">
            <Image
              src={job.images[0]}
              alt={facility.name}
              fill
              className="object-cover"
            />
            <button
              onClick={handleBookmark}
              className="absolute top-2 right-2"
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isBookmarked
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

            {/* タグ */}
            <div className="flex gap-1 mb-2">
              {job.tags.map((tag) => (
                <Badge key={tag} variant="yellow" className="text-[10px] px-1.5 py-0.5">
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
              <span className={`inline-block text-xs px-2 py-1 rounded ${
                isUrgent
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-300 text-gray-800'
              }`}>
                締切まで{deadlineText}
              </span>
            </div>

            <div className="text-xs text-gray-600 mb-1">
              {job.address}
            </div>

            <div className="text-xs text-gray-600">
              {job.access}
            </div>
          </div>
        </div>

        {/* モバイル版: 縦並びレイアウト */}
        <div className="md:hidden">
          {/* 画像 */}
          <div className="relative w-full h-32">
            <Image
              src={job.images[0]}
              alt={facility.name}
              fill
              className="object-cover"
            />
            <button
              onClick={handleBookmark}
              className="absolute top-2 right-2"
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isBookmarked
                    ? 'fill-blue-500 text-blue-500'
                    : 'text-white'
                }`}
              />
            </button>
          </div>

          {/* コンテンツ - 下側 */}
          <div className="p-2">
            <div className="flex items-start gap-1 mb-1">
              <span className="text-xs font-bold break-words flex-1">{facility.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-yellow-400 text-xs">★</span>
                <span className="text-xs">{facility.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-500">({facility.reviewCount})</span>
              </div>
            </div>

            {/* タグ */}
            <div className="flex gap-1 mb-1">
              {job.tags.map((tag) => (
                <Badge key={tag} variant="yellow" className="text-[9px] px-1 py-0.5">
                  {tag}
                </Badge>
              ))}
            </div>

            <h3 className="text-xs mb-1 line-clamp-2 h-8">
              {job.title}
            </h3>

            <div className="text-xs text-gray-600 mb-1">
              {job.startTime}-{job.endTime}
            </div>

            <div className="flex items-center justify-end gap-1 mb-1">
              <span className="text-xs text-gray-600">（時給{job.hourlyWage.toLocaleString()}円）</span>
              <span className="text-red-500 font-bold text-sm">{job.wage.toLocaleString()}円</span>
            </div>

            <div className="flex justify-end">
              <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                isUrgent
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-300 text-gray-800'
              }`}>
                締切まで{deadlineText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
