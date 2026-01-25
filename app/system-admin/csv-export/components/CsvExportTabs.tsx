'use client';

import { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
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
        })}
      </div>
    </div>
  );
}
