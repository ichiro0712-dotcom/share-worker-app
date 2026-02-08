import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFacilityAuth } from '@/lib/api-auth';
import { generateUniqueEmergencyCode, generateQRSecretToken } from '@/src/lib/emergency-code-utils';

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

    // 緊急時出退勤番号またはQRトークンが未設定の場合、自動生成して保存
    if (!facility.emergency_attendance_code || !facility.qr_secret_token) {
      const emergencyCode = facility.emergency_attendance_code || await generateUniqueEmergencyCode();
      const qrSecretToken = facility.qr_secret_token || generateQRSecretToken();

      const updated = await prisma.facility.update({
        where: { id: validatedFacilityId },
        data: {
          emergency_attendance_code: emergencyCode,
          qr_secret_token: qrSecretToken,
          qr_generated_at: facility.qr_generated_at || new Date(),
        },
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

      return updated;
    }

    return facility;
  });
}
