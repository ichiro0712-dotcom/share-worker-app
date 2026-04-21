import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import ThanksClient from './ThanksClient';

export const dynamic = 'force-dynamic';

/**
 * 登録 LP の cta_url を取得。ユーザーの registration_lp_id から
 * LandingPage.cta_url を引く（環境変数に依存しない）
 */
async function resolveLineUrlForUser(userId: number): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { registration_lp_id: true },
    });
    if (!user?.registration_lp_id) return '';
    const lpNum = parseInt(user.registration_lp_id, 10);
    if (isNaN(lpNum)) return '';
    const lp = await prisma.landingPage.findUnique({
      where: { lp_number: lpNum },
      select: { cta_url: true },
    });
    return lp?.cta_url ?? '';
  } catch (e) {
    console.error('[thanks] Failed to resolve LINE URL:', e);
    return '';
  }
}

export default async function RegisterThanksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 登録完了を経ずに直接アクセスされた場合のフォールバック
    redirect('/login');
  }

  const userId = parseInt(session.user.id, 10);
  const lineUrl = await resolveLineUrlForUser(userId);

  return <ThanksClient userName={session.user.name ?? ''} lineUrl={lineUrl} />;
}
