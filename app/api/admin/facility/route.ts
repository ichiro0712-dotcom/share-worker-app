import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFacilityAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const facilityId = parseInt(searchParams.get('facilityId') || '0');

  return withFacilityAuth(facilityId, async (validatedFacilityId) => {
    const facility = await prisma.facility.findUnique({
      where: { id: validatedFacilityId },
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
      throw new Error('施設が見つかりません');
    }

    return facility;
  });
}
