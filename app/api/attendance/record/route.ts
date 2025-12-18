import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, facilityId, type, latitude, longitude, applicationId, jobId } = body;

    // バリデーション
    if (!userId || !facilityId || !type) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    if (type !== 'check_in' && type !== 'check_out') {
      return NextResponse.json(
        { error: 'Invalid attendance type' },
        { status: 400 }
      );
    }

    // ユーザーと施設の存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
    });

    if (!user || !facility) {
      return NextResponse.json(
        { error: 'User or facility not found' },
        { status: 404 }
      );
    }

    if (type === 'check_in') {
      // 出勤記録を作成
      const attendance = await prisma.attendance.create({
        data: {
          user_id: userId,
          facility_id: facilityId,
          application_id: applicationId || null,
          job_id: jobId || null,
          check_in_time: new Date(),
          check_in_lat: latitude || null,
          check_in_lng: longitude || null,
          status: 'CHECKED_IN',
        },
      });

      return NextResponse.json({
        success: true,
        attendanceId: attendance.id,
        message: '出勤を記録しました',
      });
    } else {
      // 退勤記録を更新
      // 最新の出勤記録を取得（まだ退勤していないもの）
      const latestAttendance = await prisma.attendance.findFirst({
        where: {
          user_id: userId,
          facility_id: facilityId,
          status: 'CHECKED_IN',
          check_out_time: null,
        },
        orderBy: {
          check_in_time: 'desc',
        },
      });

      if (!latestAttendance) {
        return NextResponse.json(
          { error: '出勤記録が見つかりません' },
          { status: 404 }
        );
      }

      // 退勤時刻を更新
      const attendance = await prisma.attendance.update({
        where: { id: latestAttendance.id },
        data: {
          check_out_time: new Date(),
          check_out_lat: latitude || null,
          check_out_lng: longitude || null,
          status: 'CHECKED_OUT',
        },
      });

      return NextResponse.json({
        success: true,
        attendanceId: attendance.id,
        message: '退勤を記録しました',
      });
    }
  } catch (error) {
    console.error('Attendance record error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
