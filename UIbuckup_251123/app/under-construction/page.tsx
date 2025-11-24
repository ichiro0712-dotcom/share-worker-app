'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/layout/BottomNav';

export default function UnderConstruction() {
  const searchParams = useSearchParams();
  const page = searchParams.get('page') || 'このページ';

  const pageNames: Record<string, string> = {
    favorites: 'お気に入り',
    messages: 'メッセージ',
    jobs: '仕事管理',
    mypage: 'マイページ',
    limited: '限定',
    nominated: '指名'
  };

  const pageName = pageNames[page] || page;

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center">
          <Link href="/job-list">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center text-lg">{pageName}</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">🚧</div>
          <h2 className="text-xl mb-4 text-gray-900">工事中です</h2>
          <p className="text-gray-600 mb-8">
            この機能はPhase 2以降で実装予定です
          </p>
          <Link href="/job-list">
            <Button size="lg" className="w-full">
              TOPに戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
