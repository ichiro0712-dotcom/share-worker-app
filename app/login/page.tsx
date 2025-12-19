'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
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
        </div>

        {/* ログインフォーム */}
        <div className="bg-primary rounded-2xl shadow-lg p-6 mb-4">
          <h2 className="text-xl font-bold mb-6 text-white">ログイン</h2>

          {error && (
            <div className="mb-4 p-3 bg-white/90 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
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
              className="w-full py-3 bg-white text-primary rounded-lg font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
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

        {/* テストワーカー */}
        <div className="bg-primary-light border border-primary/20 rounded-2xl p-4">
          <h3 className="font-semibold text-sm text-primary mb-3">
            テストワーカーでログイン
          </h3>
          <div className="space-y-2">
            {testUsers.length > 0 ? (
              testUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => handleTestLogin(user.email, 'password123')}
                  className="w-full text-left px-3 py-2 bg-white border border-primary/30 rounded-lg text-sm hover:bg-primary/5 hover:border-primary/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <img src={`/images/users/user${(index % 2) + 2}.svg`} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500">テストユーザーを読み込み中...</p>
            )}
          </div>
          <p className="text-xs text-primary/70 mt-3">
            ※ クリックで自動入力されます。「ログイン」ボタンを押してください。
          </p>
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
