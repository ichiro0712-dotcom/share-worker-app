import { Suspense } from 'react';
import { getJobs } from '@/src/lib/actions';
import { JobListClient } from '@/components/job/JobListClient';

// キャッシュを無効化して常に最新のデータを取得
export const dynamic = 'force-dynamic';

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
  };

  const jobsData = await getJobs(jobSearchParams);

  // DBのデータをフロントエンドの型に変換（既に文字列化済み）
  const jobs = jobsData.map((job) => {
    // DBのBooleanから移動手段配列を生成
    const transportMethods = [
      { name: '車', available: job.allow_car },
      { name: 'バイク', available: job.allow_bike },
      { name: '自転車', available: job.allow_bicycle },
      { name: '電車', available: job.allow_public_transit },
      { name: 'バス', available: job.allow_public_transit },
      { name: '徒歩', available: job.allow_public_transit },
    ];

    // DBのBooleanから特徴タグ配列を生成
    const featureTags = [
      job.no_bathing_assist && '入浴介助なし',
      job.has_driver && '送迎ドライバーあり',
      job.hair_style_free && '髪型・髪色自由',
      job.nail_ok && 'ネイルOK',
      job.uniform_provided && '制服貸与',
      job.inexperienced_ok && '介護業務未経験歓迎',
      job.beginner_ok && 'SWORK初心者歓迎',
      job.facility_within_5years && '施設オープン5年以内',
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
        workDate: wd.work_date ? wd.work_date.split('T')[0] : '',
        deadline: wd.deadline,
        appliedCount: wd.applied_count,
        recruitmentCount: wd.recruitment_count,
      })) || [],
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
      mapImage: '/images/map-placeholder.png',
      transportMethods,
      parking: job.has_parking,
      accessDescription: job.access,
      featureTags,
      requiresInterview: job.requires_interview,
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
      <JobListClient jobs={jobs} facilities={facilities} />
    </Suspense>
  );
}
