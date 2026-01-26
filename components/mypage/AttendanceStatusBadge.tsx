'use client';

import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

/** 勤怠変更申請ステータス */
export type ModificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED' | null;

interface AttendanceStatusBadgeProps {
  /** 勤怠変更申請のステータス */
  status: ModificationStatus;
  /** 勤怠ID（再申請リンク用） */
  attendanceId?: number;
  /** 勤怠変更申請ID（再申請リンク用） */
  modificationId?: number;
  /** 却下理由（ホバー時に表示） */
  adminComment?: string | null;
  /** コンパクト表示（アイコンのみ） */
  compact?: boolean;
  /** 再申請ボタンを表示するか */
  showResubmitButton?: boolean;
}

/** ステータスに応じた表示設定 */
const statusConfig: Record<NonNullable<ModificationStatus>, {
  label: string;
  color: 'default' | 'yellow' | 'green' | 'red';
  icon: typeof Clock;
  description: string;
}> = {
  PENDING: {
    label: '申請中',
    color: 'yellow',
    icon: Clock,
    description: '勤怠変更申請が施設の承認待ちです',
  },
  RESUBMITTED: {
    label: '再申請中',
    color: 'yellow',
    icon: RefreshCw,
    description: '再申請が施設の承認待ちです',
  },
  APPROVED: {
    label: '承認済',
    color: 'green',
    icon: CheckCircle,
    description: '勤怠変更申請が承認されました',
  },
  REJECTED: {
    label: '却下',
    color: 'red',
    icon: XCircle,
    description: '勤怠変更申請が却下されました',
  },
};

/**
 * 勤怠変更申請のステータスバッジコンポーネント
 *
 * 使用例:
 * ```tsx
 * <AttendanceStatusBadge
 *   status="REJECTED"
 *   attendanceId={123}
 *   modificationId={456}
 *   adminComment="打刻時間と申請時間に大きな差異があります"
 *   showResubmitButton
 * />
 * ```
 */
export function AttendanceStatusBadge({
  status,
  attendanceId,
  modificationId,
  adminComment,
  compact = false,
  showResubmitButton = false,
}: AttendanceStatusBadgeProps) {
  // ステータスがnullの場合（勤怠変更申請なし）は何も表示しない
  if (!status) {
    return null;
  }

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      {/* ステータスバッジ */}
      <span title={config.description}>
        <Badge
          variant={config.color}
          className="flex items-center gap-1"
        >
          <Icon className="w-3 h-3" />
          {!compact && <span>{config.label}</span>}
        </Badge>
      </span>

      {/* 却下時の理由表示 */}
      {status === 'REJECTED' && adminComment && (
        <div className="group relative">
          <AlertCircle className="w-4 h-4 text-red-500 cursor-help" />
          <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <p className="font-bold mb-1">却下理由:</p>
            <p>{adminComment}</p>
          </div>
        </div>
      )}

      {/* 再申請ボタン（却下時のみ表示） */}
      {status === 'REJECTED' && showResubmitButton && attendanceId && (
        <Link
          href={`/attendance/modify?resubmit=${modificationId || ''}&attendanceId=${attendanceId}`}
          className="px-2 py-1 text-xs font-medium bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          再申請する
        </Link>
      )}
    </div>
  );
}

/**
 * 勤怠変更申請ステータスの概要表示（カード内埋め込み用）
 */
export function AttendanceModificationSummary({
  status,
  attendanceId,
  modificationId,
  adminComment,
  originalAmount,
  requestedAmount,
}: {
  status: ModificationStatus;
  attendanceId: number;
  modificationId?: number;
  adminComment?: string | null;
  originalAmount?: number;
  requestedAmount?: number;
}) {
  if (!status) {
    return null;
  }

  const config = statusConfig[status];
  const Icon = config.icon;
  const difference = (requestedAmount ?? 0) - (originalAmount ?? 0);

  return (
    <div className={`p-3 rounded-lg border ${
      status === 'REJECTED' ? 'bg-red-50 border-red-200' :
      status === 'APPROVED' ? 'bg-green-50 border-green-200' :
      'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${
          status === 'REJECTED' ? 'text-red-600' :
          status === 'APPROVED' ? 'text-green-600' :
          'text-yellow-600'
        }`} />
        <span className={`text-sm font-bold ${
          status === 'REJECTED' ? 'text-red-800' :
          status === 'APPROVED' ? 'text-green-800' :
          'text-yellow-800'
        }`}>
          勤怠変更申請: {config.label}
        </span>
      </div>

      {/* 金額差分の表示 */}
      {originalAmount !== undefined && requestedAmount !== undefined && (
        <div className="text-xs text-gray-600 mb-2">
          <span>申請差額: </span>
          <span className={difference > 0 ? 'text-green-600 font-bold' : difference < 0 ? 'text-red-600 font-bold' : ''}>
            {difference > 0 ? '+' : ''}{difference.toLocaleString()}円
          </span>
        </div>
      )}

      {/* 却下理由 */}
      {status === 'REJECTED' && adminComment && (
        <div className="text-xs text-red-700 mb-2">
          <span className="font-bold">却下理由: </span>
          {adminComment}
        </div>
      )}

      {/* 再申請ボタン（却下時のみ） */}
      {status === 'REJECTED' && (
        <Link
          href={`/attendance/modify?resubmit=${modificationId || ''}&attendanceId=${attendanceId}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <RefreshCw className="w-3 h-3" />
          再申請する
        </Link>
      )}
    </div>
  );
}
