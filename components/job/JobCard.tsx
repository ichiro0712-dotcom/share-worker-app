'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Bookmark } from 'lucide-react';
import { Job } from '@/types/job';
import { Facility } from '@/types/facility';
import { Badge } from '@/components/ui/Badge';
import { getDeadlineText } from '@/utils/date';
import { useState } from 'react';

interface JobCardProps {
  job: Job;
  facility: Facility;
}

export const JobCard: React.FC<JobCardProps> = ({ job, facility }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    alert('未定：ブックマーク機能はPhase 2で実装予定です');
    setIsBookmarked(!isBookmarked);
  };

  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        {/* 画像 */}
        <div className="relative w-full h-32">
          <Image
            src={job.images[0]}
            alt={facility.name}
            fill
            className="object-cover"
          />
          <div className="absolute top-2 left-2 flex gap-1">
            {job.tags.map((tag) => (
              <Badge key={tag} variant="primary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
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

        {/* コンテンツ */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold">{facility.name}</span>
            <div className="flex items-center gap-1">
              <span className="text-yellow-400 text-xs">★</span>
              <span className="text-xs">{facility.rating}点</span>
              <span className="text-xs text-gray-500">({facility.reviewCount}件)</span>
            </div>
          </div>

          <h3 className="text-sm mb-2 line-clamp-2">
            {job.title}
          </h3>

          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">{job.startTime}-{job.endTime}</span>
            <div className="text-sm">
              <span className="text-red-500 font-bold text-lg">{job.wage.toLocaleString()}円</span>
              <span className="text-gray-600 text-xs">（時給{job.hourlyWage.toLocaleString()}円）</span>
            </div>
          </div>

          <div className="flex justify-end mb-2">
            <span className="inline-block bg-red-500 text-white text-xs px-2 py-1 rounded">
              締切まで{getDeadlineText(job.deadline)}
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
    </Link>
  );
};
