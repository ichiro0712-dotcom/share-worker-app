import { Suspense } from 'react';
import { JobListClient } from '@/components/job/JobListClient';
import { getJobsListWithPagination } from '@/src/lib/actions';
import { generateDatesFromBase } from '@/utils/date';
import { getCurrentTime } from '@/utils/debugTime';
import PublicJobsTracker from '@/components/tracking/PublicJobsTracker';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '求人一覧 | +タスタス - 看護師・介護士の単発バイト',
  description: '看護師・介護士向けの単発バイト・スポットワーク求人一覧。日付・エリア・時給で簡単検索。会員登録不要で求人を閲覧できます。',
};

/**
 * 公開求人検索ページ（認証不要）
 *
 * ログイン後の求人一覧（app/page.tsx）と同じ機能を提供するが、
 * - ブックマーク非表示
 * - リストタイプ切替（限定/オファー）非表示
 * - 求人カードタップ → /public/jobs/[id] に遷移
 * - 公開レイアウト（CTA固定フッター）を使用
 */
export default async function PublicJobListPage() {
  try {
    const currentTime = getCurrentTime();
    const dates = generateDatesFromBase(currentTime, 90);
    const targetDate = dates[0];

    const { jobs: jobsData, pagination } = await getJobsListWithPagination(
      { listType: 'all' },
      { page: 1, limit: 20, targetDate, sort: undefined, currentTime }
    );

    const jobs = jobsData.map((job: any) => {
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
        workDates: job.workDates?.map((wd: any) => ({
          id: wd.id,
          workDate: wd.workDate || (wd.work_date ? wd.work_date.split('T')[0] : ''),
          deadline: wd.deadline,
          appliedCount: wd.applied_count,
          recruitmentCount: wd.recruitment_count,
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
        transportMethods: [{ name: '車', available: job.allow_car }],
        accessDescription: job.access,
        featureTags,
        requiresInterview: job.requires_interview,
        weeklyFrequency: job.weekly_frequency,
        effectiveWeeklyFrequency: job.effectiveWeeklyFrequency,
        availableWorkDateCount: job.availableWorkDateCount,
        jobType: job.jobType,
      };
    });

    const facilities = jobsData.map((job: any) => ({
      id: job.facility.id,
      name: job.facility.facility_name,
      corporationName: job.facility.corporation_name,
      type: job.facility.facility_type,
      address: job.facility.address,
      lat: job.facility.lat,
      lng: job.facility.lng,
      description: job.facility.description || '',
      images: job.facility.images,
      rating: job.facility.rating,
      reviewCount: job.facility.review_count,
    }));

    return (
      <>
        <Suspense fallback={null}>
          <PublicJobsTracker pageType="list" />
        </Suspense>
        <JobListClient
          initialJobs={jobs}
          initialFacilities={facilities}
          initialPagination={pagination}
          isPublic={true}
          basePath="/public/jobs"
        />
      </>
    );
  } catch (error) {
    console.error('[SSR] Failed to fetch initial jobs:', error);
    return <JobListClient isPublic={true} basePath="/public/jobs" />;
  }
}
