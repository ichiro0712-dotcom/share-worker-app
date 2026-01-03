import { Suspense } from 'react';
import { getGroupedConversations } from '@/src/lib/actions';
import { MessagesContent } from './MessagesContent';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesTabs } from './MessagesTabs';

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
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; facilityId?: string }>;
}) {
  // すべての非同期処理をSuspense内で実行
  const [session, params, initialConversations] = await Promise.all([
    getServerSession(authOptions),
    searchParams,
    getGroupedConversations(),
  ]);

  const userId = session?.user?.id ? parseInt(session.user.id) : 0;
  const initialTab: TabType = params.tab === 'notifications' ? 'notifications' : 'messages';
  const initialFacilityId = params.facilityId ? parseInt(params.facilityId, 10) : null;

  return (
    <MessagesContent
      userId={userId}
      initialConversations={initialConversations}
      initialTab={initialTab}
      initialFacilityId={initialFacilityId}
    />
  );
}

export default function MessagesPage({ searchParams }: MessagesPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 静的ヘッダー + タブ - 即座にHTML表示 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">メッセージ</h1>
        </div>
        {/* タブはClient Componentでアクティブ状態を判定 */}
        <MessagesTabs />
      </div>

      {/* 動的コンテンツ - Suspenseでストリーミング */}
      <Suspense fallback={<MessagesListSkeleton />}>
        <MessagesDataLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
