import { JobListClient } from '@/components/job/JobListClient';
import { getJobsListWithPagination } from '@/src/lib/actions';
import { generateDatesFromBase } from '@/utils/date';
import { getCurrentTime } from '@/utils/debugTime';

/**
 * 求人一覧ページ（SSR対応）
 *
 * サーバーサイドで今日の求人を事前取得し、
 * クライアントに初期データとして渡すことで
 * 初期表示速度を大幅に改善する。
 */
export default async function JobListPage() {
  try {
    // 現在時刻を取得（デバッグ時刻対応）
    const currentTime = getCurrentTime();

    // 今日の日付を取得（dateIndex = 0）
    const dates = generateDatesFromBase(currentTime, 90);
    const targetDate = dates[0]; // 今日

    // サーバーサイドで求人データを事前取得
    // 注意: SSRでは位置情報が取得できないため、距離ソートは使用しない
    // クライアント側で位置情報取得後に距離ソートが適用される
    const { jobs: jobsData, pagination } = await getJobsListWithPagination(
      { listType: 'all' },
      {
        page: 1,
        limit: 20,
        targetDate,
        sort: undefined, // SSRでは距離ソート不可（位置情報なし）
        currentTime,
      }
    );

    // DBデータをフロントエンド形式に変換（API routeと同じ処理）
    const jobs = jobsData.map((job: any) => {
      const transportMethods = [
        { name: '車', available: job.allow_car },
      ];

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
        transportMethods,
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
      phoneNumber: job.facility.phone_number,
      description: job.facility.description || '',
      images: job.facility.images,
      rating: job.facility.rating,
      reviewCount: job.facility.review_count,
    }));

    return (
      <JobListClient
        initialJobs={jobs}
        initialFacilities={facilities}
        initialPagination={pagination}
      />
    );
  } catch (error) {
    console.error('[SSR] Failed to fetch initial jobs:', error);
    // エラー時はクライアントサイドフェッチにフォールバック
    return <JobListClient />;
  }
}
