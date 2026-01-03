import Link from 'next/link';
import { MyJobsContent } from './MyJobsContent';

// タブ定義
const tabs = [
  { id: 'applied', label: '審査中', href: '/my-jobs?tab=applied' },
  { id: 'scheduled', label: '仕事の予定', href: '/my-jobs' },
  { id: 'working', label: '勤務中', href: '/my-jobs?tab=working' },
  { id: 'completed_rated', label: '完了', href: '/my-jobs?tab=completed_rated' },
  { id: 'cancelled', label: 'キャンセル', href: '/my-jobs?tab=cancelled' },
] as const;

type TabType = typeof tabs[number]['id'];

interface MyJobsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MyJobsPage({ searchParams }: MyJobsPageProps) {
  const params = await searchParams;
  const initialTab: TabType = (
    params.tab && ['applied', 'scheduled', 'working', 'completed_rated', 'cancelled'].includes(params.tab)
      ? params.tab
      : 'scheduled'
  ) as TabType;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 静的ヘッダー - Server Component（即座にHTML表示） */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">仕事管理</h1>
      </div>

      {/* 静的タブ - Server Component（即座にHTML表示） */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                initialTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 動的コンテンツ - Client Component */}
      <MyJobsContent initialTab={initialTab} />
    </div>
  );
}
