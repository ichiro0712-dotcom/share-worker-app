'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import { Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';

export default function SystemAdminLoginPage() {
    const router = useRouter();
    const { adminLogin, isAdmin } = useSystemAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // If already logged in, redirect
    if (isAdmin) {
        router.push('/system-admin');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('メールアドレスとパスワードを入力してください');
            return;
        }

        setIsLoading(true);
        try {
            const result = await adminLogin(email, password);
            if (result.success) {
                router.push('/system-admin');
            } else {
                setError(result.error || 'メールアドレスまたはパスワードが正しくありません');
            }
        } catch (err) {
            setError('ログイン中にエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo/Title */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="bg-slate-800 p-4 rounded-xl shadow-lg">
                            <Shield className="w-12 h-12 text-indigo-500" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">システム管理</h1>
                    <p className="text-slate-500">+TASTAS System Administration</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-xl shadow-xl p-8 mb-4">
                    <h2 className="text-xl font-bold mb-6 text-slate-800">ログイン</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">
                                メールアドレス
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                                    placeholder="admin@system.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">
                                パスワード
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                                    placeholder="パスワードを入力"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md"
                        >
                            {isLoading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
