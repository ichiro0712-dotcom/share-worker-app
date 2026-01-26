import { getAttendanceDetailForWorker } from '@/src/lib/actions/attendance';
import Link from 'next/link';
import {
  ChevronLeft,
  MapPin,
  Clock,
  Banknote,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  QrCode,
  KeyRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

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

// 時刻フォーマット関数（ISO文字列から時刻のみ抽出）
function formatTimeFromISO(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 時刻フォーマット関数（HH:MM:SS形式から）
function formatTime(timeString: string): string {
  return timeString.substring(0, 5);
}

// 打刻方法の表示
function getMethodLabel(method: string | null): { label: string; icon: typeof QrCode } {
  if (method === 'QR') {
    return { label: 'QRコード', icon: QrCode };
  }
  if (method === 'EMERGENCY_CODE') {
    return { label: '緊急時番号', icon: KeyRound };
  }
  return { label: '不明', icon: Clock };
}

// ステータスの表示設定
const statusConfig: Record<string, { label: string; color: 'default' | 'yellow' | 'green' | 'red'; icon: typeof Clock }> = {
  PENDING: { label: '承認待ち', color: 'yellow', icon: Clock },
  RESUBMITTED: { label: '再申請中', color: 'yellow', icon: RefreshCw },
  APPROVED: { label: '承認済み', color: 'green', icon: CheckCircle },
  REJECTED: { label: '却下', color: 'red', icon: XCircle },
};

interface Props {
  params: Promise<{ attendanceId: string }>;
}

export default async function AttendanceDetailPage({ params }: Props) {
  const { attendanceId } = await params;
  const result = await getAttendanceDetailForWorker(parseInt(attendanceId));

  if (!result.success || !result.attendance) {
    notFound();
  }

  const attendance = result.attendance;
  const job = attendance.application?.job;
  const modReq = attendance.modificationRequest;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center">
          <Link href="/my-jobs?tab=completed_rated" className="mr-4">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold">勤怠詳細</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="p-4 space-y-4">
        {/* 施設・仕事情報 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-gray-500" />
            <span className="font-bold text-lg">{attendance.facility.name}</span>
          </div>
          {job && (
            <p className="text-gray-600">{job.title}</p>
          )}
        </div>

        {/* 勤務情報セクション */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-lg border-b pb-2">勤務情報（定刻）</h3>

          {attendance.application && job && (
            <>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">勤務日</p>
                  <p className="font-medium">{formatDate(attendance.application.workDate)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">定刻時間</p>
                  <p className="font-medium">
                    {formatTime(job.startTime)} 〜 {formatTime(job.endTime)}
                    <span className="text-sm text-gray-500 ml-2">（休憩 {job.breakTime}分）</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Banknote className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">定刻報酬</p>
                  <p className="font-bold text-lg">
                    {job.wage.toLocaleString()}円
                    <span className="text-sm text-gray-500 font-normal ml-2">
                      （時給 {job.hourlyWage.toLocaleString()}円）
                    </span>
                  </p>
                  {job.transportationFee > 0 && (
                    <p className="text-sm text-gray-600">
                      交通費: {job.transportationFee.toLocaleString()}円
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 打刻情報セクション */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-lg border-b pb-2">打刻情報</h3>

          {/* 出勤 */}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${attendance.isLate ? 'bg-red-100' : 'bg-green-100'}`}>
              {attendance.isLate ? (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">出勤</p>
                {attendance.isLate && (
                  <span className="text-xs text-red-600 font-medium">遅刻</span>
                )}
              </div>
              <p className="font-medium text-lg">{formatTimeFromISO(attendance.checkInTime)}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                {(() => {
                  const { label, icon: Icon } = getMethodLabel(attendance.checkInMethod);
                  return (
                    <>
                      <Icon className="w-3 h-3" />
                      <span>{label}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 退勤 */}
          {attendance.checkOutTime ? (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">退勤</p>
                <p className="font-medium text-lg">{formatTimeFromISO(attendance.checkOutTime)}</p>
                {attendance.checkOutMethod && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    {(() => {
                      const { label, icon: Icon } = getMethodLabel(attendance.checkOutMethod);
                      return (
                        <>
                          <Icon className="w-3 h-3" />
                          <span>{label}</span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-gray-100">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500">退勤</p>
                <p className="text-gray-400">未打刻</p>
              </div>
            </div>
          )}

          {/* 計算済み報酬 */}
          {attendance.calculatedWage !== null && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">確定報酬</span>
                <span className="font-bold text-lg text-primary">
                  {attendance.calculatedWage.toLocaleString()}円
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 勤怠変更申請セクション */}
        {modReq && (
          <div className={`bg-white rounded-lg shadow-sm p-4 space-y-4 ${
            modReq.status === 'REJECTED' ? 'border-2 border-red-300' : ''
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-lg">勤怠変更申請</h3>
              {statusConfig[modReq.status] && (
                <Badge variant={statusConfig[modReq.status].color} className="flex items-center gap-1">
                  {(() => {
                    const Icon = statusConfig[modReq.status].icon;
                    return <Icon className="w-3 h-3" />;
                  })()}
                  {statusConfig[modReq.status].label}
                </Badge>
              )}
            </div>

            {/* 再申請回数 */}
            {modReq.resubmitCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-sm text-yellow-800">
                この申請は再申請です（{modReq.resubmitCount}回目）
              </div>
            )}

            {/* 申請内容 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">申請時間</p>
                  <p className="font-medium">
                    {formatTimeFromISO(modReq.requestedStartTime)} 〜 {formatTimeFromISO(modReq.requestedEndTime)}
                    <span className="text-sm text-gray-500 ml-2">（休憩 {modReq.requestedBreakTime}分）</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Banknote className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">申請報酬</p>
                  <p className="font-medium">
                    {modReq.requestedAmount.toLocaleString()}円
                    {modReq.requestedAmount !== modReq.originalAmount && (
                      <span className={`text-sm ml-2 ${
                        modReq.requestedAmount > modReq.originalAmount ? 'text-green-600' : 'text-red-600'
                      }`}>
                        （{modReq.requestedAmount > modReq.originalAmount ? '+' : ''}
                        {(modReq.requestedAmount - modReq.originalAmount).toLocaleString()}円）
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* ワーカーコメント */}
              {modReq.workerComment && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-500 mb-1">申請理由</p>
                  <p className="text-sm">{modReq.workerComment}</p>
                </div>
              )}

              {/* 申請日時 */}
              <div className="text-xs text-gray-500">
                申請日時: {formatDate(modReq.createdAt)} {formatTimeFromISO(modReq.createdAt)}
              </div>
            </div>

            {/* 却下時の理由と再申請ボタン */}
            {modReq.status === 'REJECTED' && (
              <div className="pt-3 border-t border-gray-200 space-y-3">
                {modReq.adminComment && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-bold text-red-800 mb-1">却下理由</p>
                    <p className="text-sm text-red-700">{modReq.adminComment}</p>
                  </div>
                )}
                {modReq.reviewedAt && (
                  <div className="text-xs text-gray-500">
                    却下日時: {formatDate(modReq.reviewedAt)} {formatTimeFromISO(modReq.reviewedAt)}
                  </div>
                )}
                <Link
                  href={`/attendance/modify?resubmit=${modReq.id}&attendanceId=${attendance.id}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  再申請する
                </Link>
              </div>
            )}

            {/* 承認時の情報 */}
            {modReq.status === 'APPROVED' && modReq.reviewedAt && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  承認日時: {formatDate(modReq.reviewedAt)} {formatTimeFromISO(modReq.reviewedAt)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 勤怠変更申請がない場合、新規申請ボタンを表示 */}
        {!modReq && attendance.checkOutTime && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <Link
              href={`/attendance/modify?attendanceId=${attendance.id}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Clock className="w-4 h-4" />
              勤怠変更を申請する
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
