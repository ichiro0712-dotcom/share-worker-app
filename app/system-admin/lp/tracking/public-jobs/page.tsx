'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PublicJobsTracking from '@/app/system-admin/analytics/tabs/PublicJobsTracking';

export default function PublicJobsTrackingPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/system-admin/analytics?tab=lp"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          LPアナリティクスに戻る
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">公開求人検索 トラッキング</h1>
        <p className="text-sm text-slate-500">LP0 - /public/jobs</p>
      </div>
      <PublicJobsTracking />
    </div>
  );
}
