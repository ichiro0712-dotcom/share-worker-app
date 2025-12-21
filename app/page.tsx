import { Suspense } from 'react';
import { getJobsListWithPagination } from '@/src/lib/actions';
import { JobListClient } from '@/components/job/JobListClient';
import { generateDates } from '@/utils/date';

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

  // 配列パラメータを正規化する関数
  const normalizeArray = (value: string | string[] | undefined): string[] | undefined => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  };

  // クエリパラメータを検索パラメータに変換
  const jobSearchParams = {
    query: params.query,
    prefecture: params.prefecture,
    city: params.city,
    minWage: params.minWage ? parseInt(params.minWage, 10) : undefined,
    serviceTypes: normalizeArray(params.serviceType),
    transportations: normalizeArray(params.transportation),
    otherConditions: normalizeArray(params.otherCondition),
    jobTypes: normalizeArray(params.jobType),
    workTimeTypes: normalizeArray(params.workTimeType),
    // 時間帯パラメータ
    timeRangeFrom: params.timeRangeFrom,
    timeRangeTo: params.timeRangeTo,
    // 距離検索パラメータ
    distanceKm: params.distanceKm ? parseFloat(params.distanceKm) : undefined,
    distanceLat: params.distanceLat ? parseFloat(params.distanceLat) : undefined,
    distanceLng: params.distanceLng ? parseFloat(params.distanceLng) : undefined,
  };

  const page = params.page ? parseInt(params.page, 10) : 1;
  const dateIndex = params.dateIndex ? parseInt(params.dateIndex, 10) : 0;
  const sort = params.sort;

  // 日付フィルター用のDateオブジェクト生成
  const dates = generateDates(90);
  const targetDate = dates[dateIndex]; // dateIndexが範囲外の場合はundefined

  const { jobs: jobsData, pagination } = await getJobsListWithPagination(
    jobSearchParams,
    {
      page,
      limit: 20,
      targetDate,
      sort
    }
  );

  // DBのデータをフロントエンドの型に変換（既に文字列化済み）
  const jobs = jobsData.map((job) => {
    // DBのBooleanから移動手段配列を生成
    const transportMethods = [
      { name: '車', available: job.allow_car },
    ];

    // DBのBooleanから特徴タグ配列を生成（7項目のみ）
    const featureTags = [
      job.inexperienced_ok && '未経験者歓迎',
      job.blank_ok && 'ブランク歓迎',
      job.hair_style_free && '髪型・髪色自由',
      job.nail_ok && 'ネイルOK',
      job.uniform_provided && '制服貸与',
      job.allow_car && '車通勤OK',
      job.meal_support && '食事補助',
    ].filter(Boolean) as string[];

    return {
      id: job.id,
      status: job.status.toLowerCase() as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
      facilityId: job.facility_id,
      title: job.title,
      workDate: job.work_date ? job.work_date.split('T')[0] : '',
      // 全ての勤務日情報を含める
      workDates: job.workDates?.map((wd: any) => ({
        id: wd.id,
        workDate: wd.workDate || (wd.work_date ? wd.work_date.split('T')[0] : ''),
        deadline: wd.deadline,
        appliedCount: wd.applied_count,
        recruitmentCount: wd.recruitment_count,
        // 応募可否情報
        canApply: wd.canApply,
        isApplied: wd.isApplied,
        isFull: wd.isFull,
        hasTimeConflict: wd.hasTimeConflict,
      })) || [],
      hasAvailableWorkDate: job.hasAvailableWorkDate,
      startTime: job.start_time,
      endTime: job.end_time,
      breakTime: job.break_time,
      wage: job.wage,
      hourlyWage: job.hourly_wage,
      deadline: job.deadline,
      tags: job.tags,
      address: job.address,
      access: job.access,
      recruitmentCount: job.recruitment_count,
      appliedCount: job.applied_count,
      matchedCount: job.matched_count,
      transportationFee: job.transportation_fee,
      overview: job.overview,
      workContent: job.work_content,
      requiredQualifications: job.required_qualifications,
      requiredExperience: job.required_experience,
      dresscode: job.dresscode,
      belongings: job.belongings,
      managerName: job.manager_name,
      managerMessage: job.manager_message || '',
      managerAvatar: job.manager_avatar || '👤',
      images: job.images,
      badges: [],
      otherConditions: [],
      mapImage: job.facility?.map_image || null,
      transportMethods,
      accessDescription: job.access,
      featureTags,
      requiresInterview: job.requires_interview,
      // N回以上勤務条件
      weeklyFrequency: job.weekly_frequency,
      effectiveWeeklyFrequency: job.effectiveWeeklyFrequency,
      availableWorkDateCount: job.availableWorkDateCount,
    };
  });

  const facilities = jobsData.map((job) => ({
    id: job.facility.id,
    name: job.facility.facility_name,
    corporationName: job.facility.corporation_name,
    type: job.facility.facility_type,
    address: job.facility.address,
    lat: job.facility.lat,
    lng: job.facility.lng,
    phoneNumber: job.facility.phone_number,
    description: job.facility.description || '',
    images: job.facility.images,
    rating: job.facility.rating,
    reviewCount: job.facility.review_count,
  }));

  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <JobListClient
        jobs={jobs}
        facilities={facilities}
        pagination={pagination}
      />
    </Suspense>
  );
}
