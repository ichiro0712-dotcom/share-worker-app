import { getMyApplications } from '@/src/lib/actions';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

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

// 求人種別
type JobType = 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'ORIENTATION' | 'OFFER';

// 求人種別バッジ（NORMAL以外の場合のみ表示）
const jobTypeBadges: Record<Exclude<JobType, 'NORMAL'>, { text: string; color: string }> = {
  OFFER: { text: 'オファ', color: 'bg-blue-500 text-white' },
  LIMITED_WORKED: { text: '限定', color: 'bg-purple-500 text-white' },
  LIMITED_FAVORITE: { text: '限定★', color: 'bg-yellow-500 text-white' },
  ORIENTATION: { text: '説明会', color: 'bg-teal-500 text-white' },
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
    <div className="min-h-screen bg-gray-50 pb-24">
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
          <EmptyState
            icon={FileText}
            title="まだ応募履歴がありません"
            description="気になる求人に応募してみましょう"
            actionLabel="求人を探す"
            actionLink="/"
          />
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
                        {application.status === 'CANCELLED' && application.job.requires_interview
                          ? '不採用'
                          : statusLabels[application.status] || application.status}
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
                      <div className="flex items-center gap-1.5">
                        {/* 求人種別バッジ（NORMAL以外の場合のみ） */}
                        {application.job.job_type && application.job.job_type !== 'NORMAL' && (
                          <span
                            className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${jobTypeBadges[application.job.job_type as Exclude<JobType, 'NORMAL'>]?.color || ''}`}
                          >
                            {jobTypeBadges[application.job.job_type as Exclude<JobType, 'NORMAL'>]?.text || ''}
                          </span>
                        )}
                        <p className="text-sm text-gray-600">
                          {application.job.facility.facility_name}
                        </p>
                      </div>
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
    </div>
  );
}
