import { getJobById, getJobs, hasUserAppliedForJob, getFacilityReviews, getUserApplicationStatuses, getUserScheduledJobs, getFacilityInterviewPassRate } from '@/src/lib/actions';
import { JobDetailClient } from '@/components/job/JobDetailClient';
import JobDetailTracker from '@/components/tracking/JobDetailTracker';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { DEBUG_TIME_COOKIE_NAME, parseDebugTimeCookie, getCurrentTimeFromSettings } from '@/utils/debugTime.server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canApplyByGender } from '@/src/lib/jobGenderMatching';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; preview?: string }>;
}

export default async function JobDetail({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { date: selectedDate, preview } = await searchParams;
  const isPreviewMode = preview === 'true';

  // デバッグ時刻をCookieから取得
  const cookieStore = cookies();
  const debugTimeCookie = cookieStore.get(DEBUG_TIME_COOKIE_NAME);
  const debugTimeSettings = parseDebugTimeCookie(debugTimeCookie?.value);
  const currentTime = getCurrentTimeFromSettings(debugTimeSettings);

  // 並列でデータを取得（デバッグ時刻対応）
  const [jobData, allJobsData, initialHasApplied, appliedWorkDateIds, scheduledJobs] = await Promise.all([
    getJobById(id, { currentTime }),
    getJobs(undefined, { currentTime }),
    hasUserAppliedForJob(id),
    getUserApplicationStatuses(id),
    getUserScheduledJobs(),
  ]);

  if (!jobData) {
    notFound();
  }

  // 同じ施設の他の求人を抽出
  const relatedJobsData = allJobsData.filter(
    (j) => j.facility_id === jobData.facility_id && j.id !== jobData.id
  );

  // DBのBooleanから移動手段配列を生成
  const transportMethods = [
    { name: '車', available: jobData.allow_car },
  ];

  // DBのBooleanから特徴タグ配列を生成（7項目のみ）
  const featureTags = [
    jobData.inexperienced_ok && '未経験者歓迎',
    jobData.blank_ok && 'ブランク歓迎',
    jobData.hair_style_free && '髪型・髪色自由',
    jobData.nail_ok && 'ネイルOK',
    jobData.uniform_provided && '制服貸与',
    jobData.allow_car && '車通勤OK',
    jobData.meal_support && '食事補助',
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
      isRecruitmentClosed: wd.isRecruitmentClosed || wd.is_recruitment_closed || false,
    })) || [],
    startTime: jobData.start_time,
    endTime: jobData.end_time,
    breakTime: jobData.break_time,
    wage: jobData.wage,
    hourlyWage: jobData.hourly_wage,
    deadline: jobData.deadline,
    tags: jobData.tags,
    address: jobData.address,
    prefecture: jobData.prefecture,
    city: jobData.city,
    addressLine: jobData.address_line,
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
    // 施設の責任者情報を優先、なければ求人の担当者情報を使用
    managerName: jobData.facility.staff_same_as_manager
      ? (jobData.facility.manager_last_name && jobData.facility.manager_first_name
        ? `${jobData.facility.manager_last_name} ${jobData.facility.manager_first_name}`
        : jobData.manager_name)
      : (jobData.facility.staff_last_name && jobData.facility.staff_first_name
        ? `${jobData.facility.staff_last_name} ${jobData.facility.staff_first_name}`
        : jobData.manager_name),
    managerMessage: jobData.facility.staff_greeting || jobData.manager_message || '',
    managerAvatar: jobData.facility.staff_photo || jobData.manager_avatar || '👤',
    images: jobData.images,
    badges: [],
    mapImage: jobData.facility.map_image || null,
    transportMethods,
    accessDescription: jobData.access,
    featureTags,
    attachments: jobData.attachments || [],
    // 募集条件
    weeklyFrequency: jobData.weekly_frequency,
    effectiveWeeklyFrequency: jobData.effectiveWeeklyFrequency,
    requiresInterview: jobData.requires_interview,
    // 求人種別（オファー対応）
    jobType: jobData.job_type as 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'OFFER' | 'ORIENTATION',
    targetWorkerId: jobData.target_worker_id,
    // 募集完了フラグ
    isRecruitmentClosed: jobData.isRecruitmentClosed || false,
    // 性別指定
    genderRequirement: jobData.gender_requirement || null,
  };

  // 性別指定による応募可否判定（サーバー側）
  const session = await getServerSession(authOptions);
  let genderApplyResult: { allowed: boolean; reason?: string } = { allowed: true };
  if (session?.user?.id) {
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id, 10) },
      select: { gender: true },
    });
    genderApplyResult = canApplyByGender(jobData.gender_requirement, currentUser?.gender);
  } else if (jobData.gender_requirement) {
    // 未ログインかつ性別指定ありの求人
    genderApplyResult = canApplyByGender(jobData.gender_requirement, null);
  }

  const facility = {
    id: jobData.facility.id,
    name: jobData.facility.facility_name,
    corporationName: jobData.facility.corporation_name,
    type: jobData.facility.facility_type,
    address: jobData.facility.address,
    prefecture: jobData.facility.prefecture,
    city: jobData.facility.city,
    addressLine: jobData.facility.address_line,
    lat: jobData.facility.lat,
    lng: jobData.facility.lng,
    description: jobData.facility.description || '',
    images: jobData.facility.images,
    rating: jobData.facility.rating,
    reviewCount: jobData.facility.review_count,
    // アクセス情報（施設から取得）
    stations: jobData.facility.stations || [],
    accessDescription: jobData.facility.access_description || '',
    transportation: jobData.facility.transportation || [],
    parking: jobData.facility.parking || '',
    transportationNote: jobData.facility.transportation_note || '',
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
    prefecture: relatedJob.prefecture,
    city: relatedJob.city,
    addressLine: relatedJob.address_line,
    access: relatedJob.access,
    recruitmentCount: relatedJob.recruitment_count,
    appliedCount: relatedJob.applied_count,
    transportationFee: relatedJob.transportation_fee,
  }));

  // 施設のレビューを取得
  const facilityReviews = await getFacilityReviews(jobData.facility_id);

  // 審査あり求人の場合、面接通過率を取得（当月）
  let interviewPassRate = null;
  if (jobData.requires_interview) {
    interviewPassRate = await getFacilityInterviewPassRate(jobData.facility_id, 'current');
  }

  return (
    <>
      <JobDetailTracker jobId={jobData.id} />
      <JobDetailClient
        job={job}
        facility={facility}
        relatedJobs={relatedJobs}
        facilityReviews={facilityReviews}
        initialHasApplied={initialHasApplied}
        initialAppliedWorkDateIds={appliedWorkDateIds}
        selectedDate={selectedDate}
        isPreviewMode={isPreviewMode}
        scheduledJobs={scheduledJobs}
        interviewPassRate={interviewPassRate}
        genderApplyResult={genderApplyResult}
      />
    </>
  );
}
