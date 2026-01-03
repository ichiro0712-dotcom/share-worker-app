import { Suspense } from 'react';
import { getGroupedConversations } from '@/src/lib/actions';
import { MessagesContent } from './MessagesContent';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

// タブの型定義
type TabType = 'messages' | 'notifications';

interface MessagesPageProps {
  searchParams: Promise<{ tab?: string; facilityId?: string }>;
}

// ローディングスケルトン（メッセージリスト用）
function MessagesListSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// データ取得用Server Component（Suspense境界内で実行）
async function MessagesDataLoader({
  userId,
  initialTab,
  initialFacilityId,
}: {
  userId: number;
  initialTab: TabType;
  initialFacilityId: number | null;
}) {
  // データ取得はここで行う（Suspense内なのでストリーミング可能）
  const initialConversations = await getGroupedConversations();

  return (
    <MessagesContent
      userId={userId}
      initialConversations={initialConversations}
      initialTab={initialTab}
      initialFacilityId={initialFacilityId}
    />
  );
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const session = await getServerSession(authOptions);

  // 未ログイン時はログインページへリダイレクト
  if (!session) {
    redirect('/login?callbackUrl=/messages');
  }

  const userId = session.user?.id ? parseInt(session.user.id) : 0;

  // URLパラメータからタブを取得（軽量な処理なのでここで実行）
  const params = await searchParams;
  const initialTab: TabType = params.tab === 'notifications' ? 'notifications' : 'messages';
  const initialFacilityId = params.facilityId ? parseInt(params.facilityId, 10) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 静的ヘッダー - 即座にHTML表示 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">メッセージ</h1>
        </div>

        {/* 静的タブ - 即座にHTML表示 */}
        <div className="flex border-t border-gray-200">
          <Link
            href="/messages"
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
              initialTab === 'messages'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            メッセージ
          </Link>
          <Link
            href="/messages?tab=notifications"
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
              initialTab === 'notifications'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            お知らせ
          </Link>
        </div>
      </div>

      {/* 動的コンテンツ - Suspenseでストリーミング */}
      <Suspense fallback={<MessagesListSkeleton />}>
        <MessagesDataLoader
          userId={userId}
          initialTab={initialTab}
          initialFacilityId={initialFacilityId}
        />
      </Suspense>
    </div>
  );
}
