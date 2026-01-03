'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function VerifyPendingPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('メールアドレスが指定されていません');
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendSuccess(true);
        toast.success('認証メールを再送信しました');
      } else {
        toast.error(data.error || '再送信に失敗しました');
      }
    } catch (error) {
      toast.error('再送信中にエラーが発生しました');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          メールをご確認ください
        </h1>

        <p className="text-gray-600 mb-6">
          ご登録ありがとうございます。
          <br />
          <span className="font-medium text-gray-900">{email || 'ご登録のメールアドレス'}</span>
          <br />
          に認証メールを送信しました。
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h2 className="font-semibold text-blue-900 mb-2">次のステップ</h2>
          <ol className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <span>メールボックスを確認してください</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <span>「メールアドレスを確認する」ボタンをクリック</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span>ログインして求人検索を始めましょう</span>
            </li>
          </ol>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>

        {resendSuccess ? (
          <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
            <CheckCircle className="w-5 h-5" />
            <span>再送信しました</span>
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={isResending || !email}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
            {isResending ? '送信中...' : '認証メールを再送信'}
          </button>
        )}

        <div className="border-t pt-4">
          <Link
            href="/login"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ログインページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
