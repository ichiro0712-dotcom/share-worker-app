import { NextRequest, NextResponse } from 'next/server';
import { getJobsListWithPagination } from '@/src/lib/actions';
import { generateDatesFromBase } from '@/utils/date';
import { DEBUG_TIME_COOKIE_NAME, parseDebugTimeCookie, getCurrentTimeFromSettings } from '@/utils/debugTime.server';
import { getSystemSettingBoolean, getSystemSettingNumber } from '@/src/lib/actions/systemSettings';
import { SYSTEM_SETTING_KEYS } from '@/src/lib/constants/systemSettings';

// キャッシュ設定
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // デバッグ時刻をCookieから取得
    const debugTimeCookie = request.cookies.get(DEBUG_TIME_COOKIE_NAME);
    const debugTimeSettings = parseDebugTimeCookie(debugTimeCookie?.value);
    const currentTime = getCurrentTimeFromSettings(debugTimeSettings);

    // クエリパラメータを解析
    const query = searchParams.get('query') || undefined;
    const prefecture = searchParams.get('prefecture') || undefined;
    const city = searchParams.get('city') || undefined;
    const minWage = searchParams.get('minWage') ? parseInt(searchParams.get('minWage')!, 10) : undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const dateIndex = searchParams.get('dateIndex') ? parseInt(searchParams.get('dateIndex')!, 10) : 1;
    let sort = (searchParams.get('sort') as 'distance' | 'wage' | 'deadline') || undefined;

    // 配列パラメータ
    const serviceTypes = searchParams.getAll('serviceType');
    const transportations = searchParams.getAll('transportation');
    const otherConditions = searchParams.getAll('otherCondition');
    const jobTypes = searchParams.getAll('jobType');
    const workTimeTypes = searchParams.getAll('workTimeType');

    // 時間帯パラメータ
    const timeRangeFrom = searchParams.get('timeRangeFrom') || undefined;
    const timeRangeTo = searchParams.get('timeRangeTo') || undefined;

    // 距離検索パラメータ
    const distanceKm = searchParams.get('distanceKm') ? parseFloat(searchParams.get('distanceKm')!) : undefined;
    const distanceLat = searchParams.get('distanceLat') ? parseFloat(searchParams.get('distanceLat')!) : undefined;
    const distanceLng = searchParams.get('distanceLng') ? parseFloat(searchParams.get('distanceLng')!) : undefined;

    // システム設定を取得
    const distanceSortFilterEnabled = await getSystemSettingBoolean(
      SYSTEM_SETTING_KEYS.DISTANCE_SORT_FILTER_ENABLED
    );
    const defaultDistanceKm = await getSystemSettingNumber(
      SYSTEM_SETTING_KEYS.DISTANCE_SORT_DEFAULT_KM
    ) ?? 50;

    // 距離ソート時のパラメータ検証とフォールバック
    let effectiveDistanceKm = distanceKm;
    if (sort === 'distance') {
      if (distanceLat === undefined || distanceLng === undefined) {
        // 緯度経度がない場合は締切順にフォールバック（400エラーではなく）
        console.info('[API /api/jobs] distance sort requested but lat/lng not provided, falling back to deadline sort');
        sort = 'deadline';
      } else if (distanceSortFilterEnabled) {
        // 距離フィルターが有効な場合のみ、distanceKm を設定
        if (effectiveDistanceKm === undefined) {
          effectiveDistanceKm = defaultDistanceKm;
          console.info(`[API /api/jobs] distanceKm not specified, using system default ${defaultDistanceKm}km`);
        }
      } else {
        // 距離フィルターが無効な場合、distanceKm を使用しない（ソートのみ）
        effectiveDistanceKm = undefined;
        console.info('[API /api/jobs] distance sort filter disabled, sorting by distance without range filter');
      }
    }

    // 求人リストタイプ（限定求人・オファー対応）
    const listType = (searchParams.get('listType') as 'all' | 'limited' | 'offer') || 'all';

    // 日付フィルター用のDateオブジェクト生成（デバッグ時刻対応・JST）
    const dates = generateDatesFromBase(currentTime, 90);
    const targetDate = dates[dateIndex];

    const jobSearchParams = {
      query,
      prefecture,
      city,
      minWage,
      serviceTypes: serviceTypes.length > 0 ? serviceTypes : undefined,
      transportations: transportations.length > 0 ? transportations : undefined,
      otherConditions: otherConditions.length > 0 ? otherConditions : undefined,
      jobTypes: jobTypes.length > 0 ? jobTypes : undefined,
      workTimeTypes: workTimeTypes.length > 0 ? workTimeTypes : undefined,
      timeRangeFrom,
      timeRangeTo,
      distanceKm: effectiveDistanceKm,
      distanceLat,
      distanceLng,
      listType,
    };

    const { jobs: jobsData, pagination } = await getJobsListWithPagination(
      jobSearchParams,
      {
        page,
        limit: 20,
        targetDate,
        sort,
        currentTime, // デバッグ時刻対応
      }
    );

    // DBのデータをフロントエンドの型に変換
    const jobs = jobsData.map((job) => {
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
        isExpired: job.isExpired || false,
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
      description: job.facility.description || '',
      images: job.facility.images,
      rating: job.facility.rating,
      reviewCount: job.facility.review_count,
    }));

    return NextResponse.json(
      { jobs, facilities, pagination },
      {
        headers: {
          // キャッシュを無効化 - 求人データはリアルタイム性が重要
          // 応募状況、締切、visible_untilなどが頻繁に変わるため
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[API /api/jobs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
