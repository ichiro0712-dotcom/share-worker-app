'use client';

import { useRouter } from 'next/navigation';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AuthConstruction() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* 工事中アイコン */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
            <Construction className="w-12 h-12 text-yellow-600" />
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          ログイン機能は準備中です
        </h1>

        {/* 説明文 */}
        <div className="text-gray-600 mb-6 space-y-3">
          <p>
            ログイン・新規登録機能は、別システムと連携予定です。
          </p>
          <p className="text-sm">
            現在、外部認証システムとの接続を準備中です。<br />
            しばらくお待ちください。
          </p>
        </div>

        {/* 進捗情報 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 font-semibold mb-2">
            🔧 実装予定の機能
          </p>
          <ul className="text-xs text-blue-700 text-left space-y-1">
            <li>• メールアドレス / パスワードログイン</li>
            <li>• SNS連携ログイン（Google、LINE）</li>
            <li>• プロフィール管理</li>
            <li>• 外部認証システム連携</li>
          </ul>
        </div>

        {/* 戻るボタン */}
        <Button
          onClick={() => router.push('/')}
          size="lg"
          className="w-full flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          TOPページに戻る
        </Button>

        {/* 補足 */}
        <p className="text-xs text-gray-500 mt-4">
          Phase 2で実装予定
        </p>
      </div>
    </div>
  );
}
