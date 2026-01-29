'use client';

/**
 * 勤怠情報出力コンポーネント
 * CROSSNAVI連携用の勤怠データをCSV出力（35項目）
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, Filter, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAttendanceInfoList, exportAttendanceInfoCsv } from '@/src/lib/actions/csv-export';
import type { AttendanceInfoItem, AttendanceInfoFilter } from './types';

const ITEMS_PER_PAGE = 20;

const initialFilters: AttendanceInfoFilter = {
  search: '',
  userName: '',
  facilityName: '',
  workDateFrom: '',
  workDateTo: '',
  status: '',
};

const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'checked_in', label: '出勤中' },
  { value: 'checked_out', label: '退勤済み' },
  { value: 'pending', label: '申請中' },
  { value: 'approved', label: '承認済み' },
];

export default function AttendanceInfoExport() {
  const [items, setItems] = useState<AttendanceInfoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AttendanceInfoFilter>(initialFilters);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAttendanceInfoList({ page, limit: ITEMS_PER_PAGE, filters });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('データ取得エラー:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newFilters: Partial<AttendanceInfoFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.userName) params.set('workerSearch', filters.userName);
      if (filters.facilityName) params.set('facilityName', filters.facilityName);
      if (filters.workDateFrom) params.set('dateFrom', new Date(filters.workDateFrom).toISOString());
      if (filters.workDateTo) params.set('dateTo', new Date(filters.workDateTo + 'T23:59:59').toISOString());
      if (filters.status) {
        // ステータスをAPI用に変換
        const statusMap: Record<string, string> = {
          checked_in: 'CHECKED_IN',
          checked_out: 'CHECKED_OUT',
        };
        const apiStatus = statusMap[filters.status] || filters.status.toUpperCase();
        params.set('status', apiStatus);
      }

      const link = document.createElement('a');
      link.href = `/api/system-admin/attendance-csv?${params.toString()}`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('CSVエクスポートを開始しました');
    } catch (error) {
      console.error('CSV出力エラー:', error);
      toast.error('CSV出力に失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };
  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.label || status;
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-blue-100 text-blue-700';
      case 'checked_out': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">フィルター</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className="text-sm text-indigo-600 hover:text-indigo-800">
              {showFilters ? '閉じる' : '詳細フィルター'}
            </button>
            <button onClick={fetchData} disabled={isLoading} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="更新">
              <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="氏名、施設名、案件名で検索..." value={filters.search} onChange={(e) => handleFilterChange({ search: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button onClick={handleExport} disabled={isExporting || total === 0} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isExporting || total === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'}`}>
            <Download className="w-4 h-4" />
            CSV出力 ({total.toLocaleString()}件)
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">氏名</label>
              <input type="text" value={filters.userName} onChange={(e) => handleFilterChange({ userName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">施設名</label>
              <input type="text" value={filters.facilityName} onChange={(e) => handleFilterChange({ facilityName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">勤務日（開始）</label>
              <input type="date" value={filters.workDateFrom} onChange={(e) => handleFilterChange({ workDateFrom: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">勤務日（終了）</label>
              <input type="date" value={filters.workDateTo} onChange={(e) => handleFilterChange({ workDateTo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ステータス</label>
              <select value={filters.status} onChange={(e) => handleFilterChange({ status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleClearFilters} className="text-sm text-slate-500 hover:text-slate-700">フィルターをクリア</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">データがありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">勤務日</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ユーザーID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">施設名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">案件名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">出勤時刻</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">退勤時刻</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">{formatDate(item.workDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono">{item.userId}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{item.userName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.facilityName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.jobTitle || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatTime(item.checkInTime)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatTime(item.checkOutTime)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">{total.toLocaleString()}件中 {((page - 1) * ITEMS_PER_PAGE + 1).toLocaleString()} - {Math.min(page * ITEMS_PER_PAGE, total).toLocaleString()}件を表示</div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="最初"><ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-3" /></button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="前へ"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-2 text-sm text-slate-700">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="次へ"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="最後"><ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-3" /></button>
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-2">CSV出力仕様</p>
        <ul className="list-disc list-inside space-y-1">
          <li>CROSSNAVI連携用フォーマット（35項目）</li>
          <li>文字コード: UTF-8（BOM付き）</li>
          <li>出力項目: 就業者ID、勤務日、シフト情報、実績時間、遅刻/早退時間、交通費等</li>
          <li>所定時間・実働時間は自動計算</li>
          <li>深夜勤務・時間外勤務等は未対応（0:00で出力）</li>
        </ul>
      </div>
    </div>
  );
}
