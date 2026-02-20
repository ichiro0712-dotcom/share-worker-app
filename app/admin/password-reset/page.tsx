'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { requestFacilityPasswordReset } from '@/src/lib/system-actions';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

export default function AdminPasswordResetRequestPage() {
  const { showDebugError } = useDebugError();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('メールアドレスを入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await requestFacilityPasswordReset(email);

      if (result.success) {
        setIsSuccess(true);
        if (result.resetToken) {
          const baseUrl = window.location.origin;
          setResetUrl(`${baseUrl}/admin/password-reset/${result.resetToken}`);
        }
        toast.success('パスワードリセットの手続きを開始しました');
      } else {
        showDebugError({
          type: 'other',
          operation: '施設管理者パスワードリセット要求',
          message: result.message || 'エラーが発生しました',
          context: { email }
        });
        toast.error(result.message || 'エラーが発生しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'other',
        operation: '施設管理者パスワードリセット要求（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { email }
      });
      toast.error('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (resetUrl) {
      navigator.clipboard.writeText(resetUrl);
      toast.success('URLをコピーしました');
    }
  };

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
              {resetUrl ? 'リセットURLが生成されました' : 'メールを確認してください'}
            </h1>
            <p className="text-gray-600 mb-6">
              {resetUrl
                ? '以下のURLからパスワードを再設定してください。'
                : `${email} 宛てにパスワードリセットのリンクを送信しました。メールに記載されたリンクからパスワードを再設定してください。`
              }
            </p>

            {resetUrl && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 font-medium mb-3">
                  パスワードリセットURL（開発用）
                </p>
                <div className="bg-white rounded border border-blue-300 p-3 mb-3">
                  <p className="text-xs text-gray-600 break-all font-mono">
                    {resetUrl}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                  >
                    <Copy className="w-4 h-4" />
                    URLをコピー
                  </button>
                  <a
                    href={resetUrl}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    開く
                  </a>
                </div>
              </div>
            )}

            {!resetUrl && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  登録されていないメールアドレスの場合、リセットURLは表示されません。
                </p>
              </div>
            )}

            <Link
              href="/admin/login"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              管理者ログイン画面に戻る
            </Link>
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
            パスワードをお忘れですか？
          </h1>
          <p className="text-gray-600 mb-6">
            登録したメールアドレスを入力してください。
            パスワード再設定用のリンクをお送りします。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="example@email.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '送信中...' : 'リセットリンクを送信'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
