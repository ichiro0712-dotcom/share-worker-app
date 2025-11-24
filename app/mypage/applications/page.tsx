import { getMyApplications } from '@/src/lib/actions';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';

// ステータスの日本語表示
const statusLabels: Record<string, string> = {
  APPLIED: '応募中',
  SCHEDULED: '勤務予定',
  WORKING: '勤務中',
  COMPLETED_PENDING: '評価待ち',
  COMPLETED_RATED: '完了',
  CANCELLED: 'キャンセル',
};

// ステータスのカラー
const statusColors: Record<string, 'default' | 'yellow' | 'red' | 'green'> = {
  APPLIED: 'yellow',
  SCHEDULED: 'green',
  WORKING: 'default',
  COMPLETED_PENDING: 'yellow',
  COMPLETED_RATED: 'default',
  CANCELLED: 'red',
};

// 日付フォーマット関数
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

// 時刻フォーマット関数
function formatTime(timeString: string): string {
  return timeString.substring(0, 5); // "HH:MM:SS" -> "HH:MM"
}

export default async function ApplicationsPage() {
  const applications = await getMyApplications();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center">
          <Link href="/mypage" className="mr-4">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold">応募履歴</h1>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 mb-4">まだ応募履歴がありません</p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              求人を探す
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => (
              <div
                key={application.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link href={`/jobs/${application.job.id}`}>
                  <div className="p-4">
                    {/* ステータスバッジ */}
                    <div className="flex justify-between items-start mb-3">
                      <Badge variant={statusColors[application.status] || 'default'}>
                        {statusLabels[application.status] || application.status}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        応募日: {formatDate(application.created_at)}
                      </span>
                    </div>

                    {/* 求人情報 */}
                    <h3 className="font-bold text-lg mb-2 line-clamp-2">
                      {application.job.title}
                    </h3>

                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-gray-600">
                        {application.job.facility.facility_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        勤務日: {formatDate(application.job.work_date)}
                      </p>
                      <p className="text-sm text-gray-600">
                        時間: {formatTime(application.job.start_time)} 〜{' '}
                        {formatTime(application.job.end_time)}
                      </p>
                    </div>

                    {/* 報酬情報 */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div>
                        <span className="text-lg font-bold text-red-500">
                          {application.job.wage.toLocaleString()}円
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          (時給 {application.job.hourly_wage.toLocaleString()}円)
                        </span>
                      </div>
                      <div className="flex items-center text-primary text-sm">
                        詳細を見る
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
