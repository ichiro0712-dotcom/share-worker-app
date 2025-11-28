import { getConversations } from '@/src/lib/actions';
import MessagesClient from './MessagesClient';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);

  // 未ログイン時はログインページへリダイレクト
  if (!session) {
    redirect('/login?callbackUrl=/messages');
  }

  const conversations = await getConversations();

  return <MessagesClient initialConversations={conversations} />;
}
