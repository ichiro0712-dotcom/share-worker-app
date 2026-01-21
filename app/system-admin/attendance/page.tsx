'use client';

/**
 * 勤怠管理ページ（システム管理者向け）
 */

import { useEffect, useState } from 'react';
import { Download, Filter, RefreshCw, Calendar, Users, Clock, CircleDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAllAttendances,
  exportAttendancesCsv,
  getAttendanceStats,
} from '@/src/lib/actions/attendance-system-admin';
import { formatCurrency } from '@/src/lib/salary-calculator';
import type { AttendanceFilter, AttendanceSortOption } from '@/src/types/attendance';

type StatusFilter = 'all' | 'CHECKED_IN' | 'CHECKED_OUT';

interface AttendanceItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  facilityId: number;
  facilityName: string;
  jobId?: number;
  jobTitle: string;
  workDate: Date;
  checkInTime: Date;
  checkOutTime?: Date;
  checkInMethod: string;
  checkOutMethod?: string;
  status: string;
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualBreakTime?: number;
  calculatedWage?: number;
  hasModificationRequest: boolean;
  modificationStatus?: string;
}

interface Stats {
  totalAttendances: number;
  pendingModifications: number;
  totalWage: number;
}

export default function SystemAdminAttendancePage() {
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalAttendances: 0,
    pendingModifications: 0,
    totalWage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // フィルター状態
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const filter: AttendanceFilter = {};

      if (statusFilter !== 'all') {
        filter.status = statusFilter;
      }
      if (dateFrom) {
        filter.dateFrom = new Date(dateFrom);
      }
      if (dateTo) {
        filter.dateTo = new Date(dateTo + 'T23:59:59');
      }

      const [attendanceResult, statsResult] = await Promise.all([
        getAllAttendances({ filter, limit: 100 }),
        getAttendanceStats({
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo + 'T23:59:59') : undefined,
        }),
      ]);

      setItems(attendanceResult.items);
      setTotal(attendanceResult.total);
      setStats(statsResult);
    } catch (error) {
      console.error('データ取得エラー:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, dateFrom, dateTo]);

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('エクスポート期間を指定してください');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportAttendancesCsv({
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo + 'T23:59:59'),
      });

      if (result.success && result.csvData) {
        // CSVダウンロード
        const blob = new Blob(['\uFEFF' + result.csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_${dateFrom}_${dateTo}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('CSVをダウンロードしました');
      } else {
        toast.error(result.error || 'エクスポートに失敗しました');
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      toast.error('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">勤怠管理</h1>
            <p className="text-slate-500">全ワーカーの勤務実績を確認・管理</p>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">勤務実績数</p>
              <p className="text-xl font-bold text-slate-800">
                {stats.totalAttendances.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">承認待ち申請</p>
              <p className="text-xl font-bold text-slate-800">
                {stats.pendingModifications.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg text-green-600">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">総報酬額</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency(stats.totalWage)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">表示件数</p>
              <p className="text-xl font-bold text-slate-800">
                {total.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">フィルター</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* ステータス */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">ステータス</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">すべて</option>
              <option value="CHECKED_IN">出勤中</option>
              <option value="CHECKED_OUT">退勤済み</option>
            </select>
          </div>

          {/* 期間開始 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">期間（開始）</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          {/* 期間終了 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">期間（終了）</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          {/* CSVエクスポート */}
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={isExporting || !dateFrom || !dateTo}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isExporting || !dateFrom || !dateTo
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              CSVエクスポート
            </button>
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            勤務実績がありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    勤務日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    ワーカー
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    施設
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    案件
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    出勤
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    退勤
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    ステータス
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    報酬
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {formatDate(item.workDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {item.userName}
                      </div>
                      <div className="text-xs text-slate-500">{item.userEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{item.facilityName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{item.jobTitle}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-slate-900">
                        {formatTime(item.checkInTime)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.checkInMethod === 'QR' ? 'QR' : '緊急'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-slate-900">
                        {formatTime(item.checkOutTime)}
                      </div>
                      {item.checkOutMethod && (
                        <div className="text-xs text-slate-500">
                          {item.checkOutMethod === 'QR' ? 'QR' : '緊急'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'CHECKED_OUT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.status === 'CHECKED_OUT' ? '退勤済み' : '出勤中'}
                      </span>
                      {item.hasModificationRequest && (
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                              item.modificationStatus === 'APPROVED'
                                ? 'bg-green-50 text-green-600'
                                : item.modificationStatus === 'REJECTED'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {item.modificationStatus === 'APPROVED'
                              ? '変更承認'
                              : item.modificationStatus === 'REJECTED'
                              ? '変更却下'
                              : '変更申請中'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-slate-900">
                        {item.calculatedWage
                          ? formatCurrency(item.calculatedWage)
                          : '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ページネーション情報 */}
      {!isLoading && items.length > 0 && (
        <div className="mt-4 text-sm text-slate-500 text-center">
          {total}件中 {items.length}件を表示
        </div>
      )}
    </div>
  );
}
