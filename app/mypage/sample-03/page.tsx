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
    Gem,
    Crown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSafeImageUrl } from '@/utils/fileValidation';

// -----------------------------------------------------------------------------
// Sample 03: Premium Dark / Luxury
// テーマ: 高級感、会員証、落ち着き
// -----------------------------------------------------------------------------

export default function Sample03Page() {
    const router = useRouter();
    const { user: authUser, logout } = useAuth();

    const user = {
        name: authUser?.name || 'Guest User',
        email: authUser?.email || 'guest@example.com',
        profileImage: getSafeImageUrl(authUser?.image),
        id: 'ID: 8901-2345',
    };

    const handleLogout = async () => {
        if (confirm('ログアウトしますか？')) {
            await logout();
            router.push('/login');
        }
    };

    const MenuItem = ({ icon: Icon, label, href, subLabel }: { icon: any, label: string, href: string, subLabel?: string }) => (
        <Link href={href} className="group flex items-center justify-between py-4 px-1 border-b border-slate-800 last:border-0 hover:bg-white/5 transition-colors -mx-1 px-3 rounded-lg">
            <div className="flex items-center gap-4">
                <Icon className="w-5 h-5 text-amber-500/80 group-hover:text-amber-400 transition-colors" />
                <div>
                    <span className="block text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</span>
                    {subLabel && <span className="block text-[10px] text-slate-500">{subLabel}</span>}
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-500 transition-colors" />
        </Link>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
            <div className="max-w-md mx-auto p-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-8 pt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-900/20">
                            <Crown className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-wide text-white">タスタス<span className="text-amber-500">.</span></span>
                    </div>
                    <div className="flex gap-4 text-xs font-medium text-slate-500">
                        <span>PREMIUM</span>
                    </div>
                </div>

                {/* Digital Member Card */}
                <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 mb-10 group transform transition-all hover:scale-[1.02] duration-500">
                    {/* Card Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black z-0"></div>
                    {/* Decorative Pattern - pure CSS */}
                    <div className="absolute inset-0 opacity-20 z-0" style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
                        backgroundSize: '24px 24px'
                    }}></div>
                    <div className="absolute -top-[50%] -left-[50%] w-[100%] h-[100%] bg-amber-500/20 blur-[100px] rounded-full animate-pulse"></div>

                    {/* Card Content */}
                    <div className="relative z-10 h-full p-6 flex flex-col justify-between border border-white/10 rounded-2xl">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="relative w-12 h-12 rounded-full border-2 border-amber-500/30 overflow-hidden bg-slate-800 p-0.5">
                                    <div className="w-full h-full rounded-full overflow-hidden relative">
                                        {user.profileImage ? (
                                            <Image src={user.profileImage} alt="Profile" fill className="object-cover" />
                                        ) : (
                                            <User className="w-full h-full p-2 text-slate-400" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-amber-500 font-bold tracking-wider mb-0.5">MEMBER</p>
                                    <h2 className="text-lg font-bold text-white leading-none">{user.name}</h2>
                                </div>
                            </div>
                            <Gem className="w-6 h-6 text-amber-500 opacity-80" />
                        </div>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Membership ID</p>
                                <p className="font-mono text-sm text-slate-300 tracking-widest">{user.id}</p>
                            </div>
                            <Link href="/mypage/profile" className="px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-[10px] text-white hover:bg-white/10 transition-colors">
                                Edit Profile
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Main Menu Section */}
                <div className="space-y-8">

                    {/* Section: Work */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Work Management</h3>
                        <div className="bg-slate-900/50 rounded-xl p-2 border border-slate-800 backdrop-blur-sm">
                            <MenuItem icon={Calendar} label="仕事管理" subLabel="スケジュール確認・勤怠入力" href="/my-jobs" />
                            <MenuItem icon={MessageSquare} label="レビュー" subLabel="評価の確認・返信" href="/mypage/reviews" />
                            <MenuItem icon={Heart} label="お気に入り施設" href="/favorites" />
                            <MenuItem icon={Star} label="ブックマーク求人" href="/bookmarks" />
                        </div>
                    </div>

                    {/* Section: Settings */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">System</h3>
                        <div className="bg-slate-900/50 rounded-xl p-2 border border-slate-800 backdrop-blur-sm">
                            <MenuItem icon={Bell} label="通知設定" href="/mypage/notifications" />
                            <MenuItem icon={VolumeX} label="ミュート施設" href="/mypage/muted-facilities" />
                            <MenuItem icon={Shield} label="プライバシーとセキュリティ" href="/privacy" />
                            <MenuItem icon={HelpCircle} label="ヘルプ・お問い合わせ" href="/contact" />
                        </div>
                    </div>

                </div>

                {/* Footer Action */}
                <div className="mt-12 text-center">
                    <button
                        onClick={handleLogout}
                        className="text-xs font-bold text-red-900/70 hover:text-red-500 transition-colors tracking-widest uppercase py-4 px-8 rounded-full hover:bg-red-500/10"
                    >
                        Log Out
                    </button>
                    <p className="mt-4 text-[10px] text-slate-700 font-mono">タスタス SYSTEM CONNECTED</p>
                </div>

            </div>
        </div>
    );
}
