/**
 * 本番DBのダミー画像パスをクリアするAPI
 * System Admin専用
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  // System Admin認証チェック（簡易版）
  const authHeader = request.headers.get('authorization');
  if (authHeader !== 'Bearer system-admin-cleanup-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    users: { found: 0, updated: 0, details: [] as string[] },
    facilities: { found: 0, updated: 0, details: [] as string[] },
    jobs: { found: 0, updated: 0, details: [] as string[] },
  };

  try {
    // 1. ユーザーのダミー画像をクリア
    const usersWithDummyImages = await prisma.user.findMany({
      where: {
        OR: [
          { profile_image: { contains: '/uploads/test/' } },
          { id_document: { contains: '/uploads/test/' } },
          { bank_book_image: { contains: '/uploads/test/' } },
        ],
      },
      select: {
        id: true,
        email: true,
        profile_image: true,
        id_document: true,
        bank_book_image: true,
        qualification_certificates: true,
      },
    });

    results.users.found = usersWithDummyImages.length;

    for (const user of usersWithDummyImages) {
      const updates: {
        profile_image?: null;
        id_document?: null;
        bank_book_image?: null;
        qualification_certificates?: Record<string, unknown>;
      } = {};

      if (user.profile_image?.includes('/uploads/test/')) {
        updates.profile_image = null;
        results.users.details.push(`User ${user.id}: profile_image → null`);
      }

      if (user.id_document?.includes('/uploads/test/')) {
        updates.id_document = null;
        results.users.details.push(`User ${user.id}: id_document → null`);
      }

      if (user.bank_book_image?.includes('/uploads/test/')) {
        updates.bank_book_image = null;
        results.users.details.push(`User ${user.id}: bank_book_image → null`);
      }

      // 資格証明書のダミー画像もクリア
      if (user.qualification_certificates && typeof user.qualification_certificates === 'object') {
        const certs = user.qualification_certificates as Record<string, unknown>;
        const cleanedCerts: Record<string, unknown> = {};
        let certsChanged = false;

        for (const [key, value] of Object.entries(certs)) {
          if (typeof value === 'string' && value.includes('/uploads/test/')) {
            cleanedCerts[key] = null;
            certsChanged = true;
            results.users.details.push(`User ${user.id}: qualification_certificates[${key}] → null`);
          } else if (value && typeof value === 'object' && 'certificate_image' in value) {
            const certImage = (value as { certificate_image?: string }).certificate_image;
            if (certImage?.includes('/uploads/test/')) {
              cleanedCerts[key] = null;
              certsChanged = true;
              results.users.details.push(`User ${user.id}: qualification_certificates[${key}].certificate_image → null`);
            } else {
              cleanedCerts[key] = value;
            }
          } else {
            cleanedCerts[key] = value;
          }
        }

        if (certsChanged) {
          updates.qualification_certificates = cleanedCerts;
        }
      }

      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
        results.users.updated++;
      }
    }

    // 2. 施設のダミー画像をクリア
    const allFacilities = await prisma.facility.findMany({
      select: {
        id: true,
        facility_name: true,
        images: true,
      },
    });

    const facilitiesWithDummyImages = allFacilities.filter(f =>
      f.images.some((img: string) =>
        img.includes('/images/anken.png') ||
        img.includes('/images/facilities/') ||
        img.includes('/uploads/test/')
      )
    );

    results.facilities.found = facilitiesWithDummyImages.length;

    for (const facility of facilitiesWithDummyImages) {
      const cleanedImages = facility.images.filter((img: string) => {
        const isDummy = img.includes('/images/anken.png') ||
                        img.includes('/images/facilities/') ||
                        img.includes('/uploads/test/');
        if (isDummy) {
          results.facilities.details.push(`Facility ${facility.id}: removed ${img}`);
        }
        return !isDummy;
      });

      const finalImages = cleanedImages.length > 0
        ? cleanedImages
        : ['/images/samples/facility_top_1.png'];

      await prisma.facility.update({
        where: { id: facility.id },
        data: { images: finalImages },
      });
      results.facilities.updated++;
    }

    // 3. 求人のダミー画像をクリア
    const allJobs = await prisma.job.findMany({
      select: {
        id: true,
        title: true,
        images: true,
      },
    });

    const jobsWithDummyImages = allJobs.filter(j =>
      j.images.some((img: string) =>
        img.includes('/images/anken.png') ||
        img.includes('/images/facilities/') ||
        img.includes('/uploads/test/')
      )
    );

    results.jobs.found = jobsWithDummyImages.length;

    for (const job of jobsWithDummyImages) {
      const cleanedImages = job.images.filter((img: string) => {
        const isDummy = img.includes('/images/anken.png') ||
                        img.includes('/images/facilities/') ||
                        img.includes('/uploads/test/');
        if (isDummy) {
          results.jobs.details.push(`Job ${job.id}: removed ${img}`);
        }
        return !isDummy;
      });

      const finalImages = cleanedImages.length > 0
        ? cleanedImages
        : ['/images/samples/facility_top_1.png'];

      await prisma.job.update({
        where: { id: job.id },
        data: { images: finalImages },
      });
      results.jobs.updated++;
    }

    return NextResponse.json({
      success: true,
      message: 'クリーンアップ完了',
      results,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
