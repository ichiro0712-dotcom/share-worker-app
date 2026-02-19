'use client';

import { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
}

interface CsvExportTabsProps {
  tastasTabs: readonly Tab[];
  crossnaviTabs: readonly Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function TabButton({ tab, isActive, onClick }: { tab: Tab; isActive: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
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
        <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
          isActive
            ? 'bg-indigo-500 text-indigo-100'
            : 'bg-amber-100 text-amber-700'
        }`}>
          準備中
        </span>
      )}
    </button>
  );
}

export default function CsvExportTabs({ tastasTabs, crossnaviTabs, activeTab, onTabChange }: CsvExportTabsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
      {/* 一段目: タスタス用 */}
      <div className="flex flex-wrap gap-2">
        {tastasTabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>

      {/* 区切り線 */}
      <div className="border-t border-slate-100" />

      {/* 二段目: CROSSNAVI連携用 */}
      <div className="flex flex-wrap gap-2">
        {crossnaviTabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400 pl-1">※ CROSSNAVI連携用</p>
    </div>
  );
}
