'use client';

/**
 * ワーカー情報CSV出力コンポーネント
 * タスタスに登録されているワーカー情報を一覧表示・CSV出力する
 * ※ 一覧表示内容およびCSV出力項目は別途実装予定
 */

import { UserCheck } from 'lucide-react';

export default function WorkerInfoExport() {
  return (
    <div className="space-y-6">
      {/* プレースホルダー */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12">
        <div className="text-center">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">ワーカー情報</h3>
          <p className="text-sm text-slate-500">
            タスタスに登録されているワーカー情報の一覧表示・CSV出力機能を実装予定です。
          </p>
        </div>
      </div>
    </div>
  );
}
