'use client';

/**
 * プールスタッフ情報出力コンポーネント
 * CROSSNAVI連携用のスタッフデータをCSV出力
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, Filter, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStaffInfoList, exportStaffInfoCsv } from '@/src/lib/actions/csv-export';
import type { StaffInfoItem, StaffInfoFilter } from './types';

const ITEMS_PER_PAGE = 20;

const initialFilters: StaffInfoFilter = {
  search: '',
  staffId: '',
  name: '',
  phoneNumber: '',
  email: '',
  dateFrom: '',
  dateTo: '',
};

export default function StaffInfoExport() {
  const [items, setItems] = useState<StaffInfoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<StaffInfoFilter>(initialFilters);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getStaffInfoList({ page, limit: ITEMS_PER_PAGE, filters });
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

  const handleFilterChange = (newFilters: Partial<StaffInfoFilter>) => {
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
      if (filters.staffId) params.set('staffId', filters.staffId);
      if (filters.name) params.set('name', filters.name);
      if (filters.phoneNumber) params.set('phoneNumber', filters.phoneNumber);
      if (filters.email) params.set('email', filters.email);
      if (filters.dateFrom) params.set('dateFrom', new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set('dateTo', new Date(filters.dateTo + 'T23:59:59').toISOString());

      const link = document.createElement('a');
      link.href = `/api/system-admin/staff-csv?${params.toString()}`;
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
            <input type="text" placeholder="氏名、メール、電話番号で検索..." value={filters.search} onChange={(e) => handleFilterChange({ search: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button onClick={handleExport} disabled={isExporting || total === 0} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isExporting || total === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'}`}>
            <Download className="w-4 h-4" />
            CSV出力 ({total.toLocaleString()}件)
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">スタッフID</label>
              <input type="text" value={filters.staffId} onChange={(e) => handleFilterChange({ staffId: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="123" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">氏名</label>
              <input type="text" value={filters.name} onChange={(e) => handleFilterChange({ name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">電話番号</label>
              <input type="text" value={filters.phoneNumber} onChange={(e) => handleFilterChange({ phoneNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">メール</label>
              <input type="text" value={filters.email} onChange={(e) => handleFilterChange({ email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">登録日（開始）</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange({ dateFrom: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">登録日（終了）</label>
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange({ dateTo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">電話番号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">メール</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">地域</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono">{item.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.phoneNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {item.prefecture && item.city ? `${item.prefecture} ${item.city}` : '-'}
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
          <li>CROSSNAVI連携用フォーマット（48項目）</li>
          <li>文字コード: UTF-8（BOM付き）</li>
          <li>メール認証済みワーカーのみ対象</li>
          <li>連絡先住所・住民票住所は現住所を引用</li>
          <li>固定値: 事業所=渋谷事業所、配偶者有無=不明、扶養対象者=0</li>
        </ul>
      </div>
    </div>
  );
}
