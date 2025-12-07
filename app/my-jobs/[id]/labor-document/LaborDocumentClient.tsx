'use client';

import { Download } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      className="flex items-center gap-1 text-gray-600 text-sm font-medium"
      onClick={() => window.print()}
    >
      <Download className="w-4 h-4" />
      PDF保存
    </button>
  );
}
