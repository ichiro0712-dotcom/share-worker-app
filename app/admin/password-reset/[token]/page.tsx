'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { validateFacilityResetToken, resetFacilityPassword } from '@/src/lib/system-actions';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

export default function AdminPasswordResetTokenPage() {
  const params = useParams();
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const token = params?.token as string;

  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const result = await validateFacilityResetToken(token);
        if (result.valid) {
          setIsValidToken(true);
          setAdminEmail(result.email || '');
        }
      } catch {
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('パスワードは8文字以上で入力してください');
      return;
    }

    if (password !== passwordConfirm) {
      toast.error('パスワードが一致しません');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetFacilityPassword(token, password);

      if (result.success) {
        setIsSuccess(true);
        toast.success('パスワードを変更しました');
      } else {
        showDebugError({
          type: 'update',
          operation: '施設管理者パスワードリセット実行',
          message: result.message || 'エラーが発生しました',
          context: { email: adminEmail }
        });
        toast.error(result.message || 'エラーが発生しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'update',
        operation: '施設管理者パスワードリセット実行（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { email: adminEmail }
      });
      toast.error('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">確認中...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-4 rounded-full">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              リンクが無効です
            </h1>
            <p className="text-gray-600 mb-6">
              このパスワードリセットリンクは無効または期限切れです。
              もう一度リセットをリクエストしてください。
            </p>
            <Link
              href="/admin/login"
              className="block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              管理者ログイン画面へ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              パスワードを変更しました
            </h1>
            <p className="text-gray-600 mb-6">
              新しいパスワードで管理者ログインしてください。
            </p>
            <button
              onClick={() => router.push('/admin/login')}
              className="block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              管理者ログイン画面へ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <Link href="/admin/login" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
            <ArrowLeft className="w-4 h-4" />
            管理者ログイン画面に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            新しいパスワードを設定
          </h1>
          <p className="text-gray-600 mb-6">
            {adminEmail} のパスワードを再設定します。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新しいパスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="8文字以上"
                  minLength={8}
                  required
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
              <p className="text-xs text-gray-500 mt-1">8文字以上で入力してください</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新しいパスワード（確認）
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPasswordConfirm ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="パスワードを再入力"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '変更中...' : 'パスワードを変更'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
