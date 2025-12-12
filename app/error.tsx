'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーをログに記録（本番環境ではエラー追跡サービスに送信）
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          エラーが発生しました
        </h1>

        <p className="text-slate-600 mb-6">
          申し訳ございません。予期しないエラーが発生しました。
          <br />
          しばらくしてから再度お試しください。
        </p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="bg-slate-100 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs font-mono text-slate-600 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-400 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            再試行
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
