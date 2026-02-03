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
    LogOut,
    ArrowUpRight,
    Briefcase
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSafeImageUrl } from '@/utils/fileValidation';

// -----------------------------------------------------------------------------
// Sample 02: Bento Grid / Bold Modern
// テーマ: 機能性、視認性、モダンテック
// -----------------------------------------------------------------------------

export default function Sample02Page() {
    const router = useRouter();
    const { user: authUser, logout } = useAuth();

    const user = {
        name: authUser?.name || 'ゲストユーザー',
        email: authUser?.email || 'guest@example.com',
        profileImage: getSafeImageUrl(authUser?.image),
    };

    const handleLogout = async () => {
        if (confirm('ログアウトしますか？')) {
            await logout();
            router.push('/login');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 pb-24 font-sans">
            <div className="max-w-md mx-auto p-4 pt-12">
                {/* Header Title */}
                <div className="flex justify-between items-end mb-6 px-1">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter">My Page.</h1>
                    <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded mb-2">Build 2026.02</span>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-2 gap-3">

                    {/* 1. Profile Card (Full Width) */}
                    <div className="col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group">
                        <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-900 border-4 border-white shadow-lg">
                                {user.profileImage ? (
                                    <Image src={user.profileImage} alt="Profile" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white">
                                        <User className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-gray-900 leading-tight">{user.name}</h2>
                                <p className="text-xs text-gray-500 font-medium mt-1">{user.email}</p>
                            </div>
                            <Link href="/mypage/profile" className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg">
                                <ArrowUpRight className="w-5 h-5" />
                            </Link>
                        </div>
                        {/* Decoration */}
                        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gray-50 rounded-full z-0 pointer-events-none group-hover:scale-110 transition-transform"></div>
                    </div>

                    {/* 2. Main Action: Jobs (Large) */}
                    <Link href="/my-jobs" className="col-span-1 aspect-square bg-[#3B82F6] rounded-3xl p-5 relative overflow-hidden text-white flex flex-col justify-between hover:bg-blue-600 transition-colors shadow-blue-200 shadow-lg group">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs opacity-80 font-medium mb-1">Work</p>
                            <h3 className="text-xl font-bold leading-none">仕事管理</h3>
                        </div>
                        <ArrowUpRight className="absolute top-5 right-5 w-5 h-5 opacity-50 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Link>

                    {/* 3. Main Action: Reviews (Large) */}
                    <Link href="/mypage/reviews" className="col-span-1 aspect-square bg-[#10B981] rounded-3xl p-5 relative overflow-hidden text-white flex flex-col justify-between hover:bg-emerald-600 transition-colors shadow-emerald-200 shadow-lg group">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs opacity-80 font-medium mb-1">Feedback</p>
                            <h3 className="text-xl font-bold leading-none">レビュー</h3>
                        </div>
                        <ArrowUpRight className="absolute top-5 right-5 w-5 h-5 opacity-50 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Link>

                    {/* 4. Secondary Actions (Horizontal Stack) */}
                    <Link href="/favorites" className="col-span-2 bg-white rounded-3xl p-4 flex items-center justify-between border border-gray-100 shadow-sm hover:border-gray-200 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center">
                                <Heart className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-gray-800">お気に入り施設</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-500">12</span>
                        </div>
                    </Link>

                    <Link href="/bookmarks" className="col-span-2 bg-white rounded-3xl p-4 flex items-center justify-between border border-gray-100 shadow-sm hover:border-gray-200 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center">
                                <Star className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-gray-800">ブックマーク求人</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-500">5</span>
                        </div>
                    </Link>

                    {/* 5. Utility Grid (Small) */}
                    <Link href="/mypage/notifications" className="col-span-1 bg-white rounded-3xl p-4 flex flex-col items-center justify-center gap-2 border border-gray-100 shadow-sm py-6">
                        <Bell className="w-6 h-6 text-gray-600" />
                        <span className="text-xs font-bold text-gray-600">通知設定</span>
                    </Link>

                    <Link href="/contact" className="col-span-1 bg-white rounded-3xl p-4 flex flex-col items-center justify-center gap-2 border border-gray-100 shadow-sm py-6">
                        <MessageCircle className="w-6 h-6 text-gray-600" />
                        <span className="text-xs font-bold text-gray-600">お問い合わせ</span>
                    </Link>

                    {/* Footer Text Links Area */}
                    <div className="col-span-2 mt-4 grid grid-cols-2 gap-2 text-center">
                        <Link href="/faq" className="text-xs font-bold text-gray-400 hover:text-gray-600 py-2 bg-gray-200/50 rounded-xl">よくある質問</Link>
                        <Link href="/terms" className="text-xs font-bold text-gray-400 hover:text-gray-600 py-2 bg-gray-200/50 rounded-xl">利用規約</Link>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="col-span-2 mt-2 py-4 rounded-3xl border-2 border-dashed border-gray-300 text-gray-400 font-bold text-sm hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        ログアウト
                    </button>

                </div>
            </div>
        </div>
    );
}
