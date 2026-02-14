import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDatesFromBase } from '@/utils/date';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDateIndex = searchParams.get('dateIndex') ? parseInt(searchParams.get('dateIndex')!, 10) : 3;
    const dateIndex = Number.isNaN(rawDateIndex) || rawDateIndex < 0 ? 3 : rawDateIndex;

    // 日付リスト生成（JST基準）
    const dates = generateDatesFromBase(new Date(), 90);
    const selectedDate = dates[Math.min(dateIndex, dates.length - 1)];

    // JSTの日付文字列に変換して比較用に使用
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const selectedJST = new Date(selectedDate.getTime() + JST_OFFSET);
    const selectedDateStr = selectedJST.toISOString().split('T')[0]; // YYYY-MM-DD

    // おすすめ求人取得（公開中の求人のみ）
    const recommendedJobs = await prisma.recommendedJob.findMany({
      where: {
        job: {
          status: 'PUBLISHED',
        },
      },
      orderBy: { sort_order: 'asc' },
      include: {
        job: {
          include: {
            facility: true,
            workDates: {
              orderBy: { work_date: 'asc' },
            },
          },
        },
      },
    });

    // 今日以降の勤務日があるかを判定するための基準日
    const nowJST = new Date(Date.now() + JST_OFFSET);
    const todayStr = nowJST.toISOString().split('T')[0];

    // 求人データをフロントエンド形式に変換（フィルタ付き）
    const jobs = recommendedJobs.map((rec) => {
      const job = rec.job;

      // 選択日のworkDateを見つける
      const matchingWorkDate = job.workDates.find(wd => {
        const wdJST = new Date(wd.work_date.getTime() + JST_OFFSET);
        return wdJST.toISOString().split('T')[0] === selectedDateStr;
      });

      // 今日以降の勤務日が1つもない求人 = 「勤務日なし」求人
      const hasFutureWorkDates = job.workDates.some(wd => {
        const wdJST = new Date(wd.work_date.getTime() + JST_OFFSET);
        return wdJST.toISOString().split('T')[0] >= todayStr;
      });
      const noFutureWorkDates = !hasFutureWorkDates;

      // フィルタロジック:
      // - 勤務日なし求人 → 全日付で常に表示（グレーアウトしない）
      // - 選択日に勤務日がない求人 → 非表示（returnでnull）
      // - 選択日に勤務日がある求人 → 表示（満員でもグレーアウトしない）
      if (!noFutureWorkDates && !matchingWorkDate) {
        return null; // 選択日にマッチしない → 非表示
      }

      const hasMatchingDate = noFutureWorkDates || !!matchingWorkDate;

      // 最も近い締切を取得
      const closestWorkDate = job.workDates[0];
      const deadline = matchingWorkDate?.deadline || closestWorkDate?.deadline || new Date();

      // 満員でないworkDateの数を計算（公開APIではログインユーザーなしのため簡易判定）
      const availableWorkDateCount = job.workDates.filter(
        wd => wd.applied_count < wd.recruitment_count
      ).length;
      const effectiveWeeklyFrequency = job.weekly_frequency && availableWorkDateCount >= job.weekly_frequency
        ? job.weekly_frequency
        : null;

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
        status: job.status.toLowerCase(),
        facilityId: job.facility_id,
        title: job.title,
        workDate: matchingWorkDate
          ? new Date(matchingWorkDate.work_date.getTime() + JST_OFFSET).toISOString().split('T')[0]
          : '',
        workDates: job.workDates.map((wd) => {
          const wdDateStr = new Date(wd.work_date.getTime() + JST_OFFSET).toISOString().split('T')[0];
          return {
            id: wd.id,
            workDate: wdDateStr,
            canApply: wdDateStr === selectedDateStr, // 常に応募可能に見せる
            isFull: false, // ウィジェットでは満員表示しない
          };
        }),
        hasAvailableWorkDate: hasMatchingDate, // 勤務日があれば常に応募可能
        noFutureWorkDates, // 今日以降の勤務日が0件（常時表示対象）
        startTime: job.start_time,
        endTime: job.end_time,
        breakTime: job.break_time,
        wage: job.wage,
        hourlyWage: job.hourly_wage,
        deadline: deadline.toISOString(),
        tags: job.tags,
        address: job.address || '',
        prefecture: job.prefecture,
        city: job.city,
        addressLine: job.address_line,
        access: job.access,
        recruitmentCount: 0, // ウィジェットでは募集人数を非表示（型互換のため0）
        appliedCount: 0, // ウィジェットでは応募数を非表示（型互換のため0）
        matchedCount: 0, // ウィジェットでは非表示
        transportationFee: job.transportation_fee,
        overview: job.overview,
        workContent: job.work_content,
        requiredQualifications: job.required_qualifications,
        requiredExperience: job.required_experience,
        dresscode: job.dresscode,
        belongings: job.belongings,
        managerName: job.manager_name,
        managerMessage: job.manager_message || '',
        managerAvatar: job.manager_avatar || '',
        images: job.images,
        badges: [],
        otherConditions: [],
        mapImage: '',
        transportMethods: [{ name: '車', available: job.allow_car }],
        accessDescription: job.access,
        featureTags,
        requiresInterview: job.requires_interview,
        weeklyFrequency: job.weekly_frequency,
        effectiveWeeklyFrequency,
        jobType: job.job_type,
      };
    }).filter(Boolean); // nullをフィルタ（選択日にマッチしない求人を除外）

    const facilityMap = new Map<number, typeof recommendedJobs[0]['job']['facility']>();
    recommendedJobs.forEach((rec) => {
      if (!facilityMap.has(rec.job.facility.id)) {
        facilityMap.set(rec.job.facility.id, rec.job.facility);
      }
    });
    const facilities = Array.from(facilityMap.values()).map((f) => ({
      id: f.id,
      name: f.facility_name,
      corporationName: f.corporation_name,
      type: f.facility_type,
      address: f.address,
      lat: f.lat,
      lng: f.lng,
      phoneNumber: f.phone_number,
      description: f.description || '',
      images: f.images,
      rating: f.rating,
      reviewCount: f.review_count,
    }));

    return NextResponse.json({
      jobs,
      facilities,
      dates: dates.map(d => d.toISOString()),
      selectedDateIndex: dateIndex,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Recommended jobs public API error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommended jobs' }, { status: 500 });
  }
}
