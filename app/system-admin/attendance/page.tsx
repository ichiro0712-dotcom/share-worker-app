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
  corporationName?: string;
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
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledBreakTime?: number;
  calculatedWage?: number;
  // 交通費と時給
  transportationFee?: number;
  hourlyWage?: number;
  hasModificationRequest: boolean;
  modificationStatus?: string;
  // 遅刻・早退・残業フラグ
  isLate?: boolean;
  isEarlyLeave?: boolean;
  isOvertime?: boolean;
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
  const [facilityNameFilter, setFacilityNameFilter] = useState<string>('');
  const [corporationNameFilter, setCorporationNameFilter] = useState<string>('');
  const [workerSearchFilter, setWorkerSearchFilter] = useState<string>('');

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
      if (facilityNameFilter.trim()) {
        filter.facilityName = facilityNameFilter.trim();
      }
      if (corporationNameFilter.trim()) {
        filter.corporationName = corporationNameFilter.trim();
      }
      if (workerSearchFilter.trim()) {
        filter.workerSearch = workerSearchFilter.trim();
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
  }, [statusFilter, dateFrom, dateTo, facilityNameFilter, corporationNameFilter, workerSearchFilter]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportAttendancesCsv({
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
        facilityName: facilityNameFilter.trim() || undefined,
        corporationName: corporationNameFilter.trim() || undefined,
        workerSearch: workerSearchFilter.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      if (result.success && result.csvData) {
        // CSVダウンロード
        const blob = new Blob(['\uFEFF' + result.csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        link.download = `勤怠情報_${dateStr}_${timeStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`${result.count}件のデータをCSV出力しました`);
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

        {/* 1行目: 期間・ステータス・エクスポート */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
              disabled={isExporting || total === 0}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isExporting || total === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              CSV出力 ({total}件)
            </button>
          </div>
        </div>

        {/* 2行目: 施設名・法人名・ワーカー検索 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 施設名 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">施設名</label>
            <input
              type="text"
              value={facilityNameFilter}
              onChange={(e) => setFacilityNameFilter(e.target.value)}
              placeholder="施設名で絞り込み"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          {/* 法人名 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">法人名</label>
            <input
              type="text"
              value={corporationNameFilter}
              onChange={(e) => setCorporationNameFilter(e.target.value)}
              placeholder="法人名で絞り込み"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          {/* ワーカー検索 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">ワーカー（名前/メール）</label>
            <input
              type="text"
              value={workerSearchFilter}
              onChange={(e) => setWorkerSearchFilter(e.target.value)}
              placeholder="名前またはメールで絞り込み"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
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
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    勤務日
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    ワーカー
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    施設
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    案件
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    定刻
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    実績
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    交通費
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    フラグ
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    ステータス
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    報酬（税込）
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <div className="text-sm text-slate-900">
                        {formatDate(item.workDate)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {item.userName}
                      </div>
                      <div className="text-xs text-slate-500">{item.userEmail}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-slate-900">{item.facilityName}</div>
                      {item.corporationName && (
                        <div className="text-xs text-slate-500">{item.corporationName}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-slate-900">{item.jobTitle}</div>
                    </td>
                    {/* 定刻（出勤・退勤・休憩） */}
                    <td className="px-3 py-3 text-center">
                      <div className="text-xs text-slate-600">
                        <div>{item.scheduledStartTime || '-'} ~ {item.scheduledEndTime || '-'}</div>
                        <div className="text-slate-400">休憩 {item.scheduledBreakTime ?? 0}分</div>
                      </div>
                    </td>
                    {/* 実績（出勤・退勤・休憩） */}
                    <td className="px-3 py-3 text-center">
                      <div className="text-xs text-slate-600">
                        <div>
                          {formatTime(item.actualStartTime)} ~ {formatTime(item.actualEndTime)}
                        </div>
                        <div className="text-slate-400">休憩 {item.actualBreakTime ?? 0}分</div>
                      </div>
                    </td>
                    {/* 交通費 */}
                    <td className="px-3 py-3 text-right">
                      <div className="text-xs text-slate-600">
                        {item.transportationFee
                          ? formatCurrency(item.transportationFee)
                          : '-'}
                      </div>
                    </td>
                    {/* 遅刻・早退・残業フラグ */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {item.isLate && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            遅刻
                          </span>
                        )}
                        {item.isEarlyLeave && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            早退
                          </span>
                        )}
                        {item.isOvertime && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            残業
                          </span>
                        )}
                        {!item.isLate && !item.isEarlyLeave && !item.isOvertime && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
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
                    <td className="px-3 py-3 text-right">
                      {item.calculatedWage ? (
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {formatCurrency(item.calculatedWage + (item.transportationFee ?? 0))}
                          </div>
                          <div className="text-xs text-slate-400">
                            (時給分 {formatCurrency(item.calculatedWage)})
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
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
