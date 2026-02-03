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
// Sample 04: Layered Depth & Glassmorphism (Evolution of Sample 01)
// テーマ: 色彩、立体感、奥行き、プレミアム
// 特徴: プロフィールカード背面のグラデーションレイヤーによるリッチな表現
// -----------------------------------------------------------------------------

export default function Sample04Page() {
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
                { icon: Calendar, label: '仕事管理', href: '/my-jobs', color: 'text-blue-500', bg: 'bg-blue-50/80' },
                { icon: MessageSquare, label: 'レビュー', href: '/mypage/reviews', color: 'text-orange-500', bg: 'bg-orange-50/80' },
                { icon: Heart, label: 'お気に入り', href: '/favorites', color: 'text-pink-500', bg: 'bg-pink-50/80' },
                { icon: Star, label: 'ブックマーク', href: '/bookmarks', color: 'text-yellow-500', bg: 'bg-yellow-50/80' },
            ]
        },
        {
            title: '設定・サポート',
            items: [
                { icon: User, label: 'プロフィール編集', href: '/mypage/profile', color: 'text-purple-500', bg: 'bg-purple-50/80' },
                { icon: Bell, label: '通知設定', href: '/mypage/notifications', color: 'text-green-500', bg: 'bg-green-50/80' },
                { icon: VolumeX, label: 'ミュート施設', href: '/mypage/muted-facilities', color: 'text-gray-500', bg: 'bg-gray-50/80' },
                { icon: CreditCard, label: '支払い設定', href: '#', color: 'text-teal-500', bg: 'bg-teal-50/80' },
            ]
        },
        {
            title: 'その他',
            items: [
                { icon: HelpCircle, label: 'よくある質問', href: '/faq', color: 'text-cyan-500', bg: 'bg-cyan-50/80' },
                { icon: MessageCircle, label: 'お問い合わせ', href: '/contact', color: 'text-indigo-500', bg: 'bg-indigo-50/80' },
                { icon: FileText, label: '利用規約', href: '/terms', color: 'text-slate-500', bg: 'bg-slate-50/80' },
                { icon: Shield, label: 'プライバシー', href: '/privacy', color: 'text-slate-500', bg: 'bg-slate-50/80' },
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

            {/* 背景装飾 (Blurred Blobs) - より淡く調整 */}
            <div className="fixed top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-100/60 rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob"></div>
            <div className="fixed top-[20%] left-[-20%] w-[400px] h-[400px] bg-purple-100/60 rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob animation-delay-2000"></div>
            <div className="fixed bottom-[-20%] right-[10%] w-[600px] h-[600px] bg-pink-50/60 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob animation-delay-4000"></div>

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

                {/* プロフィールカード (3D Layered Effect) */}
                <div className="px-6 mb-8 relative group/card">
                    {/* 追加レイヤー：背面の立体感用グラデーション */}
                    <div className="absolute inset-x-8 top-4 bottom-2 bg-gradient-to-r from-blue-400/40 via-purple-400/40 to-pink-400/40 blur-2xl rounded-full opacity-80 group-hover/card:opacity-100 transition-opacity duration-500 -z-10 transform translate-y-2"></div>

                    <div className="bg-white/70 backdrop-blur-2xl border border-white/80 shadow-xl shadow-slate-200/50 rounded-3xl p-6 relative overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200/60 ring-1 ring-white/50">

                        {/* カード内部の微細なグラデーションオーバーレイ */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-white/20 pointer-events-none z-0"></div>

                        {/* ガラスの反射効果 */}
                        <div className="absolute -inset-[100%] top-[-50%] bg-gradient-to-tr from-transparent via-white/20 to-transparent rotate-12 group-hover/card:translate-x-[50%] transition-transform duration-1000"></div>

                        <div className="absolute top-0 right-0 p-4 opacity-[0.08] transform rotate-12 translate-x-4 translate-y-[-10px]">
                            <User className="w-40 h-40" />
                        </div>

                        <div className="flex items-center gap-5 relative z-10">
                            <div className="relative w-20 h-20 rounded-2xl shadow-lg overflow-hidden bg-white border-[3px] border-white ring-4 ring-blue-50/80">
                                {user.profileImage ? (
                                    <Image src={user.profileImage} alt="Profile" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                        <User className="w-8 h-8 text-slate-400" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <h2 className="text-xl font-bold text-slate-800 truncate">{user.name}</h2>
                                </div>
                                <p className="text-sm text-slate-500 truncate mb-4 font-medium">{user.email}</p>

                                {/* 統計情報エリア */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <div className="text-center p-2 rounded-xl bg-slate-50/80 border border-slate-100/50">
                                        <p className="text-[10px] text-slate-500 font-medium mb-0.5">キャンセル率</p>
                                        <p className="text-sm font-bold text-slate-700">1.2%</p>
                                    </div>
                                    <div className="text-center p-2 rounded-xl bg-orange-50/80 border border-orange-100/50">
                                        <p className="text-[10px] text-orange-600 font-medium mb-0.5">直前キャンセル</p>
                                        <p className="text-sm font-bold text-orange-700">0.5%</p>
                                    </div>
                                    <div className="text-center p-2 rounded-xl bg-slate-50/80 border border-slate-100/50">
                                        <p className="text-[10px] text-slate-500 font-medium mb-0.5">キャンセル数</p>
                                        <p className="text-sm font-bold text-slate-700">3回</p>
                                    </div>
                                </div>

                                <Link
                                    href="/mypage/profile"
                                    className="inline-flex items-center text-xs font-bold text-blue-600 bg-blue-50/80 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors group/btn shadow-sm border border-blue-100"
                                >
                                    プロフィールを編集
                                    <ChevronRight className="w-3 h-3 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* クイックアクション (横スクロール) */}
                <div className="mb-9 overflow-x-auto no-scrollbar pl-6 pb-4 -mr-4 md:mr-0 pt-2">
                    <div className="flex gap-4 pr-6 w-max">
                        <Link href="/my-jobs" className="group flex flex-col items-center justify-center w-28 h-28 bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white hover:-translate-y-1 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700">スケジュール</span>
                        </Link>
                        <Link href="/mypage/reviews" className="group flex flex-col items-center justify-center w-28 h-28 bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white hover:-translate-y-1 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700">レビュー</span>
                        </Link>
                        <Link href="/favorites" className="group flex flex-col items-center justify-center w-28 h-28 bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white hover:-translate-y-1 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <Heart className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700">お気に入り</span>
                        </Link>
                    </div>
                </div>

                {/* メニューリスト */}
                <div className="px-6 space-y-7">
                    {menuGroups.map((group, idx) => (
                        <div key={idx}>
                            <h3 className="text-xs font-bold text-slate-400 mb-3 px-2 uppercase tracking-wider">{group.title}</h3>
                            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-sm border border-white overflow-hidden">
                                {group.items.map((item, itemIdx) => (
                                    <Link
                                        key={itemIdx}
                                        href={item.href}
                                        className="flex items-center justify-between p-4 hover:bg-white/60 transition-colors border-b border-slate-100/50 last:border-0 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center shadow-sm`}>
                                                <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{item.label}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleLogout}
                        className="w-full mt-4 p-4 bg-white/40 backdrop-blur-sm border border-white/60 rounded-3xl text-red-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50/50 transition-all shadow-sm group"
                    >
                        <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        ログアウト
                    </button>

                    <div className="text-center pt-8 pb-12">
                        <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase opacity-70">
                            Share Worker App <span className="text-slate-300">|</span> v2.0.4
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
