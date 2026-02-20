'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath, unstable_cache, unstable_noStore as noStore } from 'next/cache';
import { getCurrentTime, getTodayStart } from '@/utils/debugTime';
import { getJSTTodayStart, normalizeToJSTDayStart } from '@/utils/debugTime.server';
import {
    getAuthenticatedUser,
    isTimeOverlapping,
    calculateDistanceKm,
    filterValidImages,
    JobSearchParams,
    JobListType
} from './helpers';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';

/**
 * キャッシュされた求人詳細を取得
 */
export const getCachedJobDetail = async (id: number) => {
    const cachedFn = unstable_cache(
        async () => {
            const job = await prisma.job.findUnique({
                where: { id },
                include: {
                    facility: true,
                    workDates: {
                        orderBy: { work_date: 'asc' },
                        where: {
                            work_date: {
                                gte: getTodayStart(),
                            },
                            AND: [
                                // 募集開始日時を過ぎている（visible_fromが過去、またはnull=即公開）
                                {
                                    OR: [
                                        { visible_from: { lte: getCurrentTime() } },
                                        { visible_from: null }
                                    ]
                                },
                                // 表示期限内（visible_untilが未来、またはnull）
                                {
                                    OR: [
                                        { visible_until: { gte: getCurrentTime() } },
                                        { visible_until: null }
                                    ]
                                }
                            ]
                        }
                    },
                },
            });
            return job;
        },
        [`job-detail-${id}`],
        { tags: [`job-${id}`] }
    );
    return cachedFn();
};

/**
 * 求人一覧を取得
 */
export async function getJobs(
    searchParams?: JobSearchParams,
    options?: { currentTime?: Date }
) {
    // デバッグ時刻対応: 渡された時刻を優先
    const now = options?.currentTime || getCurrentTime();

    // 検索条件を動的に構築
    // PUBLISHED以外も表示するが、CANCELLED, DRAFT, STOPPEDは除外
    const whereConditions: any = {
        status: { in: ['PUBLISHED', 'WORKING', 'COMPLETED'] },
        // 募集開始日時〜表示期限内の求人のみ表示
        workDates: {
            some: {
                AND: [
                    // 募集開始日時を過ぎている（visible_fromが過去、またはnull=即公開）
                    {
                        OR: [
                            { visible_from: { lte: now } },
                            { visible_from: null }
                        ]
                    },
                    // 表示期限内（visible_untilが未来、またはnull）
                    {
                        OR: [
                            { visible_until: { gte: now } },
                            { visible_until: null }
                        ]
                    }
                ]
            }
        }
    };

    // facility条件を別途構築（deleted_atがnullの施設のみ対象）
    const facilityConditions: any = {
        deleted_at: null,
    };

    // キーワード検索（タイトルまたは施設名）
    if (searchParams?.query) {
        whereConditions.OR = [
            {
                title: {
                    contains: searchParams.query,
                    mode: 'insensitive',
                },
            },
            {
                facility: {
                    facility_name: {
                        contains: searchParams.query,
                        mode: 'insensitive',
                    },
                },
            },
        ];
    }

    // 都道府県フィルター
    if (searchParams?.prefecture) {
        facilityConditions.address = {
            contains: searchParams.prefecture,
            mode: 'insensitive',
        };
    }

    // 市区町村フィルター（都道府県と組み合わせる）
    if (searchParams?.city) {
        if (facilityConditions.address) {
            // 都道府県と市区町村の両方を含む
            facilityConditions.AND = [
                { address: { contains: searchParams.prefecture, mode: 'insensitive' } },
                { address: { contains: searchParams.city, mode: 'insensitive' } },
            ];
            delete facilityConditions.address;
        } else {
            facilityConditions.address = {
                contains: searchParams.city,
                mode: 'insensitive',
            };
        }
    }

    // サービス種別フィルター（複数選択対応）
    if (searchParams?.serviceTypes && searchParams.serviceTypes.length > 0) {
        facilityConditions.OR = searchParams.serviceTypes.map((type) => ({
            facility_type: {
                contains: type,
                mode: 'insensitive',
            },
        }));
    }

    // facility条件が存在する場合のみ追加
    if (Object.keys(facilityConditions).length > 0) {
        whereConditions.facility = facilityConditions;
    }

    // 最低時給フィルター
    if (searchParams?.minWage) {
        whereConditions.hourly_wage = {
            gte: searchParams.minWage,
        };
    }

    // 移動手段フィルター（Booleanカラムで検索）
    if (searchParams?.transportations && searchParams.transportations.length > 0) {
        // 移動手段のマッピング: UI選択肢 → DBカラム
        const transportationMapping: Record<string, string> = {
            '車': 'allow_car',
            'バイク': 'allow_bike',
            '自転車': 'allow_bicycle',
            '公共交通機関（電車・バス・徒歩）': 'allow_public_transit',
            '敷地内駐車場あり': 'has_parking',
        };

        whereConditions.AND = whereConditions.AND || [];
        // いずれかの移動手段が利用可能（OR条件）
        whereConditions.AND.push({
            OR: searchParams.transportations
                .filter((t) => transportationMapping[t])
                .map((transport) => ({
                    [transportationMapping[transport]]: true,
                })),
        });
    }

    // その他条件フィルター（Booleanカラムで検索）
    if (searchParams?.otherConditions && searchParams.otherConditions.length > 0) {
        // その他条件のマッピング: UI選択肢 → DBカラム
        // FilterModal.tsxのotherConditionsOptionsと同期必須
        const otherConditionMapping: Record<string, string> = {
            '未経験者歓迎': 'inexperienced_ok',
            'ブランク歓迎': 'blank_ok',
            '髪型・髪色自由': 'hair_style_free',
            'ネイルOK': 'nail_ok',
            '制服貸与': 'uniform_provided',
            '車通勤OK': 'allow_car',
            '食事補助': 'meal_support',
        };

        whereConditions.AND = whereConditions.AND || [];
        // 全てのこだわり条件を満たす（AND条件）
        searchParams.otherConditions.forEach((condition) => {
            const column = otherConditionMapping[condition];
            if (column) {
                whereConditions.AND.push({
                    [column]: true,
                });
            }
        });
    }

    // タイプフィルター（登録した資格で応募できる仕事のみ、看護の仕事のみ、説明会を除く）
    if (searchParams?.jobTypes && searchParams.jobTypes.length > 0) {
        whereConditions.AND = whereConditions.AND || [];

        for (const jobType of searchParams.jobTypes) {
            if (jobType === '登録した資格で応募できる仕事のみ') {
                // ユーザーの登録資格を取得
                const user = await getAuthenticatedUser();
                const userQualifications = user.qualifications || [];

                if (userQualifications.length > 0) {
                    // 資格のマッピング: ユーザー登録資格 → 求人の資格要件
                    const qualificationMapping: Record<string, string[]> = {
                        '看護師': ['正看護師', '准看護師'],
                        '正看護師': ['正看護師'],
                        '准看護師': ['准看護師'],
                        '介護福祉士': ['介護福祉士'],
                        '初任者研修': ['初任者研修'],
                        '実務者研修': ['実務者研修'],
                        'ヘルパー2級': ['初任者研修', 'ヘルパー2級'],
                        'ヘルパー1級': ['実務者研修', 'ヘルパー1級'],
                    };

                    // ユーザーの資格から対応する求人資格要件のリストを作成
                    const matchingQualifications: string[] = [];
                    for (const userQual of userQualifications) {
                        const mapped = qualificationMapping[userQual];
                        if (mapped) {
                            matchingQualifications.push(...mapped);
                        } else {
                            // マッピングがない場合はそのまま追加
                            matchingQualifications.push(userQual);
                        }
                    }

                    // 重複を除去
                    const uniqueQualifications = Array.from(new Set(matchingQualifications));

                    // 求人の資格要件がユーザーの資格に含まれる、または資格要件がない求人を抽出
                    whereConditions.AND.push({
                        OR: [
                            // 資格要件がない求人（誰でも応募可能）
                            { required_qualifications: { equals: [] } },
                            // ユーザーの資格のいずれかが求人の資格要件に含まれる
                            { required_qualifications: { hasSome: uniqueQualifications } },
                        ],
                    });
                }
            } else if (jobType === '看護の仕事のみ') {
                // タイトルに「看護」を含む、または資格に「看護」を含む
                whereConditions.AND.push({
                    OR: [
                        { title: { contains: '看護', mode: 'insensitive' } },
                        { required_qualifications: { hasSome: ['正看護師', '准看護師'] } },
                    ],
                });
            } else if (jobType === '説明会を除く' || jobType === 'excludeOrientation') {
                // job_typeがORIENTATIONでない求人のみ
                whereConditions.AND.push({
                    NOT: { job_type: 'ORIENTATION' },
                });
            }
        }
    }

    // 勤務時間フィルター（日勤、夜勤、1日4時間以下）
    if (searchParams?.workTimeTypes && searchParams.workTimeTypes.length > 0) {
        whereConditions.AND = whereConditions.AND || [];

        // 勤務時間タイプの条件を構築（OR条件）
        const workTimeConditions: any[] = [];

        searchParams.workTimeTypes.forEach((workTimeType) => {
            if (workTimeType === '日勤') {
                // start_time が 05:00 〜 15:59 の求人
                workTimeConditions.push({
                    AND: [
                        { start_time: { gte: '05:00' } },
                        { start_time: { lt: '16:00' } },
                    ],
                });
            } else if (workTimeType === '夜勤') {
                // start_time が 16:00 以降の求人
                workTimeConditions.push({
                    start_time: { gte: '16:00' },
                });
            } else if (workTimeType === '1日4時間以下') {
                // 勤務時間が4時間以下の求人（計算が必要なのでRaw queryは使わない）
                workTimeConditions.push({
                    OR: [
                        // 4時間以下のパターンをマッチ
                        { AND: [{ start_time: '09:00' }, { end_time: '13:00' }] },
                        { AND: [{ start_time: '10:00' }, { end_time: '14:00' }] },
                        { AND: [{ start_time: '14:00' }, { end_time: '18:00' }] },
                        { AND: [{ start_time: '08:00' }, { end_time: '12:00' }] },
                        { AND: [{ start_time: '13:00' }, { end_time: '17:00' }] },
                        // break_time が「なし」の場合は短時間勤務の可能性が高い
                        { break_time: 'なし' },
                    ],
                });
            }
        });

        // 選択された勤務時間タイプのいずれかに該当（OR条件）
        if (workTimeConditions.length > 0) {
            whereConditions.AND.push({
                OR: workTimeConditions,
            });
        }
    }

    const jobs = await prisma.job.findMany({
        where: whereConditions,
        include: {
            facility: true,
            workDates: {
                orderBy: { work_date: 'asc' },
                where: {
                    AND: [
                        {
                            OR: [
                                { visible_from: { lte: now } },
                                { visible_from: null }
                            ]
                        },
                        {
                            OR: [
                                { visible_until: { gte: now } },
                                { visible_until: null }
                            ]
                        }
                    ]
                }
            },
        },
        orderBy: {
            created_at: 'desc',
        },
    });

    // ユーザーの応募済み情報を取得（ログインしている場合）
    let userAppliedWorkDateIds: number[] = [];
    let userScheduledJobs: { date: string; startTime: string; endTime: string; workDateId: number }[] = [];

    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
            const userId = parseInt(session.user.id, 10);

            // ユーザーの応募済み勤務日IDを取得
            const applications = await prisma.application.findMany({
                where: {
                    user_id: userId,
                    status: { notIn: ['CANCELLED'] }, // キャンセル以外
                },
                include: {
                    workDate: {
                        include: {
                            job: {
                                select: {
                                    start_time: true,
                                    end_time: true,
                                },
                            },
                        },
                    },
                },
            });

            userAppliedWorkDateIds = applications.map(app => app.work_date_id);

            // スケジュール確定済み（SCHEDULED, WORKING）の日時情報を収集（時間重複判定用）
            userScheduledJobs = applications
                .filter(app => ['SCHEDULED', 'WORKING'].includes(app.status))
                .filter(app => app.workDate !== null)
                .map(app => ({
                    date: app.workDate!.work_date.toISOString().split('T')[0],
                    startTime: app.workDate!.job.start_time,
                    endTime: app.workDate!.job.end_time,
                    workDateId: app.work_date_id, // 同じ勤務日をスキップするために必要
                }));
        }
    } catch (error) {
        // セッション取得エラーは無視（未ログインの場合など）
        console.log('[getJobs] No session or error getting user data');
    }

    // Date型を文字列に変換してシリアライズ可能にする
    return jobs.map((job) => {
        // 一番近い勤務日を取得（互換性のため）
        const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
        // 総応募数を計算
        const totalAppliedCount = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
        // 総マッチング数を計算
        const totalMatchedCount = job.workDates.reduce((sum, wd) => sum + wd.matched_count, 0);
        // 総募集数を計算
        const totalRecruitmentCount = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

        // 各勤務日の応募可否を計算
        const workDatesWithAvailability = job.workDates.map((wd) => {
            const dateStr = wd.work_date.toISOString().split('T')[0];

            // 応募済みかチェック
            const isApplied = userAppliedWorkDateIds.includes(wd.id);

            // 募集終了かチェック（面接なしの場合のみ）
            const isFull = !job.requires_interview && wd.matched_count >= wd.recruitment_count;

            // 時間重複チェック（同じ日付で時間が被っているか）
            const hasTimeConflict = userScheduledJobs.some(scheduled => {
                if (scheduled.date !== dateStr) return false;
                if (scheduled.workDateId === wd.id) return false; // 同じ勤務日はスキップ
                return isTimeOverlapping(
                    job.start_time,
                    job.end_time,
                    scheduled.startTime,
                    scheduled.endTime
                );
            });

            // 応募可否（いずれかに該当したら応募不可）
            const canApply = !isApplied && !isFull && !hasTimeConflict && !wd.is_recruitment_closed;

            return {
                ...wd,
                work_date: wd.work_date.toISOString(),
                workDate: wd.work_date.toISOString().split('T')[0], // YYYY-MM-DD形式（フロントエンド互換）
                deadline: wd.deadline.toISOString(),
                created_at: wd.created_at.toISOString(),
                updated_at: wd.updated_at.toISOString(),
                // 応募可否情報を追加
                isApplied,
                isFull,
                hasTimeConflict,
                canApply,
                isRecruitmentClosed: wd.is_recruitment_closed,
            };
        });

        // 親求人が応募可能かどうか（1つでも応募可能な子求人があればtrue）
        const hasAvailableWorkDate = workDatesWithAvailability.some(wd => wd.canApply);

        // 応募可能日数をカウント
        const availableWorkDateCount = workDatesWithAvailability.filter(wd => wd.canApply).length;

        // N回以上勤務の有効性を判定（応募可能日数がN未満なら単発扱い）
        const effectiveWeeklyFrequency = job.weekly_frequency && availableWorkDateCount >= job.weekly_frequency
            ? job.weekly_frequency
            : null;

        return {
            ...job,
            images: filterValidImages(job.images as string[]),
            // 互換性のため、一番近い勤務日の情報を work_date と deadline に設定
            work_date: nearestWorkDate ? nearestWorkDate.work_date.toISOString() : null,
            deadline: nearestWorkDate ? nearestWorkDate.deadline.toISOString() : null,
            applied_count: totalAppliedCount,
            matched_count: totalMatchedCount,
            recruitment_count: totalRecruitmentCount,
            // 全ての勤務日情報（応募可否情報付き）
            workDates: workDatesWithAvailability,
            created_at: job.created_at.toISOString(),
            updated_at: job.updated_at.toISOString(),
            facility: {
                ...job.facility,
                created_at: job.facility.created_at.toISOString(),
                updated_at: job.facility.updated_at.toISOString(),
            },
            requires_interview: job.requires_interview,
            // 親求人の応募可否
            hasAvailableWorkDate,
            // 応募可能日数
            availableWorkDateCount,
            // 有効なN回以上勤務条件（応募可能日数がN未満なら単発扱いでnull）
            effectiveWeeklyFrequency,
            // 求人種別
            jobType: job.job_type,
            // 募集完了フラグ（全勤務日がclosedの場合にtrue）
            isRecruitmentClosed: workDatesWithAvailability.length > 0 && workDatesWithAvailability.every(wd => wd.isRecruitmentClosed),
        };
    });
}

/**
 * 求人一覧を取得（ページネーション・フィルタリング・ソート対応）
 */
export async function getJobsListWithPagination(
    searchParams?: JobSearchParams,
    paginationOptions: {
        page?: number;
        limit?: number;
        targetDate?: Date;
        sort?: 'distance' | 'wage' | 'deadline';
        /** サーバーサイドから渡される現在時刻（デバッグ時刻対応） */
        currentTime?: Date;
    } = {}
) {
    const { page = 1, limit = 20, targetDate, sort = 'distance', currentTime: providedTime } = paginationOptions;
    const skip = (page - 1) * limit;

    // デバッグ時刻対応: API Routeから渡された時刻を優先
    const now = providedTime || getCurrentTime();
    // 日本時間（JST）での今日の開始時刻を使用（サーバーがUTCでも正しく動作）
    const todayStart = getJSTTodayStart(now);

    // listTypeに基づいて求人種別フィルタを決定
    const listType: JobListType = searchParams?.listType || 'all';

    // 限定求人・オファーの場合はユーザー情報が必要
    let workedFacilityIds: number[] = [];
    let favoritedByFacilityIds: number[] = [];
    let currentUserId: number | null = null;

    if (listType === 'limited' || listType === 'offer') {
        try {
            const session = await getServerSession(authOptions);
            if (session?.user?.id) {
                currentUserId = parseInt(session.user.id, 10);

                if (listType === 'limited') {
                    // 限定求人クエリを並列実行（パフォーマンス改善）
                    const [workedApplications, favoriteBookmarks] = await Promise.all([
                        // 限定求人（勤務済み）の対象施設: 過去にcompleted_ratedになったワーカー
                        prisma.application.findMany({
                            where: {
                                user_id: currentUserId,
                                status: 'COMPLETED_RATED',
                            },
                            select: {
                                workDate: {
                                    select: {
                                        job: {
                                            select: {
                                                facility_id: true,
                                            },
                                        },
                                    },
                                },
                            },
                        }),
                        // 限定求人（お気に入り）の対象施設: 施設がこのワーカーをお気に入り登録している
                        prisma.bookmark.findMany({
                            where: {
                                target_user_id: currentUserId,
                                type: 'FAVORITE',
                                facility_id: { not: null },
                            },
                            select: {
                                facility_id: true,
                            },
                        }),
                    ]);

                    workedFacilityIds = Array.from(new Set(
                        workedApplications
                            .map(app => app.workDate?.job?.facility_id)
                            .filter((id): id is number => id !== null && id !== undefined)
                    ));
                    favoritedByFacilityIds = favoriteBookmarks
                        .map(b => b.facility_id)
                        .filter((id): id is number => id !== null);
                }
            }
        } catch (error) {
            console.log('[getJobsListWithPagination] Error getting user data for limited/offer:', error);
        }
    }

    const whereConditions: any = {
        status: { in: ['PUBLISHED', 'WORKING', 'COMPLETED'] },
        // 募集開始日時〜表示期限内の求人のみ表示
        workDates: {
            some: {
                AND: [
                    // 今日以降の勤務日のみ
                    { work_date: { gte: todayStart } },
                    // 募集開始日時を過ぎている（visible_fromが過去、またはnull=即公開）
                    {
                        OR: [
                            { visible_from: { lte: now } },
                            { visible_from: null }
                        ]
                    },
                    // 表示期限内（visible_untilが未来、またはnull）
                    {
                        OR: [
                            { visible_until: { gte: now } },
                            { visible_until: null }
                        ]
                    }
                ]
            }
        }
    };

    // listTypeに基づいてjob_typeフィルタを追加
    if (listType === 'all') {
        // 「すべて」: 通常求人・説明会のみ（限定求人・オファーは表示されない）
        whereConditions.job_type = { in: ['NORMAL', 'ORIENTATION'] };
    } else if (listType === 'limited') {
        // 「限定求人」: 自分が対象の限定求人のみ
        // - LIMITED_WORKED: 勤務済み施設の求人
        // - LIMITED_FAVORITE: お気に入り登録されている施設の求人
        const limitedConditions: any[] = [];

        if (workedFacilityIds.length > 0) {
            limitedConditions.push({
                job_type: 'LIMITED_WORKED',
                facility_id: { in: workedFacilityIds },
            });
        }

        if (favoritedByFacilityIds.length > 0) {
            limitedConditions.push({
                job_type: 'LIMITED_FAVORITE',
                facility_id: { in: favoritedByFacilityIds },
            });
        }

        if (limitedConditions.length > 0) {
            whereConditions.OR = limitedConditions;
        } else {
            // 対象施設がない場合は何も表示しない
            whereConditions.id = -1; // 絶対にマッチしない条件
        }
    } else if (listType === 'offer') {
        // 「オファー」: 自分宛のオファーのみ
        if (currentUserId) {
            whereConditions.job_type = 'OFFER';
            whereConditions.target_worker_id = currentUserId;
        } else {
            // ログインしていない場合は何も表示しない
            whereConditions.id = -1;
        }
    }

    // facility条件を別途構築（deleted_atがnullの施設のみ対象）
    const facilityConditions: any = {
        deleted_at: null,
    };

    // キーワード検索（タイトルまたは施設名）
    if (searchParams?.query) {
        whereConditions.OR = [
            {
                title: {
                    contains: searchParams.query,
                    mode: 'insensitive',
                },
            },
            {
                facility: {
                    facility_name: {
                        contains: searchParams.query,
                        mode: 'insensitive',
                    },
                },
            },
        ];
    }

    // 都道府県フィルター
    if (searchParams?.prefecture) {
        facilityConditions.address = {
            contains: searchParams.prefecture,
            mode: 'insensitive',
        };
    }

    // 市区町村フィルター（都道府県と組み合わせる）
    if (searchParams?.city) {
        if (facilityConditions.address) {
            // 都道府県と市区町村の両方を含む
            facilityConditions.AND = [
                { address: { contains: searchParams.prefecture, mode: 'insensitive' } },
                { address: { contains: searchParams.city, mode: 'insensitive' } },
            ];
            delete facilityConditions.address;
        } else {
            facilityConditions.address = {
                contains: searchParams.city,
                mode: 'insensitive',
            };
        }
    }

    // サービス種別フィルター（複数選択対応）
    if (searchParams?.serviceTypes && searchParams.serviceTypes.length > 0) {
        facilityConditions.OR = searchParams.serviceTypes.map((type) => ({
            facility_type: {
                contains: type,
                mode: 'insensitive',
            },
        }));
    }

    // facility条件が存在する場合のみ追加
    if (Object.keys(facilityConditions).length > 0) {
        whereConditions.facility = facilityConditions;
    }

    // 最低時給フィルター
    if (searchParams?.minWage) {
        whereConditions.hourly_wage = {
            gte: searchParams.minWage,
        };
    }

    // 移動手段フィルター（Booleanカラムで検索）
    if (searchParams?.transportations && searchParams.transportations.length > 0) {
        const transportationMapping: Record<string, string> = {
            '車': 'allow_car',
            'バイク': 'allow_bike',
            '自転車': 'allow_bicycle',
            '公共交通機関（電車・バス・徒歩）': 'allow_public_transit',
            '敷地内駐車場あり': 'has_parking',
        };

        whereConditions.AND = whereConditions.AND || [];
        whereConditions.AND.push({
            OR: searchParams.transportations
                .filter((t) => transportationMapping[t])
                .map((transport) => ({
                    [transportationMapping[transport]]: true,
                })),
        });
    }

    // その他条件フィルター（Booleanカラムで検索）
    if (searchParams?.otherConditions && searchParams.otherConditions.length > 0) {
        const otherConditionMapping: Record<string, string> = {
            '未経験者歓迎': 'inexperienced_ok',
            'ブランク歓迎': 'blank_ok',
            '髪型・髪色自由': 'hair_style_free',
            'ネイルOK': 'nail_ok',
            '制服貸与': 'uniform_provided',
            '車通勤OK': 'allow_car',
            '食事補助': 'meal_support',
        };

        whereConditions.AND = whereConditions.AND || [];
        searchParams.otherConditions.forEach((condition) => {
            const column = otherConditionMapping[condition];
            if (column) {
                whereConditions.AND.push({
                    [column]: true,
                });
            }
        });
    }

    // タイプフィルター
    if (searchParams?.jobTypes && searchParams.jobTypes.length > 0) {
        whereConditions.AND = whereConditions.AND || [];

        for (const jobType of searchParams.jobTypes) {
            if (jobType === '登録した資格で応募できる仕事のみ') {
                const user = await getAuthenticatedUser();
                const userQualifications = user.qualifications || [];
                if (userQualifications.length > 0) {
                    const qualificationMapping: Record<string, string[]> = {
                        '看護師': ['正看護師', '准看護師'],
                        '正看護師': ['正看護師'],
                        '准看護師': ['准看護師'],
                        '介護福祉士': ['介護福祉士'],
                        '初任者研修': ['初任者研修'],
                        '実務者研修': ['実務者研修'],
                        'ヘルパー2級': ['初任者研修', 'ヘルパー2級'],
                        'ヘルパー1級': ['実務者研修', 'ヘルパー1級'],
                    };
                    const matchingQualifications: string[] = [];
                    for (const userQual of userQualifications) {
                        const mapped = qualificationMapping[userQual];
                        if (mapped) {
                            matchingQualifications.push(...mapped);
                        } else {
                            matchingQualifications.push(userQual);
                        }
                    }
                    const uniqueQualifications = Array.from(new Set(matchingQualifications));
                    whereConditions.AND.push({
                        OR: [
                            { required_qualifications: { equals: [] } },
                            { required_qualifications: { hasSome: uniqueQualifications } },
                        ],
                    });
                }
            } else if (jobType === '看護の仕事のみ') {
                whereConditions.AND.push({
                    OR: [
                        { title: { contains: '看護', mode: 'insensitive' } },
                        { required_qualifications: { hasSome: ['正看護師', '准看護師'] } },
                    ],
                });
            } else if (jobType === '説明会を除く') {
                // job_typeがORIENTATIONでない求人のみ
                whereConditions.AND.push({
                    NOT: { job_type: 'ORIENTATION' },
                });
            }
        }
    }

    // 勤務時間フィルター
    if (searchParams?.workTimeTypes && searchParams.workTimeTypes.length > 0) {
        whereConditions.AND = whereConditions.AND || [];
        const workTimeConditions: any[] = [];
        searchParams.workTimeTypes.forEach((workTimeType) => {
            if (workTimeType === '日勤') {
                workTimeConditions.push({
                    AND: [
                        { start_time: { gte: '05:00' } },
                        { start_time: { lt: '16:00' } },
                    ],
                });
            } else if (workTimeType === '夜勤') {
                workTimeConditions.push({
                    start_time: { gte: '16:00' },
                });
            } else if (workTimeType === '1日4時間以下') {
                workTimeConditions.push({
                    OR: [
                        { AND: [{ start_time: '09:00' }, { end_time: '13:00' }] },
                        { AND: [{ start_time: '10:00' }, { end_time: '14:00' }] },
                        { AND: [{ start_time: '14:00' }, { end_time: '18:00' }] },
                        { AND: [{ start_time: '08:00' }, { end_time: '12:00' }] },
                        { AND: [{ start_time: '13:00' }, { end_time: '17:00' }] },
                        { break_time: 'なし' },
                    ],
                });
            }
        });
        if (workTimeConditions.length > 0) {
            whereConditions.AND.push({
                OR: workTimeConditions,
            });
        }
    }

    // 時間帯フィルター
    if (searchParams?.timeRangeFrom || searchParams?.timeRangeTo) {
        whereConditions.AND = whereConditions.AND || [];
        if (searchParams.timeRangeFrom) {
            whereConditions.AND.push({
                start_time: { gte: searchParams.timeRangeFrom },
            });
        }
        if (searchParams.timeRangeTo) {
            whereConditions.AND.push({
                end_time: { lte: searchParams.timeRangeTo },
            });
        }
    }

    // 距離検索フィルター
    let distanceFilterEnabled = false;
    let distanceCenter: { lat: number; lng: number } | null = null;
    let maxDistanceKm = 0;

    if (searchParams?.distanceLat && searchParams?.distanceLng) {
        // URLパラメータから渡される場合に備えて明示的に数値変換
        distanceCenter = {
            lat: Number(searchParams.distanceLat),
            lng: Number(searchParams.distanceLng)
        };
    }

    if (searchParams?.distanceKm && distanceCenter) {
        distanceFilterEnabled = true;
        // URLパラメータから渡される場合に備えて明示的に数値変換
        maxDistanceKm = Number(searchParams.distanceKm);

        const latDelta = maxDistanceKm / 111;
        const lngDelta = maxDistanceKm / (111 * Math.cos((distanceCenter.lat * Math.PI) / 180));

        if (!whereConditions.facility) {
            whereConditions.facility = { deleted_at: null };
        }
        whereConditions.facility.lat = {
            gte: distanceCenter.lat - latDelta,
            lte: distanceCenter.lat + latDelta,
        };
        whereConditions.facility.lng = {
            gte: distanceCenter.lng - lngDelta,
            lte: distanceCenter.lng + lngDelta,
        };
    }

    // 日付フィルター
    // targetDateは既にgenerateDatesFromBase()でJST基準の日付になっている
    // setHours()はサーバーのタイムゾーン(UTC)で動作するため使用しない
    if (targetDate) {
        const startOfDay = targetDate;
        const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);

        whereConditions.workDates = {
            some: {
                AND: [
                    {
                        work_date: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    },
                    {
                        OR: [
                            { visible_from: { lte: now } },
                            { visible_from: null }
                        ]
                    },
                    {
                        OR: [
                            { visible_until: { gte: now } },
                            { visible_until: null }
                        ]
                    }
                ]
            }
        };
    }

    // 並び順設定
    let orderByCondition: any = { created_at: 'desc' };
    if (sort === 'wage') {
        orderByCondition = { hourly_wage: 'desc' };
    }

    // workDatesの取得条件（先に定義して並列実行可能に）
    const workDatesWhereCondition: any = {
        AND: [
            { work_date: { gte: todayStart } },
            {
                OR: [
                    { visible_from: { lte: now } },
                    { visible_from: null }
                ]
            },
            {
                OR: [
                    { visible_until: { gte: now } },
                    { visible_until: null }
                ]
            }
        ]
    };

    if (targetDate) {
        // targetDateは既にJST基準なのでそのまま使用
        const startOfDayForInclude = targetDate;
        const endOfDayForInclude = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);

        workDatesWhereCondition.AND[0] = {
            work_date: {
                gte: startOfDayForInclude,
                lte: endOfDayForInclude
            }
        };
    }

    // 総件数と求人一覧を並列取得（パフォーマンス改善）
    const [totalCount, jobs] = await Promise.all([
        prisma.job.count({ where: whereConditions }),
        prisma.job.findMany({
        where: whereConditions,
        include: {
            facility: {
                select: {
                    id: true,
                    facility_name: true,
                    facility_type: true,
                    prefecture: true,
                    city: true,
                    address: true,
                    address_line: true,
                    lat: true,
                    lng: true,
                    rating: true,
                    review_count: true,
                    created_at: true,
                    updated_at: true,
                },
            },
            workDates: {
                select: {
                    id: true,
                    work_date: true,
                    deadline: true,
                    applied_count: true,
                    matched_count: true,
                    recruitment_count: true,
                    is_recruitment_closed: true,
                    visible_from: true,
                    visible_until: true,
                    created_at: true,
                    updated_at: true,
                },
                orderBy: { work_date: 'asc' },
                where: workDatesWhereCondition
            },
        },
        orderBy: orderByCondition,
        skip,
        take: limit,
    }),
    ]);

    // 募集終了求人を追加取得（該当日にwork_dateがあるが、visible_until切れ or 定員満了で通常クエリから除外された求人）
    let expiredJobs: typeof jobs = [];
    if (targetDate) {
        const expiredStartOfDay = targetDate;
        const expiredEndOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        const normalJobIds = jobs.map(j => j.id);

        // whereConditionsからworkDates条件を除いたベース条件を構築
        const { workDates: _wd, ...baseWhereWithoutWorkDates } = whereConditions;

        expiredJobs = await prisma.job.findMany({
            where: {
                ...baseWhereWithoutWorkDates,
                // 通常クエリの結果に含まれないもの
                id: { notIn: normalJobIds },
                // 該当日にwork_dateがあるが、visible_until条件を問わない
                workDates: {
                    some: {
                        work_date: { gte: expiredStartOfDay, lte: expiredEndOfDay },
                        OR: [
                            { visible_from: { lte: now } },
                            { visible_from: null }
                        ],
                    }
                },
            },
            include: {
                facility: {
                    select: {
                        id: true,
                        facility_name: true,
                        facility_type: true,
                        prefecture: true,
                        city: true,
                        address: true,
                        address_line: true,
                        lat: true,
                        lng: true,
                        rating: true,
                        review_count: true,
                        created_at: true,
                        updated_at: true,
                    },
                },
                workDates: {
                    select: {
                        id: true,
                        work_date: true,
                        deadline: true,
                        applied_count: true,
                        matched_count: true,
                        recruitment_count: true,
                        is_recruitment_closed: true,
                        visible_from: true,
                        visible_until: true,
                        created_at: true,
                        updated_at: true,
                    },
                    orderBy: { work_date: 'asc' },
                    // 該当日のwork_dateのみ取得（visible_until条件なし）
                    where: {
                        AND: [
                            { work_date: { gte: expiredStartOfDay, lte: expiredEndOfDay } },
                            { OR: [{ visible_from: { lte: now } }, { visible_from: null }] },
                        ]
                    }
                },
            },
            take: 10,
        });
    }

    // ユーザーの応募済み情報を取得
    let userAppliedWorkDateIds: number[] = [];
    let userScheduledJobs: { date: string; startTime: string; endTime: string; workDateId: number }[] = [];

    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
            const userId = parseInt(session.user.id, 10);
            const applications = await prisma.application.findMany({
                where: {
                    user_id: userId,
                    status: { notIn: ['CANCELLED'] },
                },
                select: {
                    work_date_id: true,
                    status: true,
                    workDate: {
                        select: {
                            id: true,
                            work_date: true,
                            job: {
                                select: {
                                    start_time: true,
                                    end_time: true,
                                },
                            },
                        },
                    },
                },
            });
            userAppliedWorkDateIds = applications.map(app => app.work_date_id);
            userScheduledJobs = applications
                .filter(app => ['SCHEDULED', 'WORKING'].includes(app.status))
                .filter(app => app.workDate !== null)
                .map(app => ({
                    date: app.workDate!.work_date.toISOString().split('T')[0],
                    startTime: app.workDate!.job.start_time,
                    endTime: app.workDate!.job.end_time,
                    workDateId: app.work_date_id,
                }));
        }
    } catch (error) {
        console.log('[getJobsListWithPagination] No session or error getting user data');
    }

    // データの整形
    const formattedJobs = jobs.map((job) => {
        const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
        const totalAppliedCount = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
        const totalMatchedCount = job.workDates.reduce((sum, wd) => sum + wd.matched_count, 0);
        const totalRecruitmentCount = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

        const workDatesWithAvailability = job.workDates.map((wd) => {
            const dateStr = wd.work_date.toISOString().split('T')[0];
            const isApplied = userAppliedWorkDateIds.includes(wd.id);
            const isFull = !job.requires_interview && wd.matched_count >= wd.recruitment_count;
            const hasTimeConflict = userScheduledJobs.some(scheduled => {
                if (scheduled.date !== dateStr) return false;
                if (scheduled.workDateId === wd.id) return false;
                return isTimeOverlapping(
                    job.start_time,
                    job.end_time,
                    scheduled.startTime,
                    scheduled.endTime
                );
            });
            const canApply = !isApplied && !isFull && !hasTimeConflict && !wd.is_recruitment_closed;

            return {
                ...wd,
                work_date: wd.work_date.toISOString(),
                workDate: wd.work_date.toISOString().split('T')[0],
                deadline: wd.deadline.toISOString(),
                created_at: wd.created_at.toISOString(),
                updated_at: wd.updated_at.toISOString(),
                isApplied,
                isFull,
                hasTimeConflict,
                canApply,
                isRecruitmentClosed: wd.is_recruitment_closed,
            };
        });

        const hasAvailableWorkDate = workDatesWithAvailability.some(wd => wd.canApply);
        const availableWorkDateCount = workDatesWithAvailability.filter(wd => wd.canApply).length;
        const effectiveWeeklyFrequency = job.weekly_frequency && availableWorkDateCount >= job.weekly_frequency
            ? job.weekly_frequency
            : null;

        return {
            ...job,
            images: filterValidImages(job.images as string[]),
            work_date: nearestWorkDate ? nearestWorkDate.work_date.toISOString() : null,
            deadline: nearestWorkDate ? nearestWorkDate.deadline.toISOString() : null,
            applied_count: totalAppliedCount,
            matched_count: totalMatchedCount,
            recruitment_count: totalRecruitmentCount,
            workDates: workDatesWithAvailability,
            created_at: job.created_at.toISOString(),
            updated_at: job.updated_at.toISOString(),
            facility: {
                ...job.facility,
                created_at: job.facility.created_at.toISOString(),
                updated_at: job.facility.updated_at.toISOString(),
            },
            requires_interview: job.requires_interview,
            hasAvailableWorkDate,
            availableWorkDateCount,
            effectiveWeeklyFrequency,
            jobType: job.job_type,
            isRecruitmentClosed: workDatesWithAvailability.length > 0 && workDatesWithAvailability.every(wd => wd.isRecruitmentClosed),
        };
    });

    // 募集終了求人のデータ整形（通常求人と同じ形式 + isExpiredフラグ）
    const formattedExpiredJobs = expiredJobs.map((job) => {
        const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
        const totalAppliedCount = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);
        const totalMatchedCount = job.workDates.reduce((sum, wd) => sum + wd.matched_count, 0);
        const totalRecruitmentCount = job.workDates.reduce((sum, wd) => sum + wd.recruitment_count, 0);

        const workDatesWithAvailability = job.workDates.map((wd) => {
            const dateStr = wd.work_date.toISOString().split('T')[0];
            const isApplied = userAppliedWorkDateIds.includes(wd.id);
            const isFull = !job.requires_interview && wd.matched_count >= wd.recruitment_count;
            const hasTimeConflict = userScheduledJobs.some(scheduled => {
                if (scheduled.date !== dateStr) return false;
                if (scheduled.workDateId === wd.id) return false;
                return isTimeOverlapping(
                    job.start_time,
                    job.end_time,
                    scheduled.startTime,
                    scheduled.endTime
                );
            });
            const canApply = false; // 募集終了のため常にfalse

            return {
                ...wd,
                work_date: wd.work_date.toISOString(),
                workDate: wd.work_date.toISOString().split('T')[0],
                deadline: wd.deadline.toISOString(),
                created_at: wd.created_at.toISOString(),
                updated_at: wd.updated_at.toISOString(),
                isApplied,
                isFull,
                hasTimeConflict,
                canApply,
                isRecruitmentClosed: wd.is_recruitment_closed,
            };
        });

        return {
            ...job,
            images: filterValidImages(job.images as string[]),
            work_date: nearestWorkDate ? nearestWorkDate.work_date.toISOString() : null,
            deadline: nearestWorkDate ? nearestWorkDate.deadline.toISOString() : null,
            applied_count: totalAppliedCount,
            matched_count: totalMatchedCount,
            recruitment_count: totalRecruitmentCount,
            workDates: workDatesWithAvailability,
            created_at: job.created_at.toISOString(),
            updated_at: job.updated_at.toISOString(),
            facility: {
                ...job.facility,
                created_at: job.facility.created_at.toISOString(),
                updated_at: job.facility.updated_at.toISOString(),
            },
            requires_interview: job.requires_interview,
            hasAvailableWorkDate: false,
            availableWorkDateCount: 0,
            effectiveWeeklyFrequency: null,
            jobType: job.job_type,
            isExpired: true,
            isRecruitmentClosed: workDatesWithAvailability.length > 0 && workDatesWithAvailability.every(wd => wd.isRecruitmentClosed),
        };
    });

    // 通常求人 + 募集終了求人をマージ（通常求人が先、募集終了求人が後）
    const allFormattedJobs = [...formattedJobs, ...formattedExpiredJobs];

    // 距離フィルタリングとソート
    let filteredJobsWithDistance: (any & { _distance?: number })[] = allFormattedJobs;
    let filteredTotalCount = totalCount;

    if (distanceFilterEnabled && distanceCenter) {
        filteredJobsWithDistance = formattedJobs
            .map((job) => {
                const facilityLat = job.facility.lat;
                const facilityLng = job.facility.lng;
                // null または デフォルト値(0,0) の場合は無効な座標として扱う
                if (facilityLat === null || facilityLng === null || (facilityLat === 0 && facilityLng === 0)) {
                    return { ...job, _distance: Infinity };
                }
                const distance = calculateDistanceKm(
                    distanceCenter.lat,
                    distanceCenter.lng,
                    facilityLat,
                    facilityLng
                );
                return { ...job, _distance: distance };
            })
            .filter((job) => (job._distance ?? Infinity) <= maxDistanceKm);

        filteredTotalCount = filteredJobsWithDistance.length + skip;
    }

    if (sort === 'distance' && distanceCenter) {
        if (!distanceFilterEnabled) {
            filteredJobsWithDistance = filteredJobsWithDistance.map((job) => {
                const facilityLat = job.facility.lat;
                const facilityLng = job.facility.lng;
                // null または デフォルト値(0,0) の場合は無効な座標として扱う
                if (facilityLat === null || facilityLng === null || (facilityLat === 0 && facilityLng === 0)) {
                    return { ...job, _distance: Infinity };
                }
                const distance = calculateDistanceKm(
                    distanceCenter.lat,
                    distanceCenter.lng,
                    facilityLat,
                    facilityLng
                );
                return { ...job, _distance: distance };
            });
        }
        filteredJobsWithDistance.sort((a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity));
    }

    const cleanedJobs = filteredJobsWithDistance.map(({ _distance, ...job }) => job);

    return {
        jobs: cleanedJobs,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(filteredTotalCount / limit),
            totalCount: filteredTotalCount,
            hasMore: skip + cleanedJobs.length < filteredTotalCount,
        },
    };
}

/**
 * 特定の求人IDの詳細を取得
 */
export async function getJobById(id: string, options?: { currentTime?: Date }) {
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
        return null;
    }

    // デバッグ時刻対応: 渡された時刻を優先
    const now = options?.currentTime || getCurrentTime();
    // 日本時間（JST）での今日の開始時刻を使用
    const todayStart = getJSTTodayStart(now);

    const job = await prisma.job.findUnique({
        where: {
            id: jobId,
        },
        include: {
            facility: true,
            workDates: {
                orderBy: { work_date: 'asc' },
                where: {
                    AND: [
                        // 募集開始日時を過ぎている（visible_fromが過去、またはnull=即公開）
                        {
                            OR: [
                                { visible_from: { lte: now } },
                                { visible_from: null }
                            ]
                        },
                        // 表示期限内（visible_untilが未来、またはnull）
                        {
                            OR: [
                                { visible_until: { gte: now } },
                                { visible_until: null }
                            ]
                        }
                    ]
                }
            },
        },
    });

    if (!job) {
        return null;
    }

    // 一番近い勤務日を取得
    const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
    // 総数を計算（各勤務日の値を合計）
    const totalAppliedCount = job.workDates.reduce((sum: number, wd) => sum + wd.applied_count, 0);
    const totalMatchedCount = job.workDates.reduce((sum: number, wd) => sum + wd.matched_count, 0);
    const totalRecruitmentCount = job.workDates.reduce((sum: number, wd) => sum + wd.recruitment_count, 0);

    // 今日以降の勤務日をカウント（JST基準で比較）
    const today = todayStart;
    const futureWorkDateCount = job.workDates.filter(wd => {
        const workDate = normalizeToJSTDayStart(new Date(wd.work_date));
        return workDate >= today;
    }).length;

    // N回以上勤務の有効性を判定
    const effectiveWeeklyFrequency = job.weekly_frequency && futureWorkDateCount >= job.weekly_frequency
        ? job.weekly_frequency
        : null;

    return {
        ...job,
        images: filterValidImages(job.images as string[]),
        work_date: nearestWorkDate ? nearestWorkDate.work_date.toISOString() : null,
        deadline: nearestWorkDate ? nearestWorkDate.deadline.toISOString() : null,
        applied_count: totalAppliedCount,
        matched_count: totalMatchedCount,
        recruitment_count: totalRecruitmentCount,
        workDates: job.workDates.map((wd) => ({
            ...wd,
            work_date: wd.work_date.toISOString(),
            deadline: wd.deadline.toISOString(),
            created_at: wd.created_at.toISOString(),
            updated_at: wd.updated_at.toISOString(),
            isRecruitmentClosed: wd.is_recruitment_closed,
        })),
        created_at: job.created_at.toISOString(),
        updated_at: job.updated_at.toISOString(),
        facility: {
            ...job.facility,
            created_at: job.facility.created_at.toISOString(),
            updated_at: job.facility.updated_at.toISOString(),
        },
        requires_interview: job.requires_interview,
        effectiveWeeklyFrequency,
        availableWorkDateCount: futureWorkDateCount,
        // オファー・限定求人対応
        job_type: job.job_type,
        target_worker_id: job.target_worker_id,
        // 募集完了フラグ（全勤務日がclosedの場合にtrue）
        isRecruitmentClosed: job.workDates.length > 0 && job.workDates.every(wd => wd.is_recruitment_closed),
    };
}

/**
 * ユーザーが求人に応募済みかチェック
 */
export async function hasUserAppliedForJob(jobId: string): Promise<boolean> {
    try {
        const jobIdNum = parseInt(jobId, 10);

        if (isNaN(jobIdNum)) {
            return false;
        }

        const user = await getAuthenticatedUser();

        const existingApplication = await prisma.application.findFirst({
            where: {
                user_id: user.id,
                workDate: {
                    job_id: jobIdNum,
                },
            },
        });

        return !!existingApplication;
    } catch (error) {
        console.error('Error checking application status:', error);
        return false;
    }
}

/**
 * 求人をブックマーク（お気に入り/後で見る）に追加
 */
export async function addJobBookmark(jobId: string, type: 'FAVORITE' | 'WATCH_LATER') {
    try {
        const user = await getAuthenticatedUser();
        const jobIdNum = parseInt(jobId, 10);

        if (isNaN(jobIdNum)) {
            return {
                success: false,
                error: '無効な求人IDです',
            };
        }

        const existing = await prisma.bookmark.findFirst({
            where: {
                user_id: user.id,
                target_job_id: jobIdNum,
                type,
            },
        });

        if (existing) {
            return {
                success: false,
                error: '既にブックマーク済みです',
            };
        }

        const bookmark = await prisma.bookmark.create({
            data: {
                user_id: user.id,
                target_job_id: jobIdNum,
                type,
            },
        });

        revalidatePath('/jobs/' + jobId);
        revalidatePath('/bookmarks');
        revalidatePath('/favorites');

        // ログ記録
        logActivity({
            userId: user.id,
            userType: 'WORKER',
            action: 'BOOKMARK_CREATE',
            targetType: 'Bookmark',
            targetId: bookmark.id,
            requestData: {
                jobId: jobIdNum,
                type,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            message: type === 'FAVORITE' ? 'お気に入りに追加しました' : '後で見るに追加しました',
        };
    } catch (error) {
        console.error('[addJobBookmark] Error:', error);

        // エラーログ記録（userが取得できていれば使用）
        let errorUserId: number | undefined;
        let errorUserEmail: string | undefined;
        try {
            const errorUser = await getAuthenticatedUser();
            errorUserId = errorUser.id;
            errorUserEmail = errorUser.email || undefined;
        } catch {
            // ユーザー取得失敗は無視
        }

        logActivity({
            userId: errorUserId,
            userEmail: errorUserEmail,
            userType: 'WORKER',
            action: 'BOOKMARK_CREATE',
            requestData: {
                jobId,
                type,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return {
            success: false,
            error: 'ブックマークの追加に失敗しました',
        };
    }
}

/**
 * 求人のブックマークを削除
 */
export async function removeJobBookmark(jobId: string, type: 'FAVORITE' | 'WATCH_LATER') {
    try {
        const user = await getAuthenticatedUser();
        const jobIdNum = parseInt(jobId, 10);

        if (isNaN(jobIdNum)) {
            return {
                success: false,
                error: '無効な求人IDです',
            };
        }

        const deleteResult = await prisma.bookmark.deleteMany({
            where: {
                user_id: user.id,
                target_job_id: jobIdNum,
                type,
            },
        });

        revalidatePath('/jobs/' + jobId);
        revalidatePath('/bookmarks');
        revalidatePath('/favorites');

        // ログ記録
        logActivity({
            userId: user.id,
            userType: 'WORKER',
            action: 'BOOKMARK_DELETE',
            requestData: {
                jobId: jobIdNum,
                type,
                deletedCount: deleteResult.count,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            message: type === 'FAVORITE' ? 'お気に入りから削除しました' : '後で見るから削除しました',
        };
    } catch (error) {
        console.error('[removeJobBookmark] Error:', error);

        // エラーログ記録（userが取得できていれば使用）
        let errorUserId: number | undefined;
        let errorUserEmail: string | undefined;
        try {
            const errorUser = await getAuthenticatedUser();
            errorUserId = errorUser.id;
            errorUserEmail = errorUser.email || undefined;
        } catch {
            // ユーザー取得失敗は無視
        }

        logActivity({
            userId: errorUserId,
            userEmail: errorUserEmail,
            userType: 'WORKER',
            action: 'BOOKMARK_DELETE',
            requestData: {
                jobId,
                type,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return {
            success: false,
            error: 'ブックマークの削除に失敗しました',
        };
    }
}

/**
 * 求人がブックマーク済みかチェック
 */
export async function isJobBookmarked(jobId: string, type: 'FAVORITE' | 'WATCH_LATER') {
    try {
        const user = await getAuthenticatedUser();
        const jobIdNum = parseInt(jobId, 10);

        if (isNaN(jobIdNum)) {
            return false;
        }

        const bookmark = await prisma.bookmark.findFirst({
            where: {
                user_id: user.id,
                target_job_id: jobIdNum,
                type,
            },
        });

        return !!bookmark;
    } catch (error) {
        console.error('[isJobBookmarked] Error:', error);
        return false;
    }
}

/**
 * ユーザーがブックマークした求人一覧を取得
 */
export async function getBookmarkedJobs(type: 'FAVORITE' | 'WATCH_LATER', options?: { limit?: number; offset?: number }) {
    try {
        const user = await getAuthenticatedUser();

        const limit = options?.limit ?? 50; // デフォルト50件
        const offset = options?.offset ?? 0;

        const bookmarks = await prisma.bookmark.findMany({
            where: {
                user_id: user.id,
                type,
                target_job_id: {
                    not: null,
                },
            },
            include: {
                targetJob: {
                    include: {
                        facility: {
                            select: {
                                id: true,
                                corporation_name: true,
                                facility_name: true,
                                facility_type: true,
                                address: true,
                                lat: true,
                                lng: true,
                                images: true,
                                rating: true,
                                review_count: true,
                                created_at: true,
                                updated_at: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
            take: limit,
            skip: offset,
        });

        return bookmarks
            .filter((bookmark) => bookmark.targetJob !== null)
            .map((bookmark) => ({
                bookmarkId: bookmark.id,
                addedAt: bookmark.created_at.toISOString(),
                job: bookmark.targetJob!,
            }));
    } catch (error) {
        console.error('[getBookmarkedJobs] Error:', error);
        return [];
    }
}

/**
 * 限定求人・オファーの件数を取得（ワーカー向けドロップダウン用）
 */
export async function getJobListTypeCounts(): Promise<{
    all: number;
    limited: number;
    offer: number;
}> {
    const now = getCurrentTime();
    // 日本時間（JST）での今日の開始時刻を使用
    const todayStart = getJSTTodayStart(now);

    // 基本条件（表示可能な求人）
    const baseConditions: any = {
        status: { in: ['PUBLISHED', 'WORKING', 'COMPLETED'] },
        workDates: {
            some: {
                AND: [
                    { work_date: { gte: todayStart } },
                    {
                        OR: [
                            { visible_from: { lte: now } },
                            { visible_from: null }
                        ]
                    },
                    {
                        OR: [
                            { visible_until: { gte: now } },
                            { visible_until: null }
                        ]
                    }
                ]
            }
        },
        facility: {
            deleted_at: null,
        }
    };

    // 「すべて」の件数（通常求人・説明会）
    const allCount = await prisma.job.count({
        where: {
            ...baseConditions,
            job_type: { in: ['NORMAL', 'ORIENTATION'] },
        },
    });

    // 限定求人・オファーはログインユーザーの情報が必要
    let limitedCount = 0;
    let offerCount = 0;

    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
            const userId = parseInt(session.user.id, 10);

            // 限定求人クエリを並列実行（パフォーマンス改善）
            const [workedApplications, favoriteBookmarks] = await Promise.all([
                // 限定求人（勤務済み）の対象施設を取得
                prisma.application.findMany({
                    where: {
                        user_id: userId,
                        status: 'COMPLETED_RATED',
                    },
                    select: {
                        workDate: {
                            select: {
                                job: {
                                    select: {
                                        facility_id: true,
                                    },
                                },
                            },
                        },
                    },
                }),
                // 限定求人（お気に入り）の対象施設を取得
                prisma.bookmark.findMany({
                    where: {
                        target_user_id: userId,
                        type: 'FAVORITE',
                        facility_id: { not: null },
                    },
                    select: {
                        facility_id: true,
                    },
                }),
            ]);

            const workedFacilityIds = Array.from(new Set(
                workedApplications
                    .map(app => app.workDate?.job?.facility_id)
                    .filter((id): id is number => id !== null && id !== undefined)
            ));
            const favoritedByFacilityIds = favoriteBookmarks
                .map(b => b.facility_id)
                .filter((id): id is number => id !== null);

            // 限定求人の件数を取得
            if (workedFacilityIds.length > 0 || favoritedByFacilityIds.length > 0) {
                const limitedConditions: any[] = [];

                if (workedFacilityIds.length > 0) {
                    limitedConditions.push({
                        job_type: 'LIMITED_WORKED',
                        facility_id: { in: workedFacilityIds },
                    });
                }

                if (favoritedByFacilityIds.length > 0) {
                    limitedConditions.push({
                        job_type: 'LIMITED_FAVORITE',
                        facility_id: { in: favoritedByFacilityIds },
                    });
                }

                limitedCount = await prisma.job.count({
                    where: {
                        ...baseConditions,
                        OR: limitedConditions,
                    },
                });
            }

            // オファーの件数を取得
            offerCount = await prisma.job.count({
                where: {
                    ...baseConditions,
                    job_type: 'OFFER',
                    target_worker_id: userId,
                },
            });
        }
    } catch (error) {
        console.error('[getJobListTypeCounts] Error:', error);
    }

    return {
        all: allCount,
        limited: limitedCount,
        offer: offerCount,
    };
}
