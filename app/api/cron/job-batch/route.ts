import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Cron APIの認証を検証
 * CRON_SECRET環境変数またはAuthorizationヘッダーで認証
 */
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // 開発環境では認証をスキップ可能（ただし警告を出す）
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    console.warn('[CRON] Warning: CRON_SECRET is not set. Skipping auth in development.');
    return true;
  }

  // 本番環境ではCRON_SECRETが必須
  if (!cronSecret) {
    console.error('[CRON] Error: CRON_SECRET environment variable is not set');
    return false;
  }

  // Authorizationヘッダーをチェック
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // クエリパラメータでのシークレットもサポート（Vercel Cronなど用）
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret === cronSecret) {
    return true;
  }

  return false;
}

/**
 * 日本時間の0時（JST）に実行されるバッチ処理
 * 1. 限定求人 → 通常求人 自動切り替え
 * 2. 期限切れオファーの自動削除（ステータスをSTOPPEDに変更）
 */
export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronAuth(request)) {
    console.warn('[CRON JOB-BATCH] Unauthorized cron request attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const results = {
    limitedJobsSwitched: 0,
    childJobsCreated: 0,
    offersExpired: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    console.log('[CRON JOB-BATCH] Starting batch process at:', now.toISOString());

    // ========================================
    // 1. 限定求人 → 通常求人 自動切り替え
    // ========================================
    try {
      const switchedResult = await switchLimitedJobsToNormal(now);
      results.limitedJobsSwitched = switchedResult.switched;
      results.childJobsCreated = switchedResult.childJobsCreated;
      console.log('[CRON JOB-BATCH] Limited jobs switched:', switchedResult.switched);
      console.log('[CRON JOB-BATCH] Child jobs created:', switchedResult.childJobsCreated);
    } catch (error) {
      const errMsg = `Limited job switch error: ${error}`;
      console.error('[CRON JOB-BATCH]', errMsg);
      results.errors.push(errMsg);
    }

    // ========================================
    // 2. 期限切れオファーの自動削除
    // ========================================
    try {
      const expiredResult = await expireOldOffers(now);
      results.offersExpired = expiredResult.count;
      console.log('[CRON JOB-BATCH] Offers expired:', expiredResult.count);
    } catch (error) {
      const errMsg = `Offer expiration error: ${error}`;
      console.error('[CRON JOB-BATCH]', errMsg);
      results.errors.push(errMsg);
    }

    console.log('[CRON JOB-BATCH] Batch process completed:', results);

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    console.error('[CRON JOB-BATCH] Batch process error:', error);
    return NextResponse.json(
      { success: false, error: String(error), ...results },
      { status: 500 }
    );
  }
}

/**
 * 限定求人を通常求人に切り替える
 * - LIMITED_WORKED, LIMITED_FAVORITE の求人が対象
 * - 各勤務日の switch_to_normal_days_before 日前に切り替え
 * - 複数日程の場合、該当日のみを切り出して子求人を作成
 */
async function switchLimitedJobsToNormal(now: Date): Promise<{ switched: number; childJobsCreated: number }> {
  let switched = 0;
  let childJobsCreated = 0;

  // 対象の限定求人を取得（PUBLISHED状態のみ）
  const limitedJobs = await prisma.job.findMany({
    where: {
      job_type: { in: ['LIMITED_WORKED', 'LIMITED_FAVORITE'] },
      status: 'PUBLISHED',
      switch_to_normal_days_before: { not: null },
    },
    include: {
      workDates: {
        orderBy: { work_date: 'asc' },
      },
    },
  });

  for (const job of limitedJobs) {
    const switchDaysBefore = job.switch_to_normal_days_before!;

    // 切り替え対象の日程を特定
    const datesToSwitch: typeof job.workDates = [];
    const datesToKeep: typeof job.workDates = [];

    for (const workDate of job.workDates) {
      // 切り替え日を計算: 勤務日 - switchDaysBefore
      const switchDate = new Date(workDate.work_date);
      switchDate.setDate(switchDate.getDate() - switchDaysBefore);

      // 現在時刻が切り替え日を過ぎているか
      if (now >= switchDate) {
        datesToSwitch.push(workDate);
      } else {
        datesToKeep.push(workDate);
      }
    }

    // 切り替え対象がなければスキップ
    if (datesToSwitch.length === 0) {
      continue;
    }

    // 全日程が切り替え対象の場合: 親求人自体を通常求人に変更
    if (datesToKeep.length === 0) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          job_type: 'NORMAL',
          // requires_interview は false のまま維持（即マッチング継続）
        },
      });
      switched++;
      console.log(`[CRON JOB-BATCH] Job ${job.id} switched to NORMAL (all dates)`);
    } else {
      // 一部日程のみ切り替え: 子求人を作成
      for (const dateToSwitch of datesToSwitch) {
        // 子求人を作成
        const childJob = await prisma.job.create({
          data: {
            facility_id: job.facility_id,
            template_id: job.template_id,
            status: 'PUBLISHED',
            job_type: 'NORMAL',
            title: job.title,
            start_time: job.start_time,
            end_time: job.end_time,
            break_time: job.break_time,
            wage: job.wage,
            hourly_wage: job.hourly_wage,
            transportation_fee: job.transportation_fee,
            deadline_days_before: job.deadline_days_before,
            recruitment_start_day: 0, // 即公開
            recruitment_start_time: null,
            tags: job.tags,
            address: job.address,
            prefecture: job.prefecture,
            city: job.city,
            address_line: job.address_line,
            access: job.access,
            recruitment_count: job.recruitment_count,
            overview: job.overview,
            work_content: job.work_content,
            required_qualifications: job.required_qualifications,
            required_experience: job.required_experience,
            dresscode: job.dresscode,
            dresscode_images: job.dresscode_images,
            belongings: job.belongings,
            attachments: job.attachments,
            manager_name: job.manager_name,
            manager_message: job.manager_message,
            manager_avatar: job.manager_avatar,
            images: job.images,
            inexperienced_ok: job.inexperienced_ok,
            blank_ok: job.blank_ok,
            hair_style_free: job.hair_style_free,
            nail_ok: job.nail_ok,
            uniform_provided: job.uniform_provided,
            allow_car: job.allow_car,
            meal_support: job.meal_support,
            weekly_frequency: job.weekly_frequency,
            requires_interview: false, // 即マッチング維持
            switch_to_normal_days_before: null, // 子求人には不要
            target_worker_id: null,
            offer_message: null,
            parent_job_id: job.id, // 親求人ID
          },
        });

        // 子求人用のJobWorkDateを作成
        await prisma.jobWorkDate.create({
          data: {
            job_id: childJob.id,
            work_date: dateToSwitch.work_date,
            deadline: dateToSwitch.deadline,
            recruitment_count: dateToSwitch.recruitment_count,
            applied_count: 0, // 新規なので0
            matched_count: 0,
            visible_from: null, // 即公開
            visible_until: dateToSwitch.visible_until,
          },
        });

        // 親求人から該当日程を削除
        await prisma.jobWorkDate.delete({
          where: { id: dateToSwitch.id },
        });

        childJobsCreated++;
        console.log(`[CRON JOB-BATCH] Child job ${childJob.id} created from parent ${job.id} for date ${dateToSwitch.work_date.toISOString()}`);
      }

      switched++;
    }
  }

  return { switched, childJobsCreated };
}

/**
 * 期限切れオファーのステータスをSTOPPEDに変更
 * - OFFER求人でdeadlineを過ぎたものが対象
 * - Application（受諾）がない場合のみ
 */
async function expireOldOffers(now: Date): Promise<{ count: number }> {
  // 対象のオファー求人を取得
  // deadline（募集終了日時）を過ぎたオファーを特定
  const expiredOffers = await prisma.job.findMany({
    where: {
      job_type: 'OFFER',
      status: 'PUBLISHED',
      workDates: {
        every: {
          deadline: { lt: now },
        },
      },
    },
    include: {
      workDates: {
        include: {
          applications: true,
        },
      },
    },
  });

  let count = 0;

  for (const offer of expiredOffers) {
    // 受諾済み（Applicationが存在する）場合はスキップ
    const hasApplications = offer.workDates.some(
      (wd) => wd.applications.length > 0
    );

    if (hasApplications) {
      // 受諾済みの場合は通常のフロー（WORKING→COMPLETEDなど）に任せる
      continue;
    }

    // ステータスをSTOPPEDに変更
    await prisma.job.update({
      where: { id: offer.id },
      data: { status: 'STOPPED' },
    });

    count++;
    console.log(`[CRON JOB-BATCH] Offer ${offer.id} expired and stopped`);
  }

  return { count };
}
