'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getTestUsers } from '@/src/lib/actions';

type TestUser = {
  id: number;
  email: string;
  name: string;
  profileImage: string | null;
};

export default function WorkerLogin() {
  const router = useRouter();
  const { login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);

  // テストユーザーをDBから取得
  useEffect(() => {
    getTestUsers().then(setTestUsers);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        toast.success('ログインしました');
        router.push('/');
        router.refresh();
      } else {
        setError(result.error || 'ログインに失敗しました');
      }
    } catch (err) {
      setError('ログイン中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestLogin = (testEmail: string, testPassword: string) => {
    setEmail(testEmail);
    setPassword(testPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-light to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-4 rounded-full">
              <User className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">ワーカーログイン</h1>
          <p className="text-gray-600">+TASTAS</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h2 className="text-xl font-bold mb-6">ログイン</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="yamada.taro@example.com"
                />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-sm font-medium mb-2">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
              <Link href="/password-reset" className="text-sm text-primary hover:underline">
                パスワードを忘れた場合
              </Link>
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* 新規登録リンク */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600 mb-3">
              アカウントをお持ちでない方
            </p>
            <Link
              href="/register/worker"
              className="block w-full py-3 border-2 border-primary text-primary rounded-lg font-medium hover:bg-primary-light/10 transition-colors"
            >
              新規登録はこちら
            </Link>
          </div>
        </div>

        {/* テストワーカー */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-green-800 mb-3">
            テストワーカーでログイン
          </h3>
          <div className="space-y-2">
            {testUsers.length > 0 ? (
              testUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => handleTestLogin(user.email, 'SKIP_PASSWORD_CHECK_FOR_TEST_USER')}
                  className="w-full text-left px-3 py-2 bg-white border border-green-300 rounded text-sm hover:bg-green-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <img src={`/images/users/user${index + 1}.svg`} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-600">{user.email}</div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500">テストユーザーを読み込み中...</p>
            )}
          </div>
          <p className="text-xs text-green-700 mt-3">
            ※ クリックで自動入力されます。「ログイン」ボタンを押してください。
          </p>
        </div>

        {/* TOPに戻るリンク */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:underline">
            TOPに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
