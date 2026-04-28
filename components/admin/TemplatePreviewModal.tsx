'use client';

import { X } from 'lucide-react';
import { JobDetailClient } from '@/components/job/JobDetailClient';
import { calculateDailyWage, calculateWorkingHours, calculateTransportationFee } from '@/utils/salary';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateData: {
    name: string;
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

export function TemplatePreviewModal({ isOpen, onClose, templateData, facilityData }: TemplatePreviewModalProps) {
  if (!isOpen) return null;

  // テンプレートでは交通費は確定しないため、プレビュー用に勤務時間から自動計算した値を表示
  const previewWorkingMinutes =
    calculateWorkingHours(templateData.startTime, templateData.endTime, templateData.breakTime) * 60;
  const previewTransportationFee = calculateTransportationFee(previewWorkingMinutes);

  // 日給計算
  const dailyWage = calculateDailyWage(
    templateData.startTime,
    templateData.endTime,
    templateData.breakTime,
    templateData.hourlyWage,
    previewTransportationFee
  );

  // プレビュー用のダミーデータを構築（JobPreviewModalと同じ形式）
  const previewJob = {
    id: 0,
    title: templateData.title || '（タイトル未設定）',
    // snake_case（データベース形式）
    start_time: templateData.startTime,
    end_time: templateData.endTime,
    break_time: templateData.breakTime,
    hourly_wage: templateData.hourlyWage,
    transportation_fee: previewTransportationFee,
    recruitment_count: templateData.recruitmentCount,
    work_content: templateData.workContent,
    dresscode_images: templateData.dresscodeImages || [],
    // camelCase（JobDetailClientが使用）
    startTime: templateData.startTime,
    endTime: templateData.endTime,
    breakTime: templateData.breakTime,
    hourlyWage: templateData.hourlyWage,
    transportationFee: previewTransportationFee,
    recruitmentCount: templateData.recruitmentCount,
    workContent: templateData.workContent,
    dresscodeImages: templateData.dresscodeImages || [],
    // その他のプロパティ
    description: templateData.jobDescription,
    overview: templateData.jobDescription,
    qualifications: templateData.qualifications,
    requiredQualifications: templateData.qualifications,
    skills: templateData.skills,
    requiredExperience: templateData.skills,
    dresscode: templateData.dresscode,
    belongings: templateData.belongings,
    tags: templateData.icons,
    images: templateData.images.length > 0 ? templateData.images : ['/images/samples/job_default_noimage.png'],
    attachments: templateData.attachments || [],
    status: 'published',
    requiresInterview: false,
    badges: [],
    wage: dailyWage,
    address: facilityData.address,
    prefecture: facilityData.prefecture || '',
    city: facilityData.city || '',
    addressLine: '',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    appliedCount: 0,
    matchedCount: 0,
    // テンプレートには勤務日がないのでダミーで1日分を追加
    workDates: [{
      id: 1,
      work_date: new Date(),
      workDate: new Date().toISOString().split('T')[0],
      recruitmentCount: templateData.recruitmentCount,
      appliedCount: 0,
      matchedCount: 0,
    }],
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
    name: facilityData.facilityName,
    address: facilityData.address,
    prefecture: facilityData.prefecture || '',
    city: facilityData.city || '',
    service_type: facilityData.serviceType || '介護施設',
    type: facilityData.serviceType || '介護施設',
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
          <div>
            <h2 className="text-lg font-bold text-gray-900">テンプレートプレビュー</h2>
            <p className="text-xs text-gray-500">{templateData.name || '（テンプレート名未設定）'}</p>
          </div>
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
