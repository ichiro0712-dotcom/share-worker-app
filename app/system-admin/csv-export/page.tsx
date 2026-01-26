'use client';

/**
 * CSV出力メインページ
 * CROSSNAVI連携用のCSVデータエクスポート
 */

import { useState } from 'react';
import { Building2, Briefcase, Calendar, Users, Clock } from 'lucide-react';
import CsvExportTabs from './components/CsvExportTabs';
import ClientInfoExport from './client-info/ClientInfoExport';
import JobInfoExport from './job-info/JobInfoExport';
import ShiftInfoExport from './shift-info/ShiftInfoExport';
import StaffInfoExport from './staff-info/StaffInfoExport';
import AttendanceInfoExport from './attendance-info/AttendanceInfoExport';

type ExportTab = 'client' | 'job' | 'shift' | 'staff' | 'attendance';

const TABS = [
  { id: 'client' as const, label: '取引先情報', icon: Building2, ready: true },
  { id: 'job' as const, label: '案件情報(代理)', icon: Briefcase, ready: true },
  { id: 'shift' as const, label: '案件シフト表(代理)', icon: Calendar, ready: true },
  { id: 'staff' as const, label: 'プールスタッフ情報', icon: Users, ready: true },
  { id: 'attendance' as const, label: '勤怠情報', icon: Clock, ready: false },
] as const;

export default function CsvExportPage() {
  const [activeTab, setActiveTab] = useState<ExportTab>('client');

  const renderContent = () => {
    switch (activeTab) {
      case 'client':
        return <ClientInfoExport />;
      case 'job':
        return <JobInfoExport />;
      case 'shift':
        return <ShiftInfoExport />;
      case 'staff':
        return <StaffInfoExport />;
      case 'attendance':
        return <AttendanceInfoExport />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CSV出力</h1>
          <p className="text-sm text-slate-500 mt-1">
            CROSSNAVI連携用データをCSV形式でエクスポート
          </p>
        </div>
      </div>

      {/* タブナビゲーション */}
      <CsvExportTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as ExportTab)}
      />

      {/* コンテンツ */}
      {renderContent()}
    </div>
  );
}
