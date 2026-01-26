# CSV出力機能 システム設計書

## 1. アーキテクチャ概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                     System Admin Layout                          │
│  ┌─────────────┐  ┌───────────────────────────────────────────┐ │
│  │  Sidebar    │  │              Main Content                  │ │
│  │             │  │  ┌─────────────────────────────────────┐  │ │
│  │ ・勤怠管理  │  │  │      CSV Export Page                │  │ │
│  │ ・CSV出力←─┼──┼──│  ┌─────────────────────────────────┐│  │ │
│  │             │  │  │  │   Export Button Menu             ││  │ │
│  │             │  │  │  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ││  │ │
│  │             │  │  │  │  │取引│ │案件│ │ｼﾌﾄ│ │ｽﾀｯ│ │勤怠│ ││  │ │
│  │             │  │  │  │  │先  │ │情報│ │表 │ │ﾌ  │ │情報│ ││  │ │
│  │             │  │  │  │  └───┘ └───┘ └───┘ └───┘ └───┘ ││  │ │
│  │             │  │  │  └─────────────────────────────────┘│  │ │
│  │             │  │  │                  ↓                   │  │ │
│  │             │  │  │  ┌─────────────────────────────────┐│  │ │
│  │             │  │  │  │   Selected Export Component     ││  │ │
│  │             │  │  │  │  ・Filter Panel                 ││  │ │
│  │             │  │  │  │  ・Data Table                   ││  │ │
│  │             │  │  │  │  ・CSV Download Button          ││  │ │
│  │             │  │  │  └─────────────────────────────────┘│  │ │
│  │             │  │  └─────────────────────────────────────┘  │ │
│  └─────────────┘  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 ディレクトリ構成

```
app/system-admin/csv-export/
├── page.tsx                              # メインページ（タブ切り替え）
├── layout.tsx                            # レイアウト（認証チェック）
├── components/
│   ├── CsvExportTabs.tsx                 # タブメニューコンポーネント
│   ├── ExportButton.tsx                  # CSVダウンロードボタン
│   └── DataTable.tsx                     # 共通データテーブル
├── client-info/
│   ├── ClientInfoExport.tsx              # 取引先情報出力コンポーネント
│   └── types.ts                          # 型定義
├── job-info/
│   ├── JobInfoExport.tsx                 # 案件情報出力コンポーネント
│   └── types.ts
├── shift-info/
│   ├── ShiftInfoExport.tsx               # シフト表出力コンポーネント
│   └── types.ts
├── staff-info/
│   ├── StaffInfoExport.tsx               # スタッフ情報出力コンポーネント
│   └── types.ts
└── attendance-info/
    ├── AttendanceInfoExport.tsx          # 勤怠情報出力コンポーネント
    └── types.ts

src/lib/actions/
└── csv-export.ts                         # Server Actions

src/lib/csv-export/
├── utils.ts                              # CSV生成ユーティリティ
├── client-info-csv.ts                    # 取引先情報CSV生成
├── job-info-csv.ts                       # 案件情報CSV生成
├── shift-info-csv.ts                     # シフト表CSV生成
├── staff-info-csv.ts                     # スタッフ情報CSV生成
└── attendance-info-csv.ts                # 勤怠情報CSV生成
```

---

## 2. コンポーネント設計

### 2.1 メインページ（page.tsx）

```typescript
// app/system-admin/csv-export/page.tsx

'use client';

import { useState } from 'react';
import { FileSpreadsheet, Building2, Briefcase, Calendar, Users, Clock } from 'lucide-react';
import CsvExportTabs from './components/CsvExportTabs';
import ClientInfoExport from './client-info/ClientInfoExport';
import JobInfoExport from './job-info/JobInfoExport';
import ShiftInfoExport from './shift-info/ShiftInfoExport';
import StaffInfoExport from './staff-info/StaffInfoExport';
import AttendanceInfoExport from './attendance-info/AttendanceInfoExport';

type ExportTab = 'client' | 'job' | 'shift' | 'staff' | 'attendance';

const tabs = [
  { id: 'client', label: '取引先情報', icon: Building2, ready: true },
  { id: 'job', label: '案件情報(代理)', icon: Briefcase, ready: false },
  { id: 'shift', label: '案件シフト表(代理)', icon: Calendar, ready: false },
  { id: 'staff', label: 'プールスタッフ情報', icon: Users, ready: false },
  { id: 'attendance', label: '勤怠情報', icon: Clock, ready: false },
] as const;

export default function CsvExportPage() {
  const [activeTab, setActiveTab] = useState<ExportTab>('client');

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">CSV出力</h1>
            <p className="text-slate-500">CROSSNAVI連携用のデータをCSV形式でエクスポート</p>
          </div>
        </div>
      </div>

      {/* タブメニュー */}
      <CsvExportTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* コンテンツ */}
      <div className="mt-6">
        {activeTab === 'client' && <ClientInfoExport />}
        {activeTab === 'job' && <JobInfoExport />}
        {activeTab === 'shift' && <ShiftInfoExport />}
        {activeTab === 'staff' && <StaffInfoExport />}
        {activeTab === 'attendance' && <AttendanceInfoExport />}
      </div>
    </div>
  );
}
```

### 2.2 タブコンポーネント

```typescript
// app/system-admin/csv-export/components/CsvExportTabs.tsx

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
}

interface CsvExportTabsProps {
  tabs: readonly Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function CsvExportTabs({ tabs, activeTab, onTabChange }: CsvExportTabsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                transition-colors relative
                ${isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {!tab.ready && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                  準備中
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### 2.3 取引先情報出力コンポーネント

```typescript
// app/system-admin/csv-export/client-info/ClientInfoExport.tsx

'use client';

import { useState, useEffect } from 'react';
import { Download, Filter, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getClientInfoList, exportClientInfoCsv } from '@/src/lib/actions/csv-export';
import type { ClientInfoItem, ClientInfoFilter } from './types';

export default function ClientInfoExport() {
  // 状態
  const [items, setItems] = useState<ClientInfoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // フィルター
  const [filters, setFilters] = useState<ClientInfoFilter>({
    search: '',
    corporationNumber: '',
    corporationName: '',
    facilityName: '',
    dateFrom: '',
    dateTo: '',
  });

  const ITEMS_PER_PAGE = 20;

  // データ取得
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getClientInfoList({
        page,
        limit: ITEMS_PER_PAGE,
        filters,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('データ取得エラー:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, filters]);

  // CSV出力
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportClientInfoCsv(filters);

      if (result.success && result.csvData) {
        // BOM付きUTF-8でダウンロード
        const blob = new Blob(['\uFEFF' + result.csvData], {
          type: 'text/csv;charset=utf-8;'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        link.download = `取引先情報_${dateStr}_${timeStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`${result.count}件のデータをCSV出力しました`);
      } else {
        toast.error(result.error || 'CSV出力に失敗しました');
      }
    } catch (error) {
      console.error('CSV出力エラー:', error);
      toast.error('CSV出力に失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* フィルターパネル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">フィルター</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {showFilters ? '閉じる' : '詳細フィルター'}
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 検索バー */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="法人名、施設名で検索..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting || total === 0}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isExporting || total === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#66cc99] hover:bg-[#55bb88] text-white'
              }
            `}
          >
            <Download className="w-4 h-4" />
            CSV出力 ({total}件)
          </button>
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">法人番号</label>
              <input
                type="text"
                value={filters.corporationNumber}
                onChange={(e) => setFilters({ ...filters, corporationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="2011101052670"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">法人名</label>
              <input
                type="text"
                value={filters.corporationName}
                onChange={(e) => setFilters({ ...filters, corporationName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">施設名</label>
              <input
                type="text"
                value={filters.facilityName}
                onChange={(e) => setFilters({ ...filters, facilityName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">登録日（開始）</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">登録日（終了）</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={() => setFilters({
                  search: '',
                  corporationNumber: '',
                  corporationName: '',
                  facilityName: '',
                  dateFrom: '',
                  dateTo: '',
                })}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                フィルターをクリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* データテーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            データがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    登録日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    法人番号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    法人名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    施設名
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                      {item.corporationNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {item.corporationName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {item.facilityName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ページネーション */}
      {!isLoading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {total}件中 {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, total)}件を表示
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              前へ
            </button>
            <span className="px-3 py-1 text-sm">
              {page} / {Math.ceil(total / ITEMS_PER_PAGE)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / ITEMS_PER_PAGE)}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Server Actions 設計

### 3.1 CSV出力用 Server Actions

```typescript
// src/lib/actions/csv-export.ts

'use server';

import { prisma } from '@/src/lib/prisma';
import { requireSystemAdminAuth } from '@/src/lib/system-actions';
import { generateClientInfoCsv } from '@/src/lib/csv-export/client-info-csv';
import type { ClientInfoFilter, ClientInfoItem } from '@/app/system-admin/csv-export/client-info/types';

/**
 * 取引先情報一覧取得
 */
export async function getClientInfoList(params: {
  page: number;
  limit: number;
  filters: ClientInfoFilter;
}): Promise<{ items: ClientInfoItem[]; total: number }> {
  await requireSystemAdminAuth();

  const { page, limit, filters } = params;
  const skip = (page - 1) * limit;

  // WHERE条件構築
  const where: any = {
    deleted_at: null,
    is_pending: false,
  };

  if (filters.search) {
    where.OR = [
      { corporation_name: { contains: filters.search, mode: 'insensitive' } },
      { facility_name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.corporationNumber) {
    where.corporation_number = { contains: filters.corporationNumber };
  }
  if (filters.corporationName) {
    where.corporation_name = { contains: filters.corporationName, mode: 'insensitive' };
  }
  if (filters.facilityName) {
    where.facility_name = { contains: filters.facilityName, mode: 'insensitive' };
  }
  if (filters.dateFrom) {
    where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
  }

  const [facilities, total] = await Promise.all([
    prisma.facility.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        corporation_number: true,
        corporation_name: true,
        facility_name: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.facility.count({ where }),
  ]);

  const items: ClientInfoItem[] = facilities.map(f => ({
    id: f.id,
    createdAt: f.created_at,
    corporationNumber: f.corporation_number,
    corporationName: f.corporation_name,
    facilityName: f.facility_name,
  }));

  return { items, total };
}

/**
 * 取引先情報CSV出力
 */
export async function exportClientInfoCsv(
  filters: ClientInfoFilter
): Promise<{ success: boolean; csvData?: string; count?: number; error?: string }> {
  await requireSystemAdminAuth();

  try {
    // WHERE条件構築（getClientInfoListと同じ）
    const where: any = {
      deleted_at: null,
      is_pending: false,
    };

    if (filters.search) {
      where.OR = [
        { corporation_name: { contains: filters.search, mode: 'insensitive' } },
        { facility_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.corporationNumber) {
      where.corporation_number = { contains: filters.corporationNumber };
    }
    if (filters.corporationName) {
      where.corporation_name = { contains: filters.corporationName, mode: 'insensitive' };
    }
    if (filters.facilityName) {
      where.facility_name = { contains: filters.facilityName, mode: 'insensitive' };
    }
    if (filters.dateFrom) {
      where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
    }
    if (filters.dateTo) {
      where.created_at = { ...where.created_at, lte: new Date(filters.dateTo + 'T23:59:59') };
    }

    // 全データ取得（CSV出力用）
    const facilities = await prisma.facility.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    // CSV生成
    const csvData = generateClientInfoCsv(facilities);

    return {
      success: true,
      csvData,
      count: facilities.length,
    };
  } catch (error) {
    console.error('CSV出力エラー:', error);
    return {
      success: false,
      error: 'CSV出力に失敗しました',
    };
  }
}
```

---

## 4. CSV生成ユーティリティ設計

### 4.1 共通ユーティリティ

```typescript
// src/lib/csv-export/utils.ts

/**
 * CSV文字列生成
 */
export function generateCsv(headers: string[], rows: string[][]): string {
  const escapeField = (field: string | null | undefined): string => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    // カンマ、ダブルクォート、改行を含む場合はエスケープ
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeField).join(',');
  const dataRows = rows.map(row => row.map(escapeField).join(',')).join('\r\n');

  return headerRow + '\r\n' + dataRows;
}

/**
 * 日付フォーマット（yyyy/mm/dd）
 */
export function formatDateForCsv(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 時刻フォーマット（hh:mm）
 */
export function formatTimeForCsv(time: string | null | undefined): string {
  if (!time) return '';
  // "HH:MM:SS" or "HH:MM" format
  return time.slice(0, 5);
}

/**
 * 実働時間計算（hh:mm形式で返す）
 */
export function calculateWorkingHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): string {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMinutes;
  if (totalMinutes < 0) totalMinutes += 24 * 60; // 日跨ぎ対応

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
```

### 4.2 取引先情報CSV生成

```typescript
// src/lib/csv-export/client-info-csv.ts

import { Facility } from '@prisma/client';
import { generateCsv, formatDateForCsv } from './utils';

// CROSSNAVI仕様の28項目ヘッダー
const CLIENT_INFO_HEADERS = [
  '取引先番号',
  '法人番号',
  '法人名称',
  '法人名称カナ',
  '自社名称',
  '自社名称カナ',
  '郵便番号',
  '都道府県',
  '市区町村',
  '住所',
  '代表者名',
  '代表電話番号',
  '代表FAX番号',
  'URL',
  '銀行コード',
  '支店コード',
  '口座番号',
  '口座名義人',
  '振込依頼人番号',
  '受動喫煙防止措置',
  '事業所番号',
  '事業所名称',
  '郵便番号',
  '都道府県／市区町村',
  '住所',
  '電話番号',
  '担当者氏',
  '担当者名',
];

/**
 * 取引先情報CSV生成
 */
export function generateClientInfoCsv(facilities: Facility[]): string {
  const rows = facilities.map(f => {
    // 代表者名（姓 + 名）
    const representativeName = [
      f.representative_last_name,
      f.representative_first_name,
    ].filter(Boolean).join(' ');

    // 都道府県／市区町村
    const prefectureCity = [f.prefecture, f.city].filter(Boolean).join('／');

    return [
      '', // 取引先番号（未対応）
      f.corporation_number || '',
      f.corporation_name || '',
      '', // 法人名称カナ（未対応）
      f.corporation_name || '', // 自社名称 = 法人名称
      '', // 自社名称カナ（未対応）
      f.corp_postal_code || '',
      f.corp_prefecture || '',
      f.corp_city || '',
      f.corp_address_line || '',
      representativeName,
      f.phone_number || '', // 代表電話 = 事業所電話
      '', // 代表FAX（未対応）
      '', // URL（未対応）
      '', // 銀行コード（未対応）
      '', // 支店コード（未対応）
      '', // 口座番号（未対応）
      '', // 口座名義人（未対応）
      '', // 振込依頼人番号（未対応）
      f.smoking_measure || '',
      '', // 事業所番号（未対応）
      f.facility_name || '',
      f.postal_code || '',
      prefectureCity,
      f.address_line || '',
      f.phone_number || '',
      f.contact_person_last_name || '',
      f.contact_person_first_name || '',
    ];
  });

  return generateCsv(CLIENT_INFO_HEADERS, rows);
}
```

---

## 5. サイドバーメニュー追加

### 5.1 SystemAdminLayout.tsx への追加

```typescript
// components/system-admin/SystemAdminLayout.tsx

import {
  // ... existing imports
  FileSpreadsheet, // 追加
} from 'lucide-react';

const menuItems = [
  // ... existing items
  {
    title: '勤怠管理',
    icon: <Clock className="w-5 h-5" />,
    href: '/system-admin/attendance',
    active: pathname?.startsWith('/system-admin/attendance'),
  },
  {
    title: 'CSV出力',  // 追加
    icon: <FileSpreadsheet className="w-5 h-5" />,
    href: '/system-admin/csv-export',
    active: pathname?.startsWith('/system-admin/csv-export'),
  },
  // ... rest of items
];
```

---

## 6. 型定義

### 6.1 取引先情報の型

```typescript
// app/system-admin/csv-export/client-info/types.ts

export interface ClientInfoItem {
  id: number;
  createdAt: Date;
  corporationNumber: string | null;
  corporationName: string;
  facilityName: string;
}

export interface ClientInfoFilter {
  search: string;
  corporationNumber: string;
  corporationName: string;
  facilityName: string;
  dateFrom: string;
  dateTo: string;
}
```

---

## 7. UI/UXデザイン指針

### 7.1 カラーパレット

| 用途 | カラー | Tailwind |
|------|--------|----------|
| プライマリボタン | #66cc99 | `bg-[#66cc99]` |
| セカンダリボタン | slate-200 | `bg-slate-200` |
| タブアクティブ | indigo-600 | `bg-indigo-600` |
| 準備中バッジ | amber-100/700 | `bg-amber-100 text-amber-700` |
| テーブルヘッダー | slate-50 | `bg-slate-50` |
| ボーダー | slate-100/200 | `border-slate-100` |

### 7.2 レスポンシブ対応

- モバイル: 1カラム、テーブル横スクロール
- タブレット: 2カラムフィルター
- デスクトップ: 4カラムフィルター

### 7.3 ローディング状態

- データ取得中: 「読み込み中...」テキスト
- CSV出力中: ボタン無効化 + ローディング表示
- RefreshCwアイコンのスピンアニメーション

---

## 8. エラーハンドリング

### 8.1 エラーパターン

| エラー | 対応 |
|--------|------|
| データ取得失敗 | toast.error + コンソールログ |
| CSV出力失敗 | toast.error + 詳細ログ |
| 認証エラー | ログインページへリダイレクト |
| ネットワークエラー | リトライ促進メッセージ |

### 8.2 バリデーション

- CSV出力時のフィルター検証（オプション）
- 出力件数上限チェック（10,000件）
- 空データ時の出力禁止

---

## 9. 実装チェックリスト

### Phase 1（今回実装）

- [ ] サイドバーメニュー追加
- [ ] CSV出力トップページ作成
- [ ] タブコンポーネント作成
- [ ] 取引先情報出力コンポーネント作成
- [ ] 取引先情報Server Actions作成
- [ ] 取引先情報CSV生成ユーティリティ作成
- [ ] 他4機能は「準備中」表示

### Phase 2以降

- [ ] DB拡張（不足項目追加）
- [ ] 施設編集画面への項目追加
- [ ] 案件情報(代理)出力
- [ ] 案件シフト表(代理)出力
- [ ] プールスタッフ情報出力
- [ ] 勤怠情報出力

---

## 更新履歴

| 日付 | 版 | 内容 |
|------|-----|------|
| 2026-01-25 | 1.0 | 初版作成 |
