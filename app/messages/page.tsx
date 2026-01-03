import { Suspense } from 'react';
import { getGroupedConversations } from '@/src/lib/actions';
import { MessagesContent } from './MessagesContent';
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

// データ取得用Server Component（Suspense境界内で実行 - すべてのawaitをここに集約）
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

// タブ表示用コンポーネント（searchParamsを非同期で取得）
async function TabsWithActiveState({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; facilityId?: string }>;
}) {
  const params = await searchParams;
  const activeTab: TabType = params.tab === 'notifications' ? 'notifications' : 'messages';

  return (
    <div className="flex border-t border-gray-200">
      <Link
        href="/messages"
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
          activeTab === 'messages'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        メッセージ
      </Link>
      <Link
        href="/messages?tab=notifications"
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
          activeTab === 'notifications'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        お知らせ
      </Link>
    </div>
  );
}

// タブのスケルトン
function TabsSkeleton() {
  return (
    <div className="flex border-t border-gray-200">
      <div className="flex-1 py-3 text-sm font-medium border-b-2 border-transparent text-gray-400 text-center">
        メッセージ
      </div>
      <div className="flex-1 py-3 text-sm font-medium border-b-2 border-transparent text-gray-400 text-center">
        お知らせ
      </div>
    </div>
  );
}

export default function MessagesPage({ searchParams }: MessagesPageProps) {
  // ミドルウェアで認証済み。ここではawaitなし = 即座にHTMLを返す
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 静的ヘッダー - 即座にHTML表示 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">メッセージ</h1>
        </div>

        {/* タブ - アクティブ状態はストリーミング */}
        <Suspense fallback={<TabsSkeleton />}>
          <TabsWithActiveState searchParams={searchParams} />
        </Suspense>
      </div>

      {/* 動的コンテンツ - Suspenseでストリーミング */}
      <Suspense fallback={<MessagesListSkeleton />}>
        <MessagesDataLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
