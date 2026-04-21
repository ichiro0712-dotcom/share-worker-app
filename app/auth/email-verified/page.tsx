import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sanitizeReturnUrl } from '@/src/lib/auth/return-url';
import EmailVerifiedClient from './EmailVerifiedClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { returnUrl?: string };
}

export default async function EmailVerifiedPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 認証後は auto-login で Cookie 発行済みのはずだが、保険として /login に誘導
    redirect('/login?verified=true');
  }

  // email_verified が実際に true になっているか DB で確認
  // 未認証ユーザーが直打ちでこのページに到達できないようにする
  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id, 10) },
    select: { email_verified: true },
  });
  if (!user?.email_verified) {
    redirect('/auth/verify-pending');
  }

  const returnUrl = sanitizeReturnUrl(searchParams.returnUrl);

  return (
    <EmailVerifiedClient
      userName={session.user.name ?? ''}
      returnUrl={returnUrl}
    />
  );
}
