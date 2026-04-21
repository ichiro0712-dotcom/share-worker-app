'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCsrfToken } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { parseLoginIdentifier } from '@/src/lib/auth/identifier';

export default function WorkerLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <WorkerLoginInner />
    </Suspense>
  );
}

function WorkerLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading: authLoading } = useAuth();
  const { showDebugError } = useDebugError();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfReady, setCsrfReady] = useState(false);

  // CSRFトークンを事前取得（1回目ログイン失敗問題の対策）
  useEffect(() => {
    getCsrfToken().then(() => {
      console.log('[Login] CSRF token ready');
      setCsrfReady(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier || !password) {
      setError('メールアドレスまたは電話番号とパスワードを入力してください');
      return;
    }

    const parsed = parseLoginIdentifier(identifier);
    if (parsed.type === 'invalid') {
      setError('メールアドレスまたは電話番号の形式が正しくありません');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(identifier, password);

      if (result.success) {
        toast.success('ログインしました');
        // セッションCookieが確実に反映されるようフルページナビゲーション
        window.location.href = '/';
      } else {
        showDebugError({
          type: 'other',
          operation: 'ログイン',
          message: result.error || 'ログインに失敗しました',
          context: { identifier }
        });
        setError(result.error || 'ログインに失敗しました');
      }
    } catch (err) {
      const debugInfo = extractDebugInfo(err);
      showDebugError({
        type: 'other',
        operation: 'ログイン（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { identifier }
      });
      setError('ログイン中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* ロゴ */}
        <div className="text-center mb-5 mt-10">
          <div className="flex justify-center">
            <img
              src="/rogo/logo-tastas.webp"
              alt="タスタス"
              width={180}
              height={200}
              className="object-contain"
            />
          </div>
{/* <p className="mt-2 text-gray-600">テストのテキスト</p> */}
        </div>

        {/* ログインフォーム */}
        <div className="bg-primary rounded-2xl shadow-lg p-6 mb-4">
          <h2 className="text-xl font-bold mb-6 text-white">ログイン</h2>

          {error && (
            <div className="mb-4 p-3 bg-white/90 border border-red-200 rounded-lg text-red-700 text-sm">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス or 電話番号 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                メールアドレス または 電話番号
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="login-identifier"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 bg-white"
                  placeholder="メールアドレス または 電話番号"
                />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 bg-white"
                  placeholder="パスワードを入力"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* パスワードを忘れた場合 */}
            <div className="text-right">
              <Link href="/password-reset" className="text-sm text-white/90 hover:text-white hover:underline">
                パスワードを忘れた場合
              </Link>
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full py-3 bg-white text-primary rounded-lg font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting && <LoadingSpinner size="sm" color="primary" />}
              {isSubmitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* 新規登録リンク（LP情報をクエリパラメータで引き継ぐ） */}
          <div className="mt-6 pt-6 border-t border-white/30 text-center">
            <p className="text-sm text-white/90 mb-3">
              アカウントをお持ちでない方
            </p>
            <Link
              href={(() => {
                const params = new URLSearchParams();
                const lp = searchParams?.get('lp');
                const c = searchParams?.get('c');
                const g = searchParams?.get('g');
                if (lp) params.set('lp', lp);
                if (c) params.set('c', c);
                if (g) params.set('g', g);
                const qs = params.toString();
                return `/register/worker${qs ? `?${qs}` : ''}`;
              })()}
              className="block w-full py-3 border-2 border-white text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
            >
              新規登録はこちら
            </Link>
          </div>
        </div>

        {/* 運営会社情報 */}
        <div className="text-center text-sm text-gray-500 mt-6 mb-4">
          <span>株式会社キャリア</span>
          <span className="mx-2">|</span>
          <a
            href="https://www.careergift.co.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 hover:underline"
          >
            運営会社情報
          </a>
        </div>
      </div>
    </div>
  );
}
