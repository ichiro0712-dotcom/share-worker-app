import { getJobById, getJobs, hasUserAppliedForJob, getFacilityReviews, getUserApplicationStatuses } from '@/src/lib/actions';
import { JobDetailClient } from '@/components/job/JobDetailClient';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function JobDetail({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { date: selectedDate } = await searchParams;
  const jobData = await getJobById(id);

  if (!jobData) {
    notFound();
  }

  // 同じ施設の他の求人を取得
  const allJobsData = await getJobs();
  const relatedJobsData = allJobsData.filter(
    (j) => j.facility_id === jobData.facility_id && j.id !== jobData.id
  );

  // DBのBooleanから移動手段配列を生成
  const transportMethods = [
    { name: '車', available: jobData.allow_car },
    { name: 'バイク', available: jobData.allow_bike },
    { name: '自転車', available: jobData.allow_bicycle },
    { name: '電車', available: jobData.allow_public_transit },
    { name: 'バス', available: jobData.allow_public_transit },
    { name: '徒歩', available: jobData.allow_public_transit },
  ];

  // DBのBooleanから特徴タグ配列を生成
  const featureTags = [
    jobData.no_bathing_assist && '入浴介助なし',
    jobData.has_driver && '送迎ドライバーあり',
    jobData.hair_style_free && '髪型・髪色自由',
    jobData.nail_ok && 'ネイルOK',
    jobData.uniform_provided && '制服貸与',
    jobData.inexperienced_ok && '介護業務未経験歓迎',
    jobData.beginner_ok && 'SWORK初心者歓迎',
    jobData.facility_within_5years && '施設オープン5年以内',
  ].filter(Boolean) as string[];

  // DBのデータをフロントエンドの型に変換（既に文字列化済み）
  const job = {
    id: jobData.id,
    status: jobData.status.toLowerCase() as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
    facilityId: jobData.facility_id,
    title: jobData.title,
    workDate: jobData.work_date ? jobData.work_date.split('T')[0] : '',
    // 全ての勤務日情報を含める
    workDates: jobData.workDates?.map((wd: any) => ({
      id: wd.id,
      workDate: wd.work_date ? wd.work_date.split('T')[0] : '',
      deadline: wd.deadline,
      appliedCount: wd.applied_count,
      matchedCount: wd.matched_count,
      recruitmentCount: wd.recruitment_count,
    })) || [],
    startTime: jobData.start_time,
    endTime: jobData.end_time,
    breakTime: jobData.break_time,
    wage: jobData.wage,
    hourlyWage: jobData.hourly_wage,
    deadline: jobData.deadline,
    tags: jobData.tags,
    address: jobData.address,
    access: jobData.access,
    recruitmentCount: jobData.recruitment_count,
    appliedCount: jobData.applied_count,
    matchedCount: jobData.matched_count,
    transportationFee: jobData.transportation_fee,
    overview: jobData.overview,
    workContent: jobData.work_content,
    requiredQualifications: jobData.required_qualifications,
    requiredExperience: jobData.required_experience,
    dresscode: jobData.dresscode,
    dresscodeImages: jobData.dresscode_images || [],
    belongings: jobData.belongings,
    managerName: jobData.manager_name,
    managerMessage: jobData.manager_message || '',
    managerAvatar: jobData.manager_avatar || '👤',
    images: jobData.images,
    badges: [],
    mapImage: jobData.facility.map_image || '/images/map-placeholder.png',
    transportMethods,
    parking: jobData.has_parking,
    accessDescription: jobData.access,
    featureTags,
    attachments: jobData.attachments || [],
    // 募集条件
    weeklyFrequency: jobData.weekly_frequency,
    monthlyCommitment: jobData.monthly_commitment,
  };

  const facility = {
    id: jobData.facility.id,
    name: jobData.facility.facility_name,
    corporationName: jobData.facility.corporation_name,
    type: jobData.facility.facility_type,
    address: jobData.facility.address,
    lat: jobData.facility.lat,
    lng: jobData.facility.lng,
    phoneNumber: jobData.facility.phone_number,
    description: jobData.facility.description || '',
    images: jobData.facility.images,
    rating: jobData.facility.rating,
    reviewCount: jobData.facility.review_count,
  };

  const relatedJobs = relatedJobsData.map((relatedJob) => ({
    id: relatedJob.id,
    status: relatedJob.status.toLowerCase() as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
    facilityId: relatedJob.facility_id,
    title: relatedJob.title,
    workDate: relatedJob.work_date ? relatedJob.work_date.split('T')[0] : '',
    startTime: relatedJob.start_time,
    endTime: relatedJob.end_time,
    breakTime: relatedJob.break_time,
    wage: relatedJob.wage,
    hourlyWage: relatedJob.hourly_wage,
    deadline: relatedJob.deadline,
    tags: relatedJob.tags,
    address: relatedJob.address,
    access: relatedJob.access,
    recruitmentCount: relatedJob.recruitment_count,
    appliedCount: relatedJob.applied_count,
    transportationFee: relatedJob.transportation_fee,
  }));

  // 施設のレビューを取得
  const facilityReviews = await getFacilityReviews(jobData.facility_id);

  // ユーザーが既に応募済みかチェック
  const initialHasApplied = await hasUserAppliedForJob(id);
  const appliedWorkDateIds = await getUserApplicationStatuses(id);

  return (
    <JobDetailClient
      job={job}
      facility={facility}
      relatedJobs={relatedJobs}
      facilityReviews={facilityReviews}
      initialHasApplied={initialHasApplied}
      initialAppliedWorkDateIds={appliedWorkDateIds}
      selectedDate={selectedDate}
    />
  );
}
