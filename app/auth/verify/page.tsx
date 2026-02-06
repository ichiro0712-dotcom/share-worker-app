'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

/**
 * メール認証結果ページ
 *
 * 通常フロー: メールリンク → /api/auth/verify → /api/auth/auto-login → ホーム
 * （サーバーサイドで完結するため、このページは通常表示されない）
 *
 * このページが表示されるケース:
 * - 認証成功だが自動ログイン失敗（status=verified）
 * - トークン無効・期限切れ（status=error）
 * - トークンパラメータなし（直アクセス）
 */
export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const status = searchParams?.get('status'); // 'verified' | 'error' | 'expired' | null
  const errorMessage = searchParams?.get('message');

  // 認証成功だが自動ログイン失敗（手動ログインを促す）
  if (status === 'verified') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            認証完了
          </h1>
          <p className="text-gray-600 mb-6">
            メールアドレスの認証が完了しました。
            ログインしてサービスをご利用ください。
          </p>
          <Link
            href="/login?verified=true"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            ログインする
          </Link>
        </div>
      </div>
    );
  }

  // トークン期限切れ
  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            認証リンクの期限切れ
          </h1>
          <p className="text-gray-600 mb-6">
            認証リンクの有効期限が切れています。
            お手数ですが、認証メールを再送信してください。
          </p>
          <div className="space-y-3">
            <Link
              href="/auth/resend-verification"
              className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              認証メールを再送信
            </Link>
            <Link
              href="/login"
              className="block w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              ログインページへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // エラー（トークン無効など）
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            認証に失敗しました
          </h1>
          <p className="text-gray-600 mb-6">
            {errorMessage || '認証リンクが無効です。'}
          </p>
          <div className="space-y-3">
            <Link
              href="/auth/resend-verification"
              className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              認証メールを再送信
            </Link>
            <Link
              href="/login"
              className="block w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              ログインページへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // パラメータなし（直アクセス）
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          認証リンクが無効です
        </h1>
        <p className="text-gray-600 mb-6">
          認証リンクが正しくありません。
          メールに記載されたリンクを再度クリックしてください。
        </p>
        <Link
          href="/login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          ログインページへ
        </Link>
      </div>
    </div>
  );
}
