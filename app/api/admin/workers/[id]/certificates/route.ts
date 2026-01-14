import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 施設管理者の認証チェック（iron-session）
    const session = await getFacilityAdminSessionData();

    if (!session || !session.isLoggedIn) {
      return NextResponse.json(
        { error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const workerId = parseInt(params.id);

    if (isNaN(workerId)) {
      return NextResponse.json(
        { error: '無効なワーカーIDです' },
        { status: 400 }
      );
    }

    // ワーカー情報を取得
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        name: true,
        qualifications: true,
        qualification_certificates: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { error: 'ワーカーが見つかりません' },
        { status: 404 }
      );
    }

    // 資格証明書データを整形
    const qualificationCertificates: Record<string, string> = {};

    if (worker.qualification_certificates) {
      const certs = worker.qualification_certificates as Record<string, unknown>;
      for (const [key, value] of Object.entries(certs)) {
        if (typeof value === 'string') {
          // 新形式: 直接URLが保存されている
          qualificationCertificates[key] = value;
        } else if (value && typeof value === 'object' && 'certificate_image' in value) {
          // 旧形式: { certificate_image: string, acquired_date?: string }
          const certImage = (value as { certificate_image?: string }).certificate_image;
          if (certImage && typeof certImage === 'string') {
            qualificationCertificates[key] = certImage;
          }
        }
      }
    }

    return NextResponse.json({
      workerId: worker.id,
      workerName: worker.name,
      qualifications: (worker.qualifications as string[]) || [],
      qualificationCertificates,
    });
  } catch (error) {
    console.error('[Worker Certificates API] Error:', error);
    return NextResponse.json(
      { error: '資格証明書の取得に失敗しました' },
      { status: 500 }
    );
  }
}
