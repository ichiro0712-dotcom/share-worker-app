import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import ThanksClient from './ThanksClient';

export const dynamic = 'force-dynamic';

/**
 * LINE 友だち追加 URL を取得。優先順位:
 * 1. 登録時の LP (user.registration_lp_id) の LandingPage.cta_url
 * 2. LpLineTag の is_default=true のエントリの URL
 * 3. 空文字（LINE ボタン非表示）
 * 環境変数に依存しない。DB 側は LP 管理画面 / LINE タグ管理画面から設定可能
 */
async function resolveLineUrlForUser(userId: number): Promise<string> {
  try {
    // 1. 登録 LP の cta_url
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { registration_lp_id: true },
    });
    if (user?.registration_lp_id) {
      const lpNum = parseInt(user.registration_lp_id, 10);
      if (!isNaN(lpNum)) {
        const lp = await prisma.landingPage.findUnique({
          where: { lp_number: lpNum },
          select: { cta_url: true },
        });
        if (lp?.cta_url) return lp.cta_url;
      }
    }

    // 2. フォールバック: デフォルト LINE タグ（複数 is_default=true があっても安定選択）
    const defaultTag = await prisma.lpLineTag.findFirst({
      where: { is_default: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      select: { url: true },
    });
    return defaultTag?.url ?? '';
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
