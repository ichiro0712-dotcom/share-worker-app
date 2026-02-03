'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  MessageSquare,
  Heart,
  Star,
  User,
  Bell,
  HelpCircle,
  MessageCircle,
  FileText,
  Shield,
  VolumeX,
  ChevronRight,
  LogOut,
  Settings,
  CreditCard,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSafeImageUrl } from '@/utils/fileValidation';

// -----------------------------------------------------------------------------
// Sample 01: Modern Glassmorphism & Soft Gradients
// テーマ: 開放感、透明感、親しみやすさ
// -----------------------------------------------------------------------------

export default function Sample01Page() {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();

  const user = {
    name: authUser?.name || 'ゲストユーザー',
    email: authUser?.email || 'guest@example.com',
    profileImage: getSafeImageUrl(authUser?.image),
    role: '一般ユーザー', // Mock
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await logout();
      router.push('/login');
    }
  };

  const menuGroups = [
    {
      title: 'アクティビティ',
      items: [
        { icon: Calendar, label: '仕事管理', href: '/my-jobs', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: MessageSquare, label: 'レビュー', href: '/mypage/reviews', color: 'text-orange-500', bg: 'bg-orange-50' },
        { icon: Heart, label: 'お気に入り', href: '/favorites', color: 'text-pink-500', bg: 'bg-pink-50' },
        { icon: Star, label: 'ブックマーク', href: '/bookmarks', color: 'text-yellow-500', bg: 'bg-yellow-50' },
      ]
    },
    {
      title: '設定・サポート',
      items: [
        { icon: User, label: 'プロフィール編集', href: '/mypage/profile', color: 'text-purple-500', bg: 'bg-purple-50' },
        { icon: Bell, label: '通知設定', href: '/mypage/notifications', color: 'text-green-500', bg: 'bg-green-50' },
        { icon: VolumeX, label: 'ミュート施設', href: '/mypage/muted-facilities', color: 'text-gray-500', bg: 'bg-gray-50' },
        { icon: CreditCard, label: '支払い設定', href: '#', color: 'text-teal-500', bg: 'bg-teal-50' },
      ]
    },
    {
      title: 'その他',
      items: [
        { icon: HelpCircle, label: 'よくある質問', href: '/faq', color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { icon: MessageCircle, label: 'お問い合わせ', href: '/contact', color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { icon: FileText, label: '利用規約', href: '/terms', color: 'text-slate-500', bg: 'bg-slate-50' },
        { icon: Shield, label: 'プライバシー', href: '/privacy', color: 'text-slate-500', bg: 'bg-slate-50' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FDFEFE] relative overflow-hidden font-sans text-slate-800">
      <style jsx global>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* 背景装飾 (Blurred Blobs) */}
      <div className="fixed top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-100 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob"></div>
      <div className="fixed top-[20%] left-[-20%] w-[400px] h-[400px] bg-purple-100 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob animation-delay-2000"></div>
      <div className="fixed bottom-[-20%] right-[10%] w-[600px] h-[600px] bg-pink-50 rounded-full mix-blend-multiply filter blur-[80px] opacity-50 animate-blob animation-delay-4000"></div>

      <div className="max-w-md mx-auto relative z-10 pb-24">
        {/* ヘッダーエリア */}
        <header className="pt-12 pb-6 px-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
              マイページ
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              ようこそ、{user.name}さん
            </p>
          </div>
          <button className="p-2 rounded-full bg-white/50 backdrop-blur-md shadow-sm border border-white/50 hover:bg-white transition-colors">
            <Settings className="w-5 h-5 text-slate-600" />
          </button>
        </header>

        {/* プロフィールカード */}
        <div className="px-6 mb-8">
          <div className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/50 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <User className="w-32 h-32" />
            </div>

            <div className="flex items-center gap-5 relative z-10">
              <div className="relative w-20 h-20 rounded-2xl shadow-md overflow-hidden bg-white border-2 border-white ring-2 ring-blue-100/50">
                {user.profileImage ? (
                  <Image src={user.profileImage} alt="Profile" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
                  <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                    Premium
                  </span>
                </div>
                <p className="text-sm text-slate-500 truncate mb-3">{user.email}</p>
                <Link
                  href="/mypage/profile"
                  className="inline-flex items-center text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                >
                  プロフィールを編集
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* クイックアクション (横スクロール) */}
        <div className="mb-8 overflow-x-auto no-scrollbar pl-6 pb-2 -mr-4 md:mr-0">
          <div className="flex gap-4 pr-6 w-max">
            <Link href="/my-jobs" className="flex flex-col items-center justify-center w-28 h-28 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white hover:-translate-y-1 transition-transform duration-300">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">スケジュール</span>
            </Link>
            <Link href="/mypage/reviews" className="flex flex-col items-center justify-center w-28 h-28 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white hover:-translate-y-1 transition-transform duration-300">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-2">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">レビュー</span>
            </Link>
            <Link href="/favorites" className="flex flex-col items-center justify-center w-28 h-28 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white hover:-translate-y-1 transition-transform duration-300">
              <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center mb-2">
                <Heart className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">お気に入り</span>
            </Link>
          </div>
        </div>

        {/* メニューリスト */}
        <div className="px-6 space-y-6">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-bold text-slate-400 mb-3 px-2">{group.title}</h3>
              <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white overflow-hidden">
                {group.items.map((item, itemIdx) => (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    className="flex items-center justify-between p-4 hover:bg-white/50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={handleLogout}
            className="w-full mt-8 p-4 bg-white/50 backdrop-blur-sm border border-slate-100 rounded-2xl text-red-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>

          <div className="text-center pt-8 pb-12 text-xs text-slate-400 opacity-60">
            Share Worker App v2.0
          </div>
        </div>
      </div>
    </div>
  );
}
