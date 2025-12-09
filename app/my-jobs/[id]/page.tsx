import { getApplicationDetail } from '@/src/lib/actions';
import Link from 'next/link';
import { ChevronLeft, MapPin, Clock, Banknote, FileText, Building2, Calendar, MessageSquare, ExternalLink, Navigation, Briefcase, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { notFound } from 'next/navigation';

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

// 日付フォーマット関数
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];
  return `${year}年${month}月${day}日（${weekday}）`;
}

// 時刻フォーマット関数
function formatTime(timeString: string): string {
  return timeString.substring(0, 5); // "HH:MM:SS" -> "HH:MM"
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const application = await getApplicationDetail(parseInt(id));

  if (!application) {
    notFound();
  }

  const job = application.job;
  const facility = job.facility;
  const isMatched = application.status === 'SCHEDULED' || application.status === 'WORKING' ||
    application.status === 'COMPLETED_PENDING' || application.status === 'COMPLETED_RATED';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center">
          <Link href="/my-jobs" className="mr-4">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold">仕事詳細</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="p-4 space-y-4">
        {/* ステータスカード */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <Badge variant={statusColors[application.status] || 'default'} className="text-sm">
              {application.status === 'CANCELLED' && job.requires_interview
                ? '不採用'
                : statusLabels[application.status] || application.status}
            </Badge>
            <span className="text-xs text-gray-500">
              応募日: {formatDate(application.created_at)}
            </span>
          </div>
          <h2 className="font-bold text-xl mb-2">{job.title}</h2>
          <p className="text-gray-600">{facility.facility_name}</p>
        </div>

        {/* 勤務情報 */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-lg border-b pb-2">勤務情報</h3>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">勤務日</p>
              <p className="font-medium">{formatDate(application.work_date)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">勤務時間</p>
              <p className="font-medium">
                {formatTime(job.start_time)} 〜 {formatTime(job.end_time)}
                <span className="text-sm text-gray-500 ml-2">（休憩 {job.break_time}分）</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">勤務場所</p>
              <p className="font-medium">
                {(job.prefecture || job.city || job.address_line)
                  ? `${job.prefecture || ''}${job.city || ''}${job.address_line || ''}`
                  : (job.address || '')}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  地図で開く
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Banknote className="w-5 h-5 text-gray-500 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">報酬</p>
              <p className="font-bold text-red-500 text-lg">
                {job.wage.toLocaleString()}円
                <span className="text-sm text-gray-500 font-normal ml-2">
                  （時給 {job.hourly_wage.toLocaleString()}円）
                </span>
              </p>
              {job.transportation_fee > 0 && (
                <p className="text-sm text-gray-600">
                  交通費: {job.transportation_fee.toLocaleString()}円
                </p>
              )}
            </div>
          </div>
        </div>

        {/* リンクボタン一覧 */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          {/* 施設詳細 */}
          <Link
            href={`/facilities/${facility.id}`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-600" />
              <span className="font-medium">施設詳細</span>
            </div>
            <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
          </Link>

          {/* 業務内容 */}
          <Link
            href={`/jobs/${job.id}#pre-info`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-gray-600" />
              <span className="font-medium">業務内容</span>
            </div>
            <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
          </Link>

          {/* 持ち物 */}
          <Link
            href={`/jobs/${job.id}#pre-info`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-600" />
              <span className="font-medium">持ち物</span>
            </div>
            <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
          </Link>

          {/* 行き方 */}
          <Link
            href={`/jobs/${job.id}#pre-info`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-gray-600" />
              <span className="font-medium">行き方</span>
            </div>
            <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
          </Link>

          {/* 労働条件通知書（マッチング済みの場合のみ表示） */}
          {isMatched && (
            <Link
              href={`/my-jobs/${application.id}/labor-document`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="font-medium">労働条件通知書</span>
              </div>
              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
            </Link>
          )}

          {/* チャット */}
          <Link
            href={`/messages?facilityId=${facility.id}`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <span className="font-medium">施設とのチャット</span>
            </div>
            <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
          </Link>
        </div>
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
