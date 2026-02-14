'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PreviewPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(600);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'tastas-jobs-resize') {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/system-admin/lp/recommended-jobs"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          おすすめ求人管理に戻る
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">ウィジェットプレビュー</h1>
        <p className="text-sm text-slate-500 mb-6">
          LP内に表示されるおすすめ求人ウィジェットの実際の見た目を確認できます。
        </p>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <iframe
            ref={iframeRef}
            src="/lp/jobs-widget"
            style={{
              width: '100%',
              border: 'none',
              height: `${iframeHeight}px`,
            }}
            title="おすすめ求人ウィジェット プレビュー"
          />
        </div>
      </div>
    </div>
  );
}
