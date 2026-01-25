'use client';

/**
 * 勤怠変更申請ページ
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Building2, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { ModificationForm, type ModificationFormData } from '@/components/attendance/ModificationForm';
import { DifferenceConfirm } from '@/components/attendance/DifferenceConfirm';
import {
  getAttendanceById,
  createModificationRequest,
  resubmitModificationRequest,
} from '@/src/lib/actions/attendance';
import { calculateSalary } from '@/src/lib/salary-calculator';

type PageStep = 'form' | 'confirm';

// Server Actionから返される形式（ISO文字列）
interface AttendanceDataFromServer {
  id: number;
  checkInTime: string;
  checkOutTime: string | null;
  facility: {
    id: number;
    facility_name: string;
  };
  application: {
    id: number;
    workDate: {
      workDate: string;
      job: {
        id: number;
        title: string;
        startTime: string;
        endTime: string;
        breakTime: string;
        hourly_wage: number;
        transportation_fee: number;
      };
    };
  } | null;
  modificationRequest: {
    id: number;
    status: string;
    admin_comment: string | null;
    reviewed_at: string | null;
    requested_start_time: string;
    requested_end_time: string;
    requested_break_time: number;
  } | null;
}

// クライアント側で使用する形式（Dateに変換済み）
interface AttendanceData {
  id: number;
  checkInTime: Date;
  checkOutTime: Date | null;
  facility: {
    id: number;
    facility_name: string;
  };
  application: {
    id: number;
    workDate: {
      workDate: Date;
      job: {
        id: number;
        title: string;
        startTime: string;
        endTime: string;
        breakTime: string;
        hourly_wage: number;
        transportation_fee: number;
      };
    };
  } | null;
  modificationRequest: {
    id: number;
    status: string;
    admin_comment: string | null;
    reviewed_at: Date | null;
    requested_start_time: Date;
    requested_end_time: Date;
    requested_break_time: number;
  } | null;
}

// Server Actionのレスポンスをクライアント形式に変換
function convertToClientFormat(data: AttendanceDataFromServer): AttendanceData {
  return {
    id: data.id,
    checkInTime: new Date(data.checkInTime),
    checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : null,
    facility: data.facility,
    application: data.application
      ? {
          id: data.application.id,
          workDate: {
            workDate: new Date(data.application.workDate.workDate),
            job: data.application.workDate.job,
          },
        }
      : null,
    modificationRequest: data.modificationRequest
      ? {
          id: data.modificationRequest.id,
          status: data.modificationRequest.status,
          admin_comment: data.modificationRequest.admin_comment,
          reviewed_at: data.modificationRequest.reviewed_at
            ? new Date(data.modificationRequest.reviewed_at)
            : null,
          requested_start_time: new Date(data.modificationRequest.requested_start_time),
          requested_end_time: new Date(data.modificationRequest.requested_end_time),
          requested_break_time: data.modificationRequest.requested_break_time,
        }
      : null,
  };
}

// ローディングコンポーネント
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">読み込み中...</div>
    </div>
  );
}

// メインコンテンツコンポーネント（useSearchParamsを使用）
function ModificationContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const attendanceIdParam = searchParams.get('attendanceId');
  const resubmitIdParam = searchParams.get('resubmit');

  const [step, setStep] = useState<PageStep>('form');
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // フォームデータ
  const [formData, setFormData] = useState<ModificationFormData | null>(null);

  // 金額計算結果
  const [originalAmount, setOriginalAmount] = useState(0);
  const [requestedAmount, setRequestedAmount] = useState(0);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated || authLoading) return;

      const id = attendanceIdParam ? parseInt(attendanceIdParam) : null;
      if (!id) {
        toast.error('勤怠IDが指定されていません');
        router.push('/mypage/applications');
        return;
      }

      try {
        const serverData = await getAttendanceById(id);
        console.log('[ModifyPage] serverData:', JSON.stringify(serverData, null, 2));
        if (!serverData) {
          toast.error('勤怠記録が見つかりません');
          router.push('/mypage/applications');
          return;
        }

        // ISO文字列からDateオブジェクトに変換
        const data = convertToClientFormat(serverData);
        console.log('[ModifyPage] converted data:', {
          id: data.id,
          hasApplication: !!data.application,
          job: data.application?.workDate?.job,
        });
        setAttendance(data);

        // 規定金額の計算
        if (data.application) {
          const job = data.application.workDate.job;
          console.log('[ModifyPage] job:', job);
          const workDate = data.application.workDate.workDate;

          // nullチェックを追加
          if (!job.startTime || !job.endTime) {
            console.error('[ModifyPage] job.startTime or job.endTime is undefined', job);
            toast.error('求人データが不完全です');
            return;
          }

          const [startHour, startMinute] = job.startTime.split(':').map(Number);
          const [endHour, endMinute] = job.endTime.split(':').map(Number);
          const breakTimeMinutes = parseInt(job.breakTime, 10);

          const scheduledStart = new Date(workDate);
          scheduledStart.setHours(startHour, startMinute, 0, 0);

          const scheduledEnd = new Date(workDate);
          scheduledEnd.setHours(endHour, endMinute, 0, 0);
          if (scheduledEnd <= scheduledStart) {
            scheduledEnd.setDate(scheduledEnd.getDate() + 1);
          }

          const result = calculateSalary({
            startTime: scheduledStart,
            endTime: scheduledEnd,
            breakMinutes: breakTimeMinutes,
            hourlyRate: job.hourly_wage,
          });

          setOriginalAmount(result.totalPay + job.transportation_fee);
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, authLoading, attendanceIdParam, router]);

  // フォーム送信（確認画面へ）
  const handleFormSubmit = (data: ModificationFormData) => {
    if (!attendance?.application) return;

    const job = attendance.application.workDate.job;
    const workDate = new Date(attendance.application.workDate.workDate);
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);

    const requestedStart = new Date(workDate);
    requestedStart.setHours(startHour, startMinute, 0, 0);

    const requestedEnd = new Date(workDate);
    requestedEnd.setHours(endHour, endMinute, 0, 0);
    if (requestedEnd <= requestedStart) {
      requestedEnd.setDate(requestedEnd.getDate() + 1);
    }

    const result = calculateSalary({
      startTime: requestedStart,
      endTime: requestedEnd,
      breakMinutes: data.hasBreak ? data.breakTime : 0,
      hourlyRate: job.hourly_wage,
    });

    setRequestedAmount(result.totalPay + job.transportation_fee);
    setFormData(data);
    setStep('confirm');
  };

  // 申請送信
  const handleConfirm = async () => {
    if (!attendance || !formData) return;

    setIsSubmitting(true);

    try {
      const workDate = new Date(attendance.application!.workDate.workDate);
      const [startHour, startMinute] = formData.startTime.split(':').map(Number);
      const [endHour, endMinute] = formData.endTime.split(':').map(Number);

      const requestedStart = new Date(workDate);
      requestedStart.setHours(startHour, startMinute, 0, 0);

      const requestedEnd = new Date(workDate);
      requestedEnd.setHours(endHour, endMinute, 0, 0);
      if (requestedEnd <= requestedStart) {
        requestedEnd.setDate(requestedEnd.getDate() + 1);
      }

      let response;

      // 再申請の場合
      if (resubmitIdParam && attendance.modificationRequest) {
        response = await resubmitModificationRequest(
          attendance.modificationRequest.id,
          {
            requestedStartTime: requestedStart.toISOString(),
            requestedEndTime: requestedEnd.toISOString(),
            requestedBreakTime: formData.hasBreak ? formData.breakTime : 0,
            workerComment: formData.comment,
          }
        );
      } else {
        // 新規申請
        response = await createModificationRequest({
          attendanceId: attendance.id,
          requestedStartTime: requestedStart.toISOString(),
          requestedEndTime: requestedEnd.toISOString(),
          requestedBreakTime: formData.hasBreak ? formData.breakTime : 0,
          workerComment: formData.comment,
        });
      }

      if (response.success) {
        toast.success(response.message || '勤怠変更申請を提出しました');
        router.push('/mypage/applications');
      } else {
        toast.error(response.message || '申請に失敗しました');
      }
    } catch (error) {
      console.error('申請エラー:', error);
      toast.error('申請に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (!attendance || !attendance.application) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">データが見つかりません</div>
      </div>
    );
  }

  const job = attendance.application.workDate.job;
  const workDate = new Date(attendance.application.workDate.workDate);
  const isResubmit = !!resubmitIdParam && attendance.modificationRequest?.status === 'REJECTED';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-[#66cc99] text-white p-6">
        <button
          onClick={() => (step === 'confirm' ? setStep('form') : router.back())}
          className="flex items-center gap-1 text-sm opacity-90 hover:opacity-100 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 'confirm' ? '入力に戻る' : '戻る'}
        </button>
        <h1 className="text-2xl font-bold">
          {isResubmit ? '勤怠変更申請（再申請）' : '勤怠変更申請'}
        </h1>
      </div>

      <div className="max-w-lg mx-auto p-6">
        {/* 求人情報 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h3 className="font-medium text-gray-800 mb-3">{job.title}</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>{attendance.facility.facility_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {workDate.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                定刻: {job.startTime} 〜 {job.endTime}（休憩{job.breakTime}分）
              </span>
            </div>
          </div>
        </div>

        {/* フォーム or 確認 */}
        {step === 'form' ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <ModificationForm
              attendance={{
                checkInTime: attendance.checkInTime,
                checkOutTime: attendance.checkOutTime!,
              }}
              scheduledTime={{
                startTime: job.startTime,
                endTime: job.endTime,
                breakTime: parseInt(job.breakTime),
                hourlyWage: job.hourly_wage,
                transportationFee: job.transportation_fee,
              }}
              workDate={workDate}
              onSubmit={handleFormSubmit}
              isResubmit={isResubmit}
              previousRejection={
                isResubmit && attendance.modificationRequest
                  ? {
                      adminComment: attendance.modificationRequest.admin_comment || '',
                      rejectedAt: attendance.modificationRequest.reviewed_at!,
                    }
                  : undefined
              }
              isLoading={isSubmitting}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <DifferenceConfirm
              originalAmount={originalAmount}
              requestedAmount={requestedAmount}
              scheduledTime={{
                startTime: job.startTime,
                endTime: job.endTime,
                breakTime: parseInt(job.breakTime),
              }}
              requestedTime={{
                startTime: formData!.startTime,
                endTime: formData!.endTime,
                breakTime: formData!.hasBreak ? formData!.breakTime : 0,
              }}
              transportationFee={job.transportation_fee}
              onConfirm={handleConfirm}
              onBack={() => setStep('form')}
              isLoading={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// メインエクスポート（Suspense境界でラップ）
export default function ModificationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ModificationContent />
    </Suspense>
  );
}
