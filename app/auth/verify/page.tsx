import { verifyEmailToken } from '@/src/lib/auth/email-verification';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token;

  // トークンがない場合
  if (!token) {
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

  // トークン検証
  const result = await verifyEmailToken(token);

  // 検証成功
  if (result.success) {
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
          {result.error || '認証リンクが無効または期限切れです。'}
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
