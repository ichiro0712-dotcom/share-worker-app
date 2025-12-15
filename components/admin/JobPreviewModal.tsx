'use client';

import { X } from 'lucide-react';
import { JobDetailClient } from '@/components/job/JobDetailClient';
import { calculateDailyWage } from '@/utils/salary';

interface JobPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobData: {
    title: string;
    startTime: string;
    endTime: string;
    breakTime: number;
    hourlyWage: number;
    transportationFee: number;
    recruitmentCount: number;
    workContent: string[];
    jobDescription: string;
    qualifications: string[];
    skills: string[];
    dresscode: string[];
    belongings: string[];
    icons: string[];
    images: string[];
    dresscodeImages?: string[];
    attachments?: string[];
    selectedDates: string[];
    requiresInterview?: boolean;
  };
  facilityData: {
    id: number;
    facilityName: string;
    address: string;
    prefecture?: string;
    city?: string;
    serviceType?: string;
    mapImage?: string | null;
    managerName?: string;
    managerPhoto?: string | null;
    managerGreeting?: string | null;
  };
}

export function JobPreviewModal({ isOpen, onClose, jobData, facilityData }: JobPreviewModalProps) {
  if (!isOpen) return null;

  // 日給計算
  const dailyWage = calculateDailyWage(
    jobData.startTime,
    jobData.endTime,
    jobData.breakTime,
    jobData.hourlyWage,
    jobData.transportationFee
  );

  // プレビュー用のダミーデータを構築
  const previewJob = {
    id: 0,
    title: jobData.title || '（タイトル未設定）',
    // snake_case（データベース形式）
    start_time: jobData.startTime,
    end_time: jobData.endTime,
    break_time: jobData.breakTime,
    hourly_wage: jobData.hourlyWage,
    transportation_fee: jobData.transportationFee,
    recruitment_count: jobData.recruitmentCount,
    work_content: jobData.workContent,
    dresscode_images: jobData.dresscodeImages || [],
    // camelCase（JobDetailClientが使用）
    startTime: jobData.startTime,
    endTime: jobData.endTime,
    breakTime: jobData.breakTime,
    hourlyWage: jobData.hourlyWage,
    transportationFee: jobData.transportationFee,
    recruitmentCount: jobData.recruitmentCount,
    workContent: jobData.workContent,
    dresscodeImages: jobData.dresscodeImages || [],
    // その他のプロパティ
    description: jobData.jobDescription,
    overview: jobData.jobDescription, // overviewとして使用
    qualifications: jobData.qualifications,
    requiredQualifications: jobData.qualifications, // JobDetailClientが使用
    skills: jobData.skills,
    requiredExperience: jobData.skills, // JobDetailClientが使用
    dresscode: jobData.dresscode,
    belongings: jobData.belongings,
    tags: jobData.icons,
    images: jobData.images.length > 0 ? jobData.images : ['/images/anken.png'],
    attachments: jobData.attachments || [],
    status: 'published',
    requiresInterview: jobData.requiresInterview || false,
    badges: [],
    // 日給・給与
    wage: dailyWage,
    // 住所情報
    address: facilityData.address,
    prefecture: facilityData.prefecture || '',
    city: facilityData.city || '',
    addressLine: '',
    // 締切（7日後）
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    // カウント（プレビュー用）
    appliedCount: 0,
    matchedCount: 0,
    // 勤務日データ
    workDates: jobData.selectedDates.map((date, index) => ({
      id: index + 1,
      work_date: new Date(date),
      workDate: date, // JobDetailClientが使用
      recruitmentCount: jobData.recruitmentCount,
      appliedCount: 0,
      matchedCount: 0,
    })),
    // 募集期間（プレビュー用のダミー）
    recruitment_start: new Date(),
    recruitment_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    // 担当者情報（施設から取得）
    managerName: facilityData.managerName || '担当者',
    managerAvatar: facilityData.managerPhoto || '👤',
    managerMessage: facilityData.managerGreeting || 'よろしくお願いいたします。',
  };

  const previewFacility = {
    id: facilityData.id,
    facility_name: facilityData.facilityName,
    name: facilityData.facilityName, // JobDetailClientが使用
    address: facilityData.address,
    prefecture: facilityData.prefecture || '',
    city: facilityData.city || '',
    service_type: facilityData.serviceType || '介護施設',
    type: facilityData.serviceType || '介護施設', // JobDetailClientが使用
    map_image: facilityData.mapImage || null,
    description: '',
    access_info: '',
    nearby_station: '',
    averageRating: 0,
    totalReviews: 0,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div className="relative w-full max-w-md h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">求人プレビュー</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 求人詳細（スクロール可能） */}
        <div className="flex-1 overflow-y-auto">
          <JobDetailClient
            job={previewJob}
            facility={previewFacility}
            relatedJobs={[]}
            facilityReviews={[]}
            initialHasApplied={false}
            initialAppliedWorkDateIds={[]}
            isPreviewMode={true}
          />
        </div>
      </div>
    </div>
  );
}
