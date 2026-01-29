'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

type VerifyState = 'loading' | 'success' | 'logging-in' | 'error' | 'no-token';

interface VerifyResult {
  success: boolean;
  error?: string;
  email?: string;
  autoLoginToken?: string;
}

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return;
    }

    const verifyAndLogin = async () => {
      try {
        // トークン検証APIを呼び出し
        const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        const result: VerifyResult = await response.json();

        if (!result.success) {
          setState('error');
          setError(result.error || '認証に失敗しました');
          return;
        }

        // 認証成功 - 自動ログインを試行
        if (result.email && result.autoLoginToken) {
          setState('logging-in');

          const signInResult = await signIn('credentials', {
            redirect: false,
            email: result.email,
            password: '', // 自動ログイン時は不要
            autoLoginToken: result.autoLoginToken,
          });

          if (signInResult?.ok) {
            // ログイン成功 - 求人一覧ページへリダイレクト
            router.push('/');
            return;
          }

          // 自動ログイン失敗 - 成功画面を表示（手動ログインを促す）
          console.warn('[Verify] Auto login failed:', signInResult?.error);
        }

        setState('success');
      } catch (err) {
        console.error('[Verify] Error:', err);
        setState('error');
        setError('システムエラーが発生しました');
      }
    };

    verifyAndLogin();
  }, [token, router]);

  // トークンがない場合
  if (state === 'no-token') {
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

  // ローディング中
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            認証中...
          </h1>
          <p className="text-gray-600">
            メールアドレスを確認しています
          </p>
        </div>
      </div>
    );
  }

  // 自動ログイン中
  if (state === 'logging-in') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader2 className="w-16 h-16 text-green-500 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ログイン中...
          </h1>
          <p className="text-gray-600">
            自動的にログインしています
          </p>
        </div>
      </div>
    );
  }

  // 認証成功（手動ログインが必要な場合）
  if (state === 'success') {
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
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            ログインする
          </Link>
        </div>
      </div>
    );
  }

  // 検証失敗
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          認証に失敗しました
        </h1>
        <p className="text-gray-600 mb-6">
          {error || '認証リンクが無効または期限切れです。'}
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
