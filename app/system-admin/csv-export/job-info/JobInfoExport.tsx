'use client';

/**
 * 案件情報(代理)出力コンポーネント
 * CROSSNAVI連携用の案件データをCSV出力
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, Filter, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getJobInfoList, exportJobInfoCsv } from '@/src/lib/actions/csv-export';
import type { JobInfoItem, JobInfoFilter } from './types';

const PAGE_SIZE_OPTIONS = [30, 50] as const;

const initialFilters: JobInfoFilter = {
  search: '',
  jobTitle: '',
  facilityName: '',
  corporationName: '',
  dateFrom: '',
  dateTo: '',
  status: '',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  PUBLISHED: '公開中',
  CLOSED: '募集終了',
  CANCELLED: 'キャンセル',
};

export default function JobInfoExport() {
  const [items, setItems] = useState<JobInfoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<JobInfoFilter>(initialFilters);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  const totalPages = Math.ceil(total / pageSize);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getJobInfoList({ page, limit: pageSize, filters });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('データ取得エラー:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newFilters: Partial<JobInfoFilter>) => {
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
      if (filters.search) params.set('search', filters.search);
      if (filters.jobTitle) params.set('jobTitle', filters.jobTitle);
      if (filters.facilityName) params.set('facilityName', filters.facilityName);
      if (filters.corporationName) params.set('corporationName', filters.corporationName);
      if (filters.dateFrom) params.set('dateFrom', new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set('dateTo', new Date(filters.dateTo + 'T23:59:59').toISOString());
      if (filters.status) params.set('status', filters.status);

      const link = document.createElement('a');
      link.href = `/api/system-admin/job-csv?${params.toString()}`;
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
  const formatWage = (wage: number) => `¥${wage.toLocaleString()}`;

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
            <input type="text" placeholder="案件名、施設名、法人名で検索..." value={filters.search} onChange={(e) => handleFilterChange({ search: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button onClick={handleExport} disabled={isExporting || total === 0} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isExporting || total === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'}`}>
            <Download className="w-4 h-4" />
            CSV出力 ({total.toLocaleString()}件)
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">案件名</label>
              <input type="text" value={filters.jobTitle} onChange={(e) => handleFilterChange({ jobTitle: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">施設名</label>
              <input type="text" value={filters.facilityName} onChange={(e) => handleFilterChange({ facilityName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">法人名</label>
              <input type="text" value={filters.corporationName} onChange={(e) => handleFilterChange({ corporationName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">登録日（開始）</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange({ dateFrom: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">登録日（終了）</label>
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange({ dateTo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ステータス</label>
              <select value={filters.status} onChange={(e) => handleFilterChange({ status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="">すべて</option>
                <option value="DRAFT">下書き</option>
                <option value="PUBLISHED">公開中</option>
                <option value="CLOSED">募集終了</option>
                <option value="CANCELLED">キャンセル</option>
              </select>
            </div>
            <div className="md:col-span-3 lg:col-span-6 flex items-center justify-end">
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">登録日</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">案件名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">施設名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">法人名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">時給</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{item.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{item.facilityName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.corporationName}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">{formatWage(item.hourlyWage)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${item.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : ''} ${item.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : ''} ${item.status === 'CLOSED' ? 'bg-amber-100 text-amber-700' : ''} ${item.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : ''}`}>
                        {STATUS_LABELS[item.status] || item.status}
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
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">{total.toLocaleString()}件中 {((page - 1) * pageSize + 1).toLocaleString()} - {Math.min(page * pageSize, total).toLocaleString()}件を表示</div>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button key={size} onClick={() => { setPageSize(size); setPage(1); }} className={`px-3 py-1 text-xs font-medium transition-colors ${pageSize === size ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{size}件</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="flex items-center p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="最初"><ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-2" /></button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="前へ"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-2 text-sm text-slate-700">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="次へ"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="flex items-center p-2 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" title="最後"><ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-2" /></button>
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-2">CSV出力仕様</p>
        <ul className="list-disc list-inside space-y-1">
          <li>CROSSNAVI連携用フォーマット（223項目）</li>
          <li>文字コード: UTF-8（BOM付き）</li>
          <li>一部項目（取引先ID、取引先番号、職種コード等）は未対応のため空欄で出力</li>
          <li>固定値項目: 雇用形態=パート、給与形態=時給、支払期間=日払い 等</li>
        </ul>
      </div>
    </div>
  );
}
