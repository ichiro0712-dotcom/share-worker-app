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
        emergency_name: true,
        emergency_relation: true,
        emergency_phone: true,
        emergency_address: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { error: 'ワーカーが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      workerId: worker.id,
      workerName: worker.name,
      emergencyName: worker.emergency_name,
      emergencyRelation: worker.emergency_relation,
      emergencyPhone: worker.emergency_phone,
      emergencyAddress: worker.emergency_address,
    });
  } catch (error) {
    console.error('[Worker Emergency Contacts API] Error:', error);
    return NextResponse.json(
      { error: '緊急連絡先の取得に失敗しました' },
      { status: 500 }
    );
  }
}
