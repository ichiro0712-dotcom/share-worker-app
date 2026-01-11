import Link from 'next/link';
import Image from 'next/image';
import { ReactNode } from 'react';

interface PublicLayoutProps {
  children: ReactNode;
}

/**
 * 公開ページ用レイアウト
 * - ヘッダー: ロゴのみ
 * - フッター: 会員登録CTAボタン（固定）
 * - ナビゲーションメニューなし
 */
export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー - ロゴのみ */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo.png"
              alt="+TASTAS"
              width={120}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main
        className="max-w-lg mx-auto"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      {/* フッター - CTA固定 */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-primary z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-lg mx-auto p-4">
          <Link
            href="/login"
            className="block w-full bg-white text-primary font-bold py-3 rounded-lg text-center shadow-lg hover:bg-gray-50 transition-colors"
          >
            会員登録して応募する
          </Link>
        </div>
      </footer>
    </div>
  );
}
