'use client';

import { Users } from 'lucide-react';

export default function StaffInfoExport() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
          <Users className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          プールスタッフ情報出力
        </h3>
        <p className="text-slate-500 mb-4">
          この機能は現在準備中です。
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm">
          <span>48項目のCSV出力に対応予定</span>
        </div>
      </div>
    </div>
  );
}
