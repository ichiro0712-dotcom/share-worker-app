'use client';

/**
 * 利用明細ページ（施設管理者向け）
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getUsageDetails,
  getUsageDetailsCSV,
  type UsageDetailItem,
} from '@/src/lib/actions/attendance-admin';

export default function UsageReportPage() {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();

  // フィルター状態
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // データ状態
  const [items, setItems] = useState<UsageDetailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!admin?.facilityId) return;
    setIsLoading(true);
    try {
      const result = await getUsageDetails(admin.facilityId, { year, month });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('データ取得エラー:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [admin?.facilityId, year, month]);

  useEffect(() => {
    if (!isAdminLoading && (!isAdmin || !admin)) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  useEffect(() => {
    if (admin?.facilityId) {
      fetchData();
    }
  }, [fetchData, admin?.facilityId]);

  // 月を変更
  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setMonth(newMonth);
    setYear(newYear);
  };

  // CSV出力
  const handleExportCSV = async () => {
    if (!admin?.facilityId || isExporting) return;

    setIsExporting(true);
    try {
      const csv = await getUsageDetailsCSV(admin.facilityId, { year, month });
      if (!csv) {
        toast.error('CSVの生成に失敗しました');
        return;
      }

      // BOMを追加してExcelで文字化けしないようにする
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `利用明細_${year}年${month}月.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('CSVをダウンロードしました');
    } catch (error) {
      console.error('CSV出力エラー:', error);
      toast.error('CSVの出力に失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  // 合計計算
  const totalWage = items.reduce((sum, item) => sum + (item.calculatedWage ?? 0), 0);
  const totalTransportation = items.reduce((sum, item) => sum + item.transportationFee, 0);
  const totalPlatformFee = items.reduce((sum, item) => sum + item.platformFee, 0);
  const totalTax = items.reduce((sum, item) => sum + item.tax, 0);
  const grandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#66cc99]" />
                <h1 className="text-xl font-bold">利用明細</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExportCSV}
                disabled={isExporting || items.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#66cc99] hover:bg-[#55bb88] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV出力</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* 年月選択 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-lg font-bold">
              {year}年{month}月
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={year === now.getFullYear() && month === now.getMonth() + 1}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 集計 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-500">件数</div>
              <div className="text-xl font-bold">{total}件</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">給与</div>
              <div className="text-xl font-bold">¥{totalWage.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">交通費</div>
              <div className="text-xl font-bold">¥{totalTransportation.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">手数料</div>
              <div className="text-xl font-bold">¥{totalPlatformFee.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">税額</div>
              <div className="text-xl font-bold">¥{totalTax.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">合計</div>
              <div className="text-xl font-bold text-[#66cc99]">¥{grandTotal.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 一覧テーブル */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {year}年{month}月の利用明細はありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">案件ID</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">日時</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">ワーカー</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">出勤時刻</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">退勤時刻</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700">休憩</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700">給与</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700">交通費</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700">手数料</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700">税額</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700">合計</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const checkInTime = item.actualStartTime
                      ? new Date(item.actualStartTime).toLocaleString('ja-JP', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-';
                    const checkOutTime = item.actualEndTime
                      ? new Date(item.actualEndTime).toLocaleString('ja-JP', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-';

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Link
                            href={`/admin/jobs/${item.jobId}`}
                            className="text-[#66cc99] hover:underline font-medium"
                          >
                            {item.jobId}
                          </Link>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-xs">{item.workDateTime}</div>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/workers/${item.workerId}`}
                            className="text-[#66cc99] hover:underline font-medium"
                          >
                            {item.workerName}
                          </Link>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {checkInTime}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {checkOutTime}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {item.actualBreakTime ?? 0}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {(item.calculatedWage ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {item.transportationFee.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {item.platformFee.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {item.tax.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap font-medium">
                          {item.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
