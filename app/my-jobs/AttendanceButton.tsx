'use client';

/**
 * 仕事管理ヘッダー用 出勤/退勤ボタン
 *
 * - 勤務当日のみ表示（開発環境では常に表示）
 * - 出勤前: 「出勤」ボタン表示
 * - 出勤後: 「退勤」ボタン表示
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { getCheckInStatus } from '@/src/lib/actions/attendance';
import type { CheckInStatusResponse } from '@/src/types/attendance';

// 開発環境かどうか
const isDev = process.env.NODE_ENV === 'development';

export function AttendanceButton() {
  const router = useRouter();
  const [status, setStatus] = useState<CheckInStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTodayJob, setHasTodayJob] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const checkInStatus = await getCheckInStatus();
      setStatus(checkInStatus);
      // 本日の勤務予定があるかどうか
      setHasTodayJob(checkInStatus.hasTodayJob || false);
    } catch (error) {
      console.error('出勤状態の取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleClick = () => {
    if (status?.isCheckedIn) {
      // 退勤モードで出退勤リーダーを開く
      router.push('/attendance?mode=checkout');
    } else {
      // 出勤モードで出退勤リーダーを開く
      router.push('/attendance?mode=checkin');
    }
  };

  // ローディング中は何も表示しない
  if (loading) {
    return null;
  }

  // 本日の勤務予定がない場合は非表示（開発環境では常に表示）
  if (!isDev && !hasTodayJob && !status?.isCheckedIn) {
    return null;
  }

  // 出勤中かどうかでボタンの表示を切り替え
  const isCheckedIn = status?.isCheckedIn || false;

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isCheckedIn
          ? 'bg-orange-500 hover:bg-orange-600 text-white'
          : 'bg-primary hover:bg-primary/90 text-white'
      }`}
    >
      {isCheckedIn ? (
        <>
          <LogOut className="w-4 h-4" />
          <span>退勤</span>
        </>
      ) : (
        <>
          <LogIn className="w-4 h-4" />
          <span>出勤</span>
        </>
      )}
    </button>
  );
}
