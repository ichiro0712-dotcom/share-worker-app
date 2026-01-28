'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCsrfToken } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function WorkerLogin() {
  const router = useRouter();
  const { login, isLoading: authLoading } = useAuth();
  const { showDebugError } = useDebugError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
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
    setIsEmailNotVerified(false);

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        toast.success('ログインしました');
        // セッションCookieが確実に反映されるようフルページナビゲーション
        window.location.href = '/';
      } else {
        // メール未認証エラーの場合
        if (result.error?.includes('EMAIL_NOT_VERIFIED')) {
          setIsEmailNotVerified(true);
          setError('メールアドレスが認証されていません。登録時に送信された確認メールのリンクをクリックしてください。');
        } else {
          showDebugError({
            type: 'other',
            operation: 'ログイン',
            message: result.error || 'ログインに失敗しました',
            context: { email }
          });
          setError(result.error || 'ログインに失敗しました');
        }
      }
    } catch (err) {
      const debugInfo = extractDebugInfo(err);
      showDebugError({
        type: 'other',
        operation: 'ログイン（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { email }
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
              src="/rogo/rogo5.png"
              alt="TASTAS"
              width={200}
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
              {isEmailNotVerified && (
                <Link
                  href={`/auth/resend-verification?email=${encodeURIComponent(email)}`}
                  className="mt-2 block text-primary font-medium hover:underline"
                >
                  確認メールを再送信する
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 bg-white"
                  placeholder="yamada.taro@example.com"
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

          {/* 新規登録リンク */}
          <div className="mt-6 pt-6 border-t border-white/30 text-center">
            <p className="text-sm text-white/90 mb-3">
              アカウントをお持ちでない方
            </p>
            <Link
              href="/register/worker"
              className="block w-full py-3 border-2 border-white text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
            >
              新規登録はこちら
            </Link>
          </div>
        </div>

        {/* TOPに戻るリンク */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-primary hover:underline">
            TOPに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
