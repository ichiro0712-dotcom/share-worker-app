import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ThanksClient from './ThanksClient';

export const dynamic = 'force-dynamic';

export default async function RegisterThanksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    // 登録完了を経ずに直接アクセスされた場合のフォールバック
    redirect('/login');
  }

  const lineUrl = process.env.NEXT_PUBLIC_REGISTER_LINE_URL || '';

  return <ThanksClient userName={session.user.name ?? ''} lineUrl={lineUrl} />;
}
