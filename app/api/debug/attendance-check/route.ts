/**
 * デバッグ用API: 出退勤ボタン表示条件の確認
 *
 * GET /api/debug/attendance-check?userId=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = parseInt(searchParams.get('userId') || '1', 10);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 本日の勤務予定を確認
  const todayApplication = await prisma.application.findFirst({
    where: {
      user_id: userId,
      status: 'SCHEDULED',
      workDate: {
        work_date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    },
    include: {
      workDate: true,
      user: { select: { email: true } }
    }
  });

  // 出勤中レコードを確認
  const attendance = await prisma.attendance.findFirst({
    where: {
      user_id: userId,
      status: 'CHECKED_IN',
      check_out_time: null
    }
  });

  // 全SCHEDULED応募
  const allScheduled = await prisma.application.findMany({
    where: {
      user_id: userId,
      status: 'SCHEDULED'
    },
    include: { workDate: true },
    take: 5
  });

  return NextResponse.json({
    debug: {
      serverTime: now.toISOString(),
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      nodeEnv: process.env.NODE_ENV,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    result: {
      hasTodayJob: !!todayApplication,
      isCheckedIn: !!attendance,
      shouldShowButton: !!todayApplication || !!attendance || process.env.NODE_ENV === 'development',
    },
    todayApplication: todayApplication ? {
      id: todayApplication.id,
      status: todayApplication.status,
      workDate: todayApplication.workDate.work_date.toISOString(),
      userEmail: todayApplication.user.email
    } : null,
    attendance: attendance ? {
      id: attendance.id,
      status: attendance.status,
      checkInTime: attendance.check_in_time.toISOString()
    } : null,
    allScheduledApplications: allScheduled.map(a => ({
      id: a.id,
      status: a.status,
      workDate: a.workDate.work_date.toISOString()
    }))
  });
}
