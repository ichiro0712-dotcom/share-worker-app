'use client';

import Link from 'next/link';
import { Home, Heart, Clipboard, User, Building2, Star, FileText, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function TestIndex() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    if (confirm('ログアウトしますか？')) {
      logout();
      alert('ログアウトしました');
    }
  };
  const pageCategories = [
    {
      title: 'メインページ',
      icon: <Home className="w-5 h-5" />,
      pages: [
        { name: 'TOPページ（求人検索）', href: '/', description: '求人一覧、フィルター、ソート機能' },
        { name: 'マイページ', href: '/mypage', description: 'ユーザー情報、メニュー一覧' },
      ],
    },
    {
      title: '管理者画面（施設側）',
      icon: <Building2 className="w-5 h-5" />,
      pages: [
        { name: '管理者ログイン', href: '/admin/login', description: '施設管理者用ログインページ' },
        { name: '管理者ダッシュボード', href: '/admin', description: '統計情報、求人管理メニュー（要ログイン）' },
        { name: '求人一覧・管理', href: '/admin/jobs', description: '求人の検索、フィルター、編集（要ログイン）' },
        { name: '求人新規作成', href: '/admin/jobs/new', description: '新規求人作成フォーム（要ログイン）' },
      ],
    },
    {
      title: '求人関連',
      icon: <FileText className="w-5 h-5" />,
      pages: [
        { name: '求人詳細ページ', href: '/jobs/1', description: '求人の詳細情報、応募フロー' },
        { name: '応募確認ページ', href: '/application-confirm', description: '応募内容の確認' },
        { name: '応募完了ページ', href: '/application-complete', description: '応募完了画面' },
        { name: '応募履歴', href: '/applications', description: '応募した求人の一覧' },
      ],
    },
    {
      title: '施設関連',
      icon: <Building2 className="w-5 h-5" />,
      pages: [
        { name: '施設詳細ページ', href: '/facilities/1', description: '施設情報、レビュー（フィルター・ソート機能付き）、求人一覧' },
        { name: 'レビュー投稿ページ', href: '/facilities/1/review/new', description: 'レビュー投稿フォーム（ログイン必須）' },
      ],
    },
    {
      title: 'お気に入り・ブックマーク',
      icon: <Heart className="w-5 h-5" />,
      pages: [
        { name: 'お気に入り施設', href: '/favorites', description: 'お気に入り施設の求人一覧' },
        { name: 'ブックマーク求人', href: '/bookmarks', description: 'ブックマークした求人一覧' },
      ],
    },
    {
      title: '認証関連',
      icon: <User className="w-5 h-5" />,
      pages: [
        { name: 'ログイン', href: '/login', description: 'テストユーザーでログイン可能' },
        { name: '新規登録', href: '/register', description: '外部システム連携（工事中）' },
        { name: '認証工事中ページ', href: '/auth-construction', description: '外部システム連携案内' },
      ],
    },
    {
      title: '開発中・未実装',
      icon: <Star className="w-5 h-5" />,
      pages: [
        { name: '工事中ページ', href: '/under-construction?page=limited', description: '未実装機能の案内' },
        { name: 'プロフィール編集', href: '/mypage/profile', description: 'Phase 2で実装予定（アラート表示）' },
        { name: 'ヘルプ', href: '/help', description: 'Phase 2で実装予定（アラート表示）' },
        { name: '利用規約', href: '/terms', description: 'Phase 2で実装予定（アラート表示）' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg p-6 mb-8 shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">S WORKS - テスト用インデックス</h1>
              <p className="text-sm opacity-90">
                開発中の全ページへのリンク集です。各ページの動作確認にご利用ください。
              </p>
            </div>
            {/* ログイン状態表示 */}
            <div className="ml-4">
              {isAuthenticated && user ? (
                <div className="bg-white/20 px-4 py-2 rounded-lg">
                  <div className="text-xs opacity-75 mb-1">ログイン中</div>
                  <div className="font-semibold text-sm">{user.name}</div>
                  <button
                    onClick={handleLogout}
                    className="mt-2 w-full flex items-center justify-center gap-1 bg-white/30 hover:bg-white/40 px-3 py-1 rounded text-xs transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    ログアウト
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white text-primary px-4 py-2 rounded-lg hover:bg-white/90 transition-colors font-medium"
                >
                  <LogIn className="w-4 h-4" />
                  ログイン
                </Link>
              )}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="bg-white/20 px-3 py-1 rounded">Phase 1: 完了</div>
            <div className="bg-white/20 px-3 py-1 rounded">Phase 2: 実装中</div>
          </div>
        </div>

        {/* ページカテゴリー */}
        <div className="space-y-6">
          {pageCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <div className="text-primary">{category.icon}</div>
                <h2 className="font-bold text-lg">{category.title}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {category.pages.map((page, pageIndex) => (
                  <Link
                    key={pageIndex}
                    href={page.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {page.name}
                        </h3>
                        <p className="text-sm text-gray-600">{page.description}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-400 font-mono">
                          {page.href}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* フッター情報 */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="font-bold text-lg mb-4">開発情報</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold w-32">バージョン:</span>
              <span>v1.0.0 (Phase 2 実装中)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold w-32">フレームワーク:</span>
              <span>Next.js 14.2.18</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold w-32">スタイリング:</span>
              <span>Tailwind CSS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold w-32">開発サーバー:</span>
              <span className="text-primary font-mono">http://localhost:3000</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-semibold text-sm text-yellow-800 mb-2">注意事項</h4>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• ダミーデータを使用しているため、実際のデータベースには接続していません</li>
              <li>• ログイン・認証機能は外部システム連携予定のため工事中です</li>
              <li>• Phase 2実装予定機能は一部アラート表示となります</li>
            </ul>
          </div>
        </div>

        {/* クイックアクセス */}
        <div className="mt-8 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-6">
          <h3 className="font-bold text-lg mb-4">クイックアクセス</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/"
              className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition-colors"
            >
              <Home className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm">TOP</span>
            </Link>
            <Link
              href="/facilities/1"
              className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition-colors"
            >
              <Building2 className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm">施設詳細</span>
            </Link>
            <Link
              href="/favorites"
              className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition-colors"
            >
              <Heart className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm">お気に入り</span>
            </Link>
            <Link
              href="/mypage"
              className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition-colors"
            >
              <User className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm">マイページ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
