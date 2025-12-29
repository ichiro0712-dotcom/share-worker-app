'use client';

import { AlertTriangle, Star } from 'lucide-react';

export interface ReviewCardProps {
  applicationId: number;
  userName: string;
  userProfileImage: string | null;
  jobTitle: string;
  workDate: string;
  startTime: string;
  endTime: string;
  daysSinceWork: number;
  onSelect: () => void;
  buttonText?: string;
  buttonColor?: 'blue' | 'yellow';
}

export function ReviewCard({
  userName,
  userProfileImage,
  jobTitle,
  workDate,
  startTime,
  endTime,
  daysSinceWork,
  onSelect,
  buttonText = 'レビューを入力',
  buttonColor = 'blue',
}: ReviewCardProps) {
  const isOverdue = daysSinceWork >= 3;

  const buttonStyles = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
  };

  return (
    <div
      className={`bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow ${
        isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* 左側: プロフィール画像 + 情報 */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* プロフィール画像 */}
          <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-gray-100 shadow-sm">
            {userProfileImage ? (
              <img src={userProfileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                {userName.charAt(0)}
              </div>
            )}
          </div>

          {/* 情報 */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{userName}</span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-red-600 text-xs bg-red-100 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3" />
                  {daysSinceWork}日経過
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 font-medium truncate">{jobTitle}</p>
            <p className="text-xs text-gray-500">
              {new Date(workDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })} {startTime}-{endTime}
            </p>
          </div>
        </div>

        {/* 右側: レビューボタン */}
        <button
          onClick={onSelect}
          className={`px-4 py-2.5 ${buttonStyles[buttonColor]} text-white text-sm font-medium rounded-lg flex items-center gap-1.5 flex-shrink-0 shadow-sm`}
        >
          <Star className="w-4 h-4" />
          {buttonText}
        </button>
      </div>
    </div>
  );
}
