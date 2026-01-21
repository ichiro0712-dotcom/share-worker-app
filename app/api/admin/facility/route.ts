'use server';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId');

    if (!facilityId) {
      return NextResponse.json({ error: '施設IDが必要です' }, { status: 400 });
    }

    const facility = await prisma.facility.findUnique({
      where: { id: parseInt(facilityId) },
      select: {
        id: true,
        facility_name: true,
        corporation_name: true,
        address: true,
        phone_number: true,
        emergency_attendance_code: true,
        qr_secret_token: true,
        qr_generated_at: true,
      },
    });

    if (!facility) {
      return NextResponse.json({ error: '施設が見つかりません' }, { status: 404 });
    }

    return NextResponse.json(facility);
  } catch (error) {
    console.error('Error fetching facility:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
