import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ThanksClient from './ThanksClient';

export const dynamic = 'force-dynamic';

// Lステップのサンクスページ経由を識別するための専用URL（lp=jOaQo9 が「サンクスページ流入」のシナリオ分岐キー）
const THANKS_LINE_URL =
  'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=jOaQo9&liff_id=2009053059-UzfNXDJd';

export default async function RegisterThanksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 登録完了を経ずに直接アクセスされた場合のフォールバック
    redirect('/login');
  }

  return <ThanksClient userName={session.user.name ?? ''} lineUrl={THANKS_LINE_URL} />;
}
